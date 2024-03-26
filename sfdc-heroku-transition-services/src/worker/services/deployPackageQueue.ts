import { AsyncResult, FileProperties } from 'jsforce/api/metadata'
import JSZip from 'jszip'
import { RedisClient } from 'redis'
import RSMQWorker from 'rsmq-worker'
import { forceArray, onlyUnique } from '../../util/general'
import logger from '../../util/logger'
import { DeployResult } from '../../util/metadataTypes'
import { QUEUE_INTERVAL } from '../../util/secrets'
import { SfApi } from '../../util/sfApi'
import { ComponentType } from '../../util/sfDependencyHelper'
import {
  PackageFile,
  generateComponentXml,
  generateZip,
  setZipFiles,
  unpackZipXmlObject,
  PackageType,
} from '../../util/sfDeploymentPackageGenerator'
import {
  Layout,
  LayoutItem,
  LayoutItemBehavior,
  Package,
} from '../../util/sfPackageType'

interface MessageObj {
  OrgInfo: {
    InstanceUrl: string
    IsSandbox: boolean
    Username: string
    OrgId: string
    AccessToken: string
    ApiVersion: string
  }
  PackageFileId: string
  AssessmentId: string
  Namespace: string
  RequestId: string
}

const REDIS_WORKER_QUEUE_NAME = 'deployPackageQueue'
const SF_ASSESSMENT_OBJECT = 'Assessment__c'
const SF_PACKAGE_FILENAME = 'DeploymentPackage.zip'
const SF_RECORD_STATUS_JSON = 'DeploymentDataJSON__c'
const SF_DEPLOY_ERROR_FIELD = 'ErrorDeployPackagesJSON__c'
const SF_DEPLOY_PENDING_FIELD = 'PendingDeployPackagesJSON__c'

const MESSAGE_SERVER_ERROR = 'External Server Error'

class DeployPackageQueue {
  client!: RSMQWorker.Client
  start(redis: RedisClient) {
    this.client = new RSMQWorker(REDIS_WORKER_QUEUE_NAME, {
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
        PackageFileId,
        Namespace,
        RequestId,
        AssessmentId,
      } = JSON.parse(msg) as MessageObj
      try {
        logger.debug(`[${REDIS_WORKER_QUEUE_NAME}:${id}] ${msg}`, RequestId)
        const sfApi = await new SfApi(
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
        sfApi.createJsForceConnection()
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching latest ContentVersion Id from Document ${PackageFileId}`,
          RequestId,
        )
        const contentVersionId = (await sfApi.getContentVersionIds(
          PackageFileId,
          true,
        )) as string
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetched latest ContentVersion Id ${contentVersionId} from Document ${PackageFileId}`,
          RequestId,
        )

        // Download DeploymentPackage file (ContentVersion.Body)
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching ${SF_PACKAGE_FILENAME}...`,
          RequestId,
        )
        let deploymentPackageZip: Buffer = await sfApi.fetchRecord(
          'ContentVersion',
          contentVersionId,
        )

        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetched ${SF_PACKAGE_FILENAME}`,
          RequestId,
        )

        // Load .zip buffer into object instance
        const sourceZip: JSZip = await new JSZip().loadAsync(
          deploymentPackageZip,
        )

        // unpack package.xml types -> json
        const packageComponent = await unpackZipXmlObject<Package>(
          sourceZip,
          'package.xml',
          'Package',
        )
        packageComponent.types = forceArray(packageComponent.types)
        logger.debug(packageComponent)

        // Special handling check Layouts members exists in package xml
        const layouts = packageComponent.types.find(
          (type) => type.name === ComponentType.LAYOUT,
        )
        if (layouts) {
          const doRepackaging = await processLayouts(
            RequestId,
            sfApi,
            sourceZip,
            layouts,
          )
          // Repackage zip with updated layouts
          if (doRepackaging) {
            deploymentPackageZip = await generateZip(sourceZip)
          }
        }

        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Deploying package`,
          RequestId,
        )
        const job: AsyncResult = await new Promise((resolve, reject) =>
          sfApi.jsforceConn.metadata
            .deploy(deploymentPackageZip, {
              singlePackage: true,
            })
            .complete((err, result) => {
              if (err) reject(err)
              resolve(result)
            }),
        )

        const result = (await sfApi.jsforceConn.metadata.checkDeployStatus(
          job.id,
          true,
        )) as unknown as DeployResult
        if (result.success) {
          logger.debug(
            `[DeployPackageQueue:${id}] Successfully deployed package ${JSON.stringify(
              result,
            )}`,
            RequestId,
          )
        } else {
          logger.error(
            `[${REDIS_WORKER_QUEUE_NAME}:${id}] Failed to successfully deploy package ${JSON.stringify(
              result.id,
            )}`,
            RequestId,
          )
        }
        logger.error(result, RequestId)

        let { componentSuccesses, componentFailures } = result.details
        // Convert ComponentFailures/ComponentSuccess to arrays (if only one obj then they come back as an obj and not an array)
        componentFailures = forceArray(componentFailures)
        componentSuccesses = forceArray(componentSuccesses)

        await sfApi.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_RECORD_STATUS_JSON}`]: JSON.stringify({
              status: result.status.toUpperCase(),
              details: {
                componentFailures,
                componentSuccesses,
              },
            }),
          },
        )
        //ACK MQ
        next()
      } catch (error) {
        if (error instanceof Error) {
        logger.error(error.stack)
        
        //FSCTA-1563 - Salesforce UI hanging during deployment due to metadata errors
        const sfApi = await new SfApi(
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
        sfApi.createJsForceConnection()

        //Query "Pending Deploy" field from Assessment to use as a base for Error field details.
        const query = `SELECT Id, ${SF_DEPLOY_PENDING_FIELD} FROM ${Namespace}${SF_ASSESSMENT_OBJECT} WHERE Id = '${AssessmentId}'`
        let relatedAssessment : any
        const requestResult : any = await sfApi.query(query)
        relatedAssessment = forceArray(requestResult['records'])[0]

        //Append error-related information to our deploy details JSON.
        const errorJSON : string = relatedAssessment[`${SF_DEPLOY_PENDING_FIELD}`]
        const errorJSONObject : any = JSON.parse(errorJSON)
        errorJSONObject['DeploymentEndtime'] = new Date().toISOString()
        errorJSONObject['SuccessDetails'] = []

        //Context: Apex side uses a list of SF's "DeployMessage" Metadata Object; to catch general exceptions, we'll make one for the Package
        errorJSONObject['ErrorDetails'] = [{componentType: 'Package', fullName: `${MESSAGE_SERVER_ERROR}`, success: false, problemType: 'Error', problem: error.stack}]
        //Note: While this will catch *any* error that occurs, if we want to further enhance to narrow down things (e.g. which specific page layout failed), we can add a similar implementation to this in the "processLayouts"
        //helper function, track "ErrorDetails" in a class-accessible list, and then write all errors at the end.
        
        await sfApi.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_DEPLOY_ERROR_FIELD}`]: JSON.stringify(errorJSONObject),
            [`${Namespace}${SF_DEPLOY_PENDING_FIELD}`]: ''
          },
        )
        //END FSCTA-1563

        //ACK MQ
        next()
        }
      }
    })

    this.client.on('connected', (err, msg) => {
      console.log(err, msg)
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

/**
 * BELOW IS SPECIAL HANDLING FOR PAGE LAYOUTS
 * 1. Retrieve one layout for each target object
 * 2. Obtain required fields
 * 3. Copy required fields into new Layout deployment
 * @param requestId - RequestId passed to from web/worker for correlation
 * @param sfApi - SfApi instance that is authenticated with running user to target org
 * @param sourceZip - JSZip instance .zip buffer loaded as JS Object in memory
 * @param layouts - PackageType list of Layout members from package.xml
 * @returns - boolean true if deployment .zip package contents changed and require rebuilding buffer
 */
async function processLayouts(
  requestId: string,
  sfApi: SfApi,
  sourceZip: JSZip,
  layouts: PackageType,
): Promise<boolean> {
  let requiresRepackaging = false
  layouts.members = forceArray(layouts.members)
  // parse out target objects from member names : 'FinServ__FinancialAccount__c-Custom Object Layout.layout' -> 'FinServ__FinancialAccount__c'
  const sourceLayoutObjects = layouts.members
    .map((member) => member.split('-')[0])
    .filter(onlyUnique)
  logger.debug(`sourceLayoutObjects: ${sourceLayoutObjects}`)
  // use jsforce operation metadata list for each targetObject to get current org object related layouts
  if (sourceLayoutObjects) {
    let totalLayoutMetadata : Layout[] = []
    //Split into chunks (ListMetadata only supports 3 at a time)
    const chunkSize = 3
    for (let i = 0; i < sourceLayoutObjects.length; i += chunkSize) {
      const chunk = sourceLayoutObjects.slice(i, i + chunkSize)
      // operate on chunk
      const metadataList: FileProperties[] =
        await sfApi.jsforceConn.metadata.list(
          chunk.map((sourceLayout) => ({
            type: ComponentType.LAYOUT,
            folder: sourceLayout,
          })),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          (err: Error, metadata: never) => {
            return new Promise((resolve, reject) =>
              err ? reject(err) : resolve(metadata),
            )
          },
        )

      // for each unique target object do a first match on the orgs metadata layout list
      const objectToLayoutNames = chunk.reduce(
        (accumulator, sourceLayout) => {
          const match = metadataList.find((metadataInfo) =>
            metadataInfo.fullName.match(`^${sourceLayout}`),
          )
          if (match) {
            if (match.namespacePrefix) {
              const split = match.fullName.split('-')
              match.fullName = [
                split[0],
                `-${match.namespacePrefix}__`,
                split[1],
              ].join('')
            }
            return { ...accumulator, [match.fullName]: sourceLayout }
          } else {
            return accumulator
          }
        },
        {} as Record<string, string>,
      )

      logger.debug(`objectToLayoutNames: ${JSON.stringify(objectToLayoutNames)}`)
      // metadata retrieve request for each layout we matched on
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const currentLayoutMetadata: Layout | Layout[] =
        await sfApi.jsforceConn.metadata.read(
          ComponentType.LAYOUT,
          Object.keys(objectToLayoutNames).map((name) => name),
          (err, metadataInfo) =>
            new Promise((resolve, reject) =>
              err ? reject(err) : resolve(metadataInfo),
            ),
        )
      

      totalLayoutMetadata = totalLayoutMetadata.concat(forceArray(currentLayoutMetadata))
    }

    if (totalLayoutMetadata.length) {
      // logger.debug(currentLayoutMetadata)
      // for each returned metadata object => parse out required fields and make a map of targetObject -> requiredFields
      const layoutObjectToRequiredItems = totalLayoutMetadata.reduce(
        (accumulator, layoutObject) => {
          const requiredFields: Record<string, LayoutItem> = {}
          layoutObject.layoutSections.forEach((layoutSelection) => {
            layoutSelection.layoutColumns &&
              layoutSelection.layoutColumns
                // Exclude empty columns
                .filter((column) => !!column)
                .forEach((column) => {
                  if (column) {
                    column.layoutItems = forceArray(column.layoutItems)
                    // Filter on required fields
                    column.layoutItems
                      .filter(
                        (item) => item.behavior === LayoutItemBehavior.REQUIRED,
                      )
                      .forEach((item) => {
                        requiredFields[item.field] = item
                      })
                  }
                })
          })
          return {
            ...accumulator,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            [layoutObject.fullName.split('-')[0]]:
              Object.values(requiredFields),
          }
        },
        {} as Record<string, LayoutItem[]>,
      )
      logger.debug(
        `layoutObjectToRequiredItems: ${JSON.stringify(
          layoutObjectToRequiredItems,
        )}`,
      )
      // iterate through all of the layoutObjectToRequiredFields value and inject the keys (required fields) into the parsed xml objects
      for (const member of layouts.members) {
        const parsedLayout: Layout = await unpackZipXmlObject(
          sourceZip,
          `layouts/${member}.layout`,
          ComponentType.LAYOUT,
        )

        // Inject requiredLayoutItems into layout
        const requiredItems = layoutObjectToRequiredItems[member.split('-')[0]]
        logger.debug(`requiredItems: ${JSON.stringify(requiredItems)}`)

        // Add each required field to the first column
        for (const requiredFieldItem of requiredItems) {
          const requiredFieldApiName = requiredFieldItem.field
          let hasRequiredField = false

          //traverse sections, columns, layouts make sure required field not duplicated
          for (const layoutSection of forceArray(parsedLayout.layoutSections)) {
            for (const layoutColumn of forceArray(
              layoutSection.layoutColumns,
            )) {
              for (const layoutItem of forceArray(layoutColumn.layoutItems)) {
                if (layoutItem.field === requiredFieldApiName) {
                  hasRequiredField = true
                  break
                }
              }
              if (hasRequiredField) break
            }
            if (hasRequiredField) break
          }

          //insert required field first section and column
          if (!hasRequiredField) {
            //init empty lists
            parsedLayout.layoutSections[0].layoutColumns = parsedLayout
              .layoutSections[0].layoutColumns || [{}]
            parsedLayout.layoutSections[0].layoutColumns[0].layoutItems =
              parsedLayout.layoutSections[0].layoutColumns[0].layoutItems || []
            //add required field
            parsedLayout.layoutSections[0].layoutColumns[0].layoutItems.push(
              requiredFieldItem,
            )
            //update file data for new .zip
            const newFileData: PackageFile = generateComponentXml(
              ComponentType.LAYOUT,
              member,
              parsedLayout,
            )
            setZipFiles(sourceZip, [newFileData])
            requiresRepackaging = true
          }
        }
      }
    } else {
      logger.debug(
        `No Layout metadata returned`,
        requestId,
      )
    }
  }
  return requiresRepackaging
}

export default new DeployPackageQueue()
