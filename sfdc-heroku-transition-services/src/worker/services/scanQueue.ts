import RMSQWorker, { Client } from 'rsmq-worker'
import { AxiosError } from 'axios'
import { QUEUE_INTERVAL, SCHEMA_INSTANCE_URL, SCHEMA_USER, JWT_AUDIENCE } from '../../util/secrets'
import { SfApi } from '../../util/sfApi'
import logger from '../../util/logger'
import { RedisClient } from 'redis'
import {
  getAllDependenciesBulk,
  MetadataComponentDependency,
} from '../../util/sfDependencyHelper'
import {
  SfMigrationAnalysis,
  MigrationAnalysisItem,
  MappedObjectsInfo,
  ReportConfig
} from '../../util/sfMigrationAnalysis'
import {
  SfPostAnalysis,
  TransitionAnalysis,
  ReportSummary
} from '../../util/sfPostAnalysis'

interface MessageObj {
  OrgInfo: {
    InstanceUrl: string
    IsSandbox: boolean
    Username: string
    OrgId: string
    AccessToken: string
    ApiVersion: string
  }
  AssessmentId: string
  Namespace: string
  ObjectMapping: Map<string, string>
  OverallObjectMapping: Map<string, string>
  HerokuPostScan: string
  MappedSections: string[]
  PackageType : string
  FieldMapping: Map<string, string>
  RequestId: string
}

const REDIS_WORKER_QUEUE_NAME = 'scanQueue'
const SF_ASSESSMENT_OBJECT = 'Assessment__c'
const SF_RECORD_SCAN_COMPLETE = 'Bulk_Scan_Complete__c'
const SF_RECORD_STATUS = 'Status__c'
const SF_STATUS_REVIEW = 'Review'
const SF_SUB_STATUS_SCANNING_DEPENDENCIES = 'Scan_Status_Scanning_Dependencies__c'
const SF_SUB_STATUS_SUCCESS = 'Success'
const SF_ANALYSIS_FILENAME = 'migrationAnalysis.json'
const SF_FULL_ANALYSIS_FILENAME = 'analysis.json'

/**
 * The ScanQueue class provides tooling to build the migrationAnalysis.json file used by the migration analysis section of the assessment report in Salesforce.
 * 
 * The Migration Analysis section of the report is made up of the mapped objects from the questionnaire portion of the assessment in treeview form. Each mapped object
 * represents the parent and all related metadata are the children. FieldSet and PageLayout items also contain grandchildren (Field). 
 * 
 * Related metadata are of two categories:
 * 1) Directly Related Metadata. This is metadata that is part of the object's metadata definition file and deleted automatically when the object is deleted. A combination 
 *  of the Tooling API and Metadata API are used to build the list of related metadata items.
 * 2) Compiled References. This is metadata the is dependent upon the object. The object cannot be deleted without this reference being removed from the dependent component.
 *  The Dependency API is used to build the list of related metadata items. Without the Dependency API, a full text scan of all non-direct metadata components files would
 *  have to occur to achieve the same result.
 */
class ScanQueue {
  client!: Client
  start(redis: RedisClient) {
    this.client = new RMSQWorker(REDIS_WORKER_QUEUE_NAME, {
      redis,
      autostart: true,
      timeout: 6 * 60 * 1000,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // NOTE: interval DOES except number | number[] but the @types definition have not been updated
      //  https://github.com/mpneuried/rsmq-worker/blob/master/README.md#options-interval
      interval: QUEUE_INTERVAL,
    })

    this.client.on('message', async function (msg, next, id) {
      const {
        OrgInfo: { Username, OrgId, InstanceUrl, IsSandbox, ApiVersion },
        AssessmentId,
        Namespace,
        ObjectMapping,
        OverallObjectMapping,
        FieldMapping,
        MappedSections,
        HerokuPostScan,
        PackageType,
        RequestId,
      } = JSON.parse(msg) as MessageObj

      const chunkSize = 5000
      for (let i = 0; i < msg.length; i += chunkSize) {
        const chunk = msg.slice(i, i + chunkSize)
        logger.debug(`[${REDIS_WORKER_QUEUE_NAME}:${id}] ${chunk}`, RequestId)
      }

      // start a SF Bulk API Query
      try {
        const bulkApiClient = await new SfApi(
          InstanceUrl,
          Username,
          OrgId,
          ApiVersion,
          IsSandbox,
          redis,
          RequestId,
          AssessmentId,
          Namespace,
        )

        const refApiClient = await new SfApi(
          SCHEMA_INSTANCE_URL,
          SCHEMA_USER,
          OrgId,
          ApiVersion,
          !(JWT_AUDIENCE === 'https://login.salesforce.com'),
          redis,
          RequestId,
      )

        // Query SF
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Query dependencies`,
          RequestId,
        )
        
        const dependencies: MetadataComponentDependency[] = await getAllDependenciesBulk(bulkApiClient)

          // logger.debug(
          //   `==ObjectMapping var: ${ObjectMapping}`,
          //   RequestId,
          // )

          // logger.debug(
          //   `==ObjectMapping var: ${JSON.stringify(ObjectMapping)}`,
          //   RequestId,
          // )

          logger.debug(
            `==ObjectMapping var after: ${JSON.stringify(Object.entries(ObjectMapping))}`,
            RequestId,
          )

        //---
        //Update BB (11/21 - FSCTA-1626)
        //Read new "ReportConfig" variables based on user input
        //---
        const config : ReportConfig = await getReportConfig(bulkApiClient, Username)
        logger.debug(`==Config Vars: ${config}`)

        //--- refine Dependency API results into filtered Tree Grid for SF LWC ---//
        const sfMigrationAnalysis : SfMigrationAnalysis = new SfMigrationAnalysis(InstanceUrl, Namespace)
        const mappedObjectInfo : MappedObjectsInfo = await sfMigrationAnalysis.convertMappedObjectsToMaps(new Map(Object.entries(ObjectMapping || {})), new Map(Object.entries(OverallObjectMapping || {})), new Map(Object.entries(FieldMapping || {})), bulkApiClient, config)
        const dependencyRelatedMigrationAnalysisItems: MigrationAnalysisItem[] =
          sfMigrationAnalysis.generateAnalysis(
            dependencies,
            mappedObjectInfo,
            bulkApiClient,
            config
          )
        
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Produced Migration Analysis with ${dependencyRelatedMigrationAnalysisItems.length.toLocaleString()} nodes`,
          RequestId,
        )
        
        //---
        //Update BB (5/24 - FSCTA-1449)
        //Include Apex equivalents to "buildMissingRelationships" and "buildTypeGrouping". TODO: This likely could/should be expanded to include the detail that the Apex functions
        //provide, as performance/limits permit.
        //---        
        const allRelatedMigrationAnalysisItems : MigrationAnalysisItem[] = await sfMigrationAnalysis.buildMissingRelationships(dependencyRelatedMigrationAnalysisItems, mappedObjectInfo, bulkApiClient, config)
        const updatedAnalysis : MigrationAnalysisItem[] = sfMigrationAnalysis.buildTypeGrouping(allRelatedMigrationAnalysisItems, mappedObjectInfo, bulkApiClient, config)
        
        // Save results file in Salesforce
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Create Salesforce file related to Assessment`,
          RequestId,
        )

        //Update BB (8/12 - FSCTA-1609) Hold onto mappings and wait to create "final" file
        if(!HerokuPostScan || HerokuPostScan !== 'true'){
          const isResultFileSaved = await bulkApiClient.insertFile(
            AssessmentId,
             SF_ANALYSIS_FILENAME,
             Buffer.from(JSON.stringify(updatedAnalysis)),
        //    Buffer.from(JSON.stringify('TestFile-TestFile-TestFile')),
          )
        }

        // Set Assessment bulk scan complete checkbox
        await bulkApiClient.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_RECORD_SCAN_COMPLETE}`]: true,
          },
        )

        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Set ${Namespace}${SF_ASSESSMENT_OBJECT}.${Namespace}${SF_RECORD_SCAN_COMPLETE} to 'true'`,
          RequestId,
        )

        logger.debug(
          `==New scan value?: ${HerokuPostScan}`
        )

        if(HerokuPostScan === 'true'){
            //Post Migration Analysis Functions
          const sfPostAnalysis : SfPostAnalysis = new SfPostAnalysis(InstanceUrl, Namespace)
          //Generate Analysis
          const transitionAnalysis : TransitionAnalysis = await sfPostAnalysis.generateAnalysis(refApiClient, bulkApiClient, AssessmentId, mappedObjectInfo, new Set<string>(MappedSections), PackageType, config)
          transitionAnalysis.migrationAnalysis = updatedAnalysis

          //Update Scanning Dependencies sub status to "Success"
          if(PackageType === 'FSC'){
            await bulkApiClient.updateRecordData(
              `${Namespace}${SF_ASSESSMENT_OBJECT}`,
              AssessmentId,
              {
                [`${Namespace}${SF_SUB_STATUS_SCANNING_DEPENDENCIES}`]: SF_SUB_STATUS_SUCCESS,
              },
            )
          }
          
          //Generate Report Summary
          const reportSummary : ReportSummary = await sfPostAnalysis.buildReportSummaryResults(bulkApiClient,refApiClient, AssessmentId, updatedAnalysis, transitionAnalysis.assessmentResults, mappedObjectInfo, PackageType, config)
          transitionAnalysis.reportSummaryResults = reportSummary

          //Write final analysis file
          const isResultFileSaved = await bulkApiClient.insertFile(
            AssessmentId,
            SF_FULL_ANALYSIS_FILENAME,
            Buffer.from(JSON.stringify(transitionAnalysis)),
            //Buffer.from(JSON.stringify('TestFile-TestFile-TestFile')),
          )

          //Have Apex generate the overall recommendation
          const overallRecUrl = (Namespace) ? `/services/apexrest/${Namespace.replace('__','')}/PostScanData/overallRec` : `/services/apexrest/PostScanData/overallRec`
          const overallRecRequest = {url: overallRecUrl, method: 'post', body: JSON.stringify({'items':[AssessmentId]}), headers : {"Content-Type" : "application/json"}}
          const overallRecResult : any = await bulkApiClient.jsforceConn.request(overallRecRequest)
          logger.debug(`==OverallRec Result: ${overallRecResult}`)

          //Set final Assessment status (and any other fields that need to update)
          await bulkApiClient.updateRecordData(
            `${Namespace}${SF_ASSESSMENT_OBJECT}`,
            AssessmentId,
            {
              [`${Namespace}${SF_RECORD_STATUS}`]: SF_STATUS_REVIEW,
            },
          )
        }

      } catch (error) {
        if(error instanceof Error){
          if (error.stack) logger.error(error.stack)
          if ('isAxiosError' in error) {
            const { request, response, message } = error as AxiosError
            const errorObj = {
              message: `${request.method} ${request.res.responseUrl} ${message}`,
              error: response && response.data,
            }
            logger.error(errorObj, RequestId)
          } else {
            logger.error(error.message || error, RequestId)
          }
        
        }
      

      logger.debug(
        `[${REDIS_WORKER_QUEUE_NAME}:${id}] Finished Scan Queue Task`,
        RequestId,
      )

      //ACK MQ
      next()
      }
    })

    // optional error listeners
    this.client.on('error', function (err, msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}]${err}`)
    })
    this.client.on('exceeded', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] EXCEEDED`)
    })
    this.client.on('timeout', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] TIMEOUT ${msg.rc}`)
    })
  }
}

async function getReportConfig(apiClient: SfApi, user : string) : Promise<ReportConfig> {
  const resultConfig = await new Promise<{"ExcludedSections" : string[], "ExcludedMetadata" : string[]}>((resolve, reject) => {
    apiClient.redis.get('config:'+user, (err, data) => {
      let result : {"ExcludedSections" : string[], "ExcludedMetadata" : string[]} = {"ExcludedSections" : [], "ExcludedMetadata" : []}
      if (err){
        logger.debug(`==Error getting from Redis: ${err}`,)
      }
      if(data){
        logger.debug(`==Data: ${data}`)
        if(data !== 'nil'){
          result = JSON.parse(data)
        }else{
          result = {"ExcludedSections" : [], "ExcludedMetadata" : []}
        }
      }
      resolve(result)
    })
  })

  return resultConfig
}

export default new ScanQueue()
