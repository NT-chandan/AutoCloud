import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { DescribeSObjectResultMap, SfApi } from '../../util/sfApi'
import * as redis from '../services/redis'
import logger from '../../util/logger'
import { DescribeSObjectResult } from 'jsforce'
import {
  SALESFORCE_API_VERSION,
  SCHEMA_INSTANCE_URL,
  SCHEMA_USER,
  JWT_AUDIENCE
} from '../../util/secrets'
import { OrgInfo } from '../services/api'
//import {generateOrgAssessment,Metric,MetricsSystem } from '../../util/sfOrgAssessment'

interface CustomMetadataRequestBody {
    OrgInfo: OrgInfo
    Queries: string[]
    Namespace: string
    ForceRefresh: boolean
}

interface CustomMetadataCountBody {
  OrgInfo: OrgInfo
  Query: string
  ForceRefresh: boolean
}

export const postQuery = async (
    req: Request<unknown, unknown, CustomMetadataRequestBody>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const errors = validationResult(req as Request)
    if (!errors.isEmpty()) {
      logger.error(`${JSON.stringify(errors.array())}`)
      return res.status(400).json({ errors: errors.array() })
    }
    const {
      OrgInfo: { OrgId },
      Queries,
      Namespace,
      ForceRefresh,
    } = req.body
    const ApiVersion: string =
      req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
    const IsSandbox = !(JWT_AUDIENCE === 'https://login.salesforce.com')
    try{
      var queryResponses : any[][] = []
      //Reach out grab metadata types
      const sfApiClient = await new SfApi(
          SCHEMA_INSTANCE_URL,
          SCHEMA_USER,
          OrgId,
          ApiVersion,
          IsSandbox,
          redis.client,
          req.id,
      )
      sfApiClient.createJsForceConnection()

      var queryResponses : any[][] = await queryForMetadata(Queries, sfApiClient, Namespace)
      
      //logger.debug(`==Final Object: ${queryResponses}`)
      return res.send(queryResponses)
    }catch (err) {
        next(err)
    }
}

export const postSFQuery = async (
  req: Request<unknown, unknown, CustomMetadataRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req as Request)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox } ,
    Queries,
    Namespace,
    ForceRefresh,
  } = req.body
  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try{
    var queryResponses : any[][] = []
    //Reach out grab metadata types
    const sfApiClient = await new SfApi(
      InstanceUrl,
      Username,
      OrgId,
      ApiVersion,
      IsSandbox,
      redis.client,
      req.id,
    )
    sfApiClient.createJsForceConnection()

    var queryResponses : any[][] = await queryForMetadata(Queries, sfApiClient, Namespace)
    
    //logger.debug(`==Final Object: ${queryResponses}`)
    return res.send(queryResponses)
  }catch (err) {
      next(err)
  }
}
export const postCountQuery = async (
  req: Request<unknown, unknown, CustomMetadataCountBody>,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req as Request)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId },
    Query,
    ForceRefresh,
  } = req.body
  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  const IsSandbox = !(JWT_AUDIENCE === 'https://login.salesforce.com')
  try{
    var totalSize = 0
    //Reach out grab metadata types
    const sfApiClient = await new SfApi(
        SCHEMA_INSTANCE_URL,
        SCHEMA_USER,
        OrgId,
        ApiVersion,
        IsSandbox,
        redis.client,
        req.id,
    )
    sfApiClient.createJsForceConnection()

    var result = await sfApiClient.query(Query)
    if (result) {
      totalSize = result.totalSize
    }
    
    logger.debug(`==Got count: ${totalSize}`)
    return res.send(''+totalSize)
  }catch (err) {
      next(err)
  }
}

async function queryForMetadata(queries : string[], sfApiClient: SfApi, namespace : string) : Promise<any[][]> {
  var queryResponses : any[][] = []
  for (const query of queries) {
      logger.debug(`==Query: ${query}`)
      var metaRecords: any[] = []
      var result = await sfApiClient.query(query)
      if (result && result.records) {
        result.records.forEach((rec: any) => {
          let formattedObj : {[k: string]: any} = {}
          // delete rec['attributes'];
          for (const property in rec) {
            if(property !== 'attributes'){
              var propValue = rec[property]
              var propName : string = (property.endsWith('__c') || property.includes('__r')) ? namespace + property : property
              //Check inner objects (relationship query) and modify those
              if(property.endsWith('__r')){
                let innerObj : {[k: string]: any} = {}
                for(const innerProp in propValue){
                  var innerPropName : string  = (innerProp.endsWith('__c') || innerProp.includes('__r')) ? namespace + innerProp : innerProp
                  innerObj[`${innerPropName}`] = propValue[innerProp]
                }
                propValue = innerObj
              }
              formattedObj[`${propName}`] = propValue
            }
          }
          metaRecords.push(formattedObj)
        })
      }
      queryResponses.push(metaRecords)
  }
  return queryResponses
}

/** 
async function getMetrics(params:Metric) {
  // Example usage
const metricsToMonitor: Metric[] = [
  {
      type: 'number',
      endpoint: 'https://api.example.com/sales',
      rationale: 'Total Sales',
  },
  {
      type: 'threshold',
      endpoint: 'https://api.example.com/temperature',
      threshold: 30,
      rationale: 'High Temperature Alert',
  },
  {
      type: 'grouping',
      endpoint: 'https://api.example.com/products',
      groupBy: 'category',
      rationale: 'Products by Category',
  },
]

const metricsSystem = new MetricsSystem(metricsToMonitor)
metricsSystem.analyzeMetrics()
}*/
