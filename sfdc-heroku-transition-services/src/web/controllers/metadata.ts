import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { SfApi } from '../../util/sfApi'
import * as redis from '../services/redis'
import logger from '../../util/logger'
import { OrgInfo } from '../services/api'
import { forceArray } from '../../util/general'
import { FileProperties, MetadataInfo, Connection } from 'jsforce'
import { SALESFORCE_API_VERSION, CONFIG_TTL } from '../../util/secrets'

// The Max amount of metadata read component names that can be requested at once
const MAX_COMPONENT_NAMES = 10
const DEFAULT_CONCURRENT_API_LIMIT = 25

interface SaveReportConfigurationBody {
  ExcludedSections: string[]
  ExcludedMetadata: string[]
  OrgInfo: OrgInfo
}

export const postRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox },
    ComponentNames,
    ComponentType,
  } = req.body
  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try {
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
    // Split component names up into new promises
    const promises: Promise<MetadataInfo[] | MetadataInfo>[] = []
    const componentNamesCopy = [...ComponentNames]

    //NEW IMPLEMENTATION
    var finalList : any[] = []
    //Declare batch size, and chunk out "fullNames" accordingly
    const chunkSize = MAX_COMPONENT_NAMES 
    var chunkedNamesList : string[][] = []
    var tempNameChunk : string[] = []
    for (let i = 0; i < componentNamesCopy.length; i +=chunkSize) {
      tempNameChunk = componentNamesCopy.slice(i, i + chunkSize)
      chunkedNamesList.push(tempNameChunk)
    }

    //With chunked list, make callouts to Metadata API (and do it asynchronously if possible)
    const promiseList : Promise<any[]>[] = []
    chunkedNamesList.forEach(chunk => {
      promiseList.push(executeMetadataRead(sfApiClient.jsforceConn, ComponentType, chunk, chunkSize))
    })

    await Promise.all(promiseList)
    .then(results => {
      if(results){
        results.forEach(chunk => {
          finalList = finalList.concat(chunk)
        })
      }
    })
    .catch(err => {
      logger.debug(
        `==ERR | Metadata Read Promise | Type: ${ComponentType}|: ${err}`,
      )
    })
    .finally(() => {
      logger.debug(
        `==DEBUG | Metadata Read | Block finished for chunkSize ${chunkSize}`,
      )
    })

    let metadataMap = {}

    //[OLD] Wait for all promises to resolve but let the ones that fail go through 
    //const results = await Promise.all(promises)

    // NOTE: can't use Promise.allSettled because code is es2019 instead of es2020

    // Transform metadata.read() response into map of { fullName: metadataObj, ... }
    finalList.forEach((metadata) => {
      // const metadataJSON = JSON.stringify(metadata)
      // logger.debug(`[metadata.ts] results: ${metadataJSON}`, '')

      if (!metadata || !Object.keys(metadata).length) return
      if ('fullName' in metadata) {
        // Handle MetadataInfo
        metadataMap = { ...metadataMap, [`${metadata.fullName}`]: metadata }
      } else {
        // Handle MetadataInfo[]
        metadataMap = {
          ...metadataMap,
          ...metadata.reduce(
            // Turn MetadataInfo[] into { fullName: metadataObj, ... }
            (accumulator : any, metadata : any) => ({
              ...accumulator,
              [`${metadata.fullName}`]: metadata,
            }),
            {},
          ),
        }
      }
    })

    if (!metadataMap || !Object.keys(metadataMap).length) return res.send({})
    return res.send(metadataMap)
  } catch (err) {
    next(err)
  }
}

export const postList = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox },
    ComponentTypes,
  } = req.body
  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try {
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
    const metadata: FileProperties[] | FileProperties = await new Promise(
      (resolve, reject) => {
        sfApiClient.jsforceConn.metadata.list(
          ComponentTypes.map((component: string) => {
            const index = component.lastIndexOf('/')
            let type = null
            let folder = null
            if (index !== -1) {
              folder = component.substring(0, index)
              type = component.replace(`${folder}/`, '')
            } else {
              type = component
            }
            return {
              type,
              folder,
            }
          }),
          ApiVersion,
          (err, metadata) => {
            if (err) reject(err)
            resolve(metadata)
          },
        )
      },
    )
    if (!Object.keys(metadata).length) return res.send({})

    let metadataMap = {}
    if ('fullName' in metadata) {
      // Handle MetadataInfo
      metadataMap = { [`${metadata.fullName}`]: metadata }
    } else {
      // Handle MetadataInfo[]
      metadataMap = metadata.reduce(
        (accumulator, metadata) => ({
          ...accumulator,
          [`${metadata.fullName}`]: metadata,
        }),
        {},
      )
    }
    return res.send(metadataMap)
  } catch (err) {
    next(err)
  }
}

export const getMetadataDescribe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox }
  } = req.body
  const ApiVersion: string = req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try {
    logger.debug(`Start getMetadataDescribe`)
    const sfApiClient = await new SfApi(
      InstanceUrl,
      Username,
      OrgId,
      ApiVersion,
      IsSandbox,
      redis.client,
      req.id,
    )

    //"Result" will be populated (or not) as function runs
    var metaContainer : {"excludedMetadata" : string[], "metadataList" : any[]} = {"excludedMetadata" : [], "metadataList" : []}
    var nameSet = new Set()
    var result : any[] = []

    //Create connection
    sfApiClient.createJsForceConnection()



    await sfApiClient.jsforceConn.metadata.describe(SALESFORCE_API_VERSION)
    .then((meta : any) => {
      if(meta){
        var resultList : any[] = forceArray(meta)
        logger.debug(`Metadata Count: ${resultList.length}`)
        resultList.forEach(metaResult => {
          var objectList : any[] = forceArray(metaResult.metadataObjects)
          objectList.forEach(metaObject => {
            // logger.debug(`==XML Name: ${metaObject['xmlName']}`)
            nameSet.add(metaObject['xmlName'])
            result.push({"name": metaObject['xmlName'], "metadataId": metaObject['xmlName']})

            //Add any "sub-types"
            if(metaObject['childXmlNames']){
              var childList : string[] = metaObject['childXmlNames']
              childList.forEach(child => {
                nameSet.add(child)
                result.push({"name": child, "metadataId": child})
              })
            }
          })
        })
      }     
    })
    .catch((err : any) => {
        logger.debug(
          `==Metadata Describe Failed: ${err}`,
        )
    })

    //Add StandardEntity if not present in the list
    if(!nameSet.has('StandardEntity')){
      nameSet.add('StandardEntity')
      result.push({"name": 'StandardEntity', "metadataId": 'StandardEntity'})
    }

    //Add meta list to container object
    result = result.sort((a, b) => (a['name'].localeCompare(b['name'])))
    metaContainer.metadataList = result

    return res.send(metaContainer)
    
  } catch (err) {
    next(err)
  }
}

export const getReportConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  try {
    const {
      OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox }
    } = req.body

    logger.debug(`==START getReportConfig`)
    const ApiVersion: string = req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION

    var resultConfig = await new Promise<{"ExcludedSections" : string[], "ExcludedMetadata" : string[]}>((resolve, reject) => {
      redis.client.get('config:'+Username, (err, data) => {
        var result : {"ExcludedSections" : string[], "ExcludedMetadata" : string[]} = {"ExcludedSections" : [], "ExcludedMetadata" : []}
        if (err){
          logger.debug(`==Error getting from Redis: ${err}`,)
        }
        if(data){
          logger.debug(`==Data: ${data}`)
          if(data !== 'nil'){
            result = JSON.parse(data)
          }
        }
        resolve(result)
      })
    })

    return res.status(200).send(resultConfig)
  } catch (error) {
    logger.debug(`==ERROR getReportConfig: ${error}`)
    next(error)
  }
}

export const saveReportConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  try {
    const {
      ExcludedSections,
      ExcludedMetadata,
      OrgInfo: { OrgId, Username, IsSandbox, InstanceUrl }
    } = req.body

    logger.debug(`==START saveReportConfig`)
    const ApiVersion: string = req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION

    logger.debug(`==Sections: ${ExcludedSections}`)
    logger.debug(`==Metadata: ${ExcludedMetadata}`)

    const fullConfig : {"ExcludedSections" : string[], "ExcludedMetadata" : string[]} = {"ExcludedSections" : ExcludedSections, "ExcludedMetadata" : ExcludedMetadata}
    redis.client.setex(
        'config:'+Username,
        CONFIG_TTL,
        JSON.stringify(fullConfig),
    )

    return res.status(201).send('Success')
  } catch (error) {
    next(error)
  }
}

// Helper function for executing Metadata Read call (is a spearate function to satisfy Promise.all call and separate out for readibility) Ported from the original functon in sfApi.ts
async function executeMetadataRead(jsforceConn: Connection,  metadataType : string, fullNames : string[], chunkSize: number) : Promise<any[]> {
  // logger.debug(
  //   `==START executeMetadataRead`,
  // )
  var finalList : any[] = []

  //Metadata API Call
  var hasError  = 0
  await jsforceConn.metadata.read(metadataType, fullNames, function(err: any, metadata: any) {
    // logger.debug(
    //   `==Finished API Call`,
    // )
    if(err){
      // logger.debug(
      //   `==ERR | Metadata Read | Type: ${metadataType}, Chunk: ${fullNames} |: ${err}`,
      // )
      hasError = 1
    }else{
      finalList = forceArray(metadata)
      // logger.debug(
      //   `==Final List: ${finalList}`,
      // )
    }
  }).catch((err: any) => {
    // logger.debug(
    //   `==ERR | Metadata Read CATCH | Type: ${metadataType}, Chunk: ${fullNames} |: ${JSON.stringify(err)}`,
    // )
    hasError = 1
  })

  if(hasError===1){
    //Only split up chunk if > 1
    if(chunkSize!==1){
      //Upon error, split chunk and retry
      const newChunkSize = Math.ceil(chunkSize / 2)
      var chunkedList : string[][] = []
      for (let i = 0; i < fullNames.length; i += newChunkSize) {
        chunkedList.push(fullNames.slice(i, i + newChunkSize))
      }

      //DEBUG ONLY - REMOVE
      // chunkedList.forEach(namesList => {
      //   logger.debug(
      //     `==DEBUG | Metadata Read | Reading Chunk: ${namesList}`,
      //   )
      // });
      //END DEBUG ONLY - REMOVE

      //Create new Promise list with each chunk specified
      const promiseList : Promise<any[]>[] = []
      chunkedList.forEach(chunk => {
        promiseList.push(executeMetadataRead(jsforceConn, metadataType, chunk, newChunkSize))
      })

      await Promise.all(promiseList)
      .then(results => {
        if(results){
          results.forEach(chunk => {
            finalList = finalList.concat(chunk)
          })
        }
      })
      .catch(err => {
        logger.debug(
          `==ERR | Metadata Read Promise | Type: ${metadataType}|: ${err}`,
        )
      })
      .finally(() => {
        logger.debug(
          `==DEBUG | Metadata Read | Block finished for chunkSize ${newChunkSize}`,
        )
      })
    }
  }
  return finalList
}
