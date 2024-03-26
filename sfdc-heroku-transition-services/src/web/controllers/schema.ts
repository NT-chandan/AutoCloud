import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { DescribeSObjectResultMap, SfApi } from '../../util/sfApi'
import * as redis from '../services/redis'
import logger from '../../util/logger'
import { DescribeSObjectResult } from 'jsforce'
import {
  SALESFORCE_API_VERSION,
  SCHEMA_DESCRIBE_TTL,
  SCHEMA_INSTANCE_URL,
  SCHEMA_USER,
} from '../../util/secrets'
import { OrgInfo } from '../services/api'

const schemaKey = (
  InstanceUrl: string,
  ApiVersion: string,
  componentName: string,
) => `schema:describe${InstanceUrl}::${ApiVersion}:${componentName}`

interface SchemaDescribeRequestBody {
  OrgInfo: OrgInfo
  ComponentNames: string[]
  ForceRefresh: boolean
}

export const postDescribe = async (
  req: Request<unknown, unknown, SchemaDescribeRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const errors = validationResult(req as Request)
  if (!errors.isEmpty()) {
    logger.error(`${JSON.stringify(errors.array())}`)
    return res.status(400).json({ errors: errors.array() })
  }
  const {
    OrgInfo: { OrgId, IsSandbox },
    ComponentNames,
    ForceRefresh,
  } = req.body
  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try {
    let describeSObjMap = {}
    if (!ForceRefresh) {
      // Check for cached Schema Describe Components
      const describeSObjArray: DescribeSObjectResult[] = []
      await Promise.all(
        ComponentNames.map(
          (componentName: string) =>
            new Promise<void | DescribeSObjectResult>((resolve, reject) =>
              redis.client.get(
                schemaKey(SCHEMA_INSTANCE_URL, ApiVersion, componentName),
                (err, data) => {
                  if (err) reject(err)
                  if (data)
                    describeSObjArray.push(
                      JSON.parse(data) as DescribeSObjectResult,
                    )
                  resolve()
                },
              ),
            ),
        ),
      )
      if (describeSObjArray.length) {
        // Convert array of cached schema described objects to a map
        describeSObjMap = describeSObjArray.reduce<DescribeSObjectResultMap>(
          (accumulator, item) => ({
            ...accumulator,
            [`${item.name}`]: item,
          }),
          {},
        )
        logger.debug(
          `Retrieved cached Schema DescribeSObject(s): ${Object.keys(
            describeSObjMap,
          )}`,
        )
        // Remove ComponentNames from req.body.ComponentNames that were cached
        Object.keys(describeSObjMap).forEach((key) => {
          const index = ComponentNames.indexOf(key)
          if (index !== -1) {
            ComponentNames.splice(index, 1)
          }
        })
      }
    }

    // Fetch non-cached ComponentNames
    if (ComponentNames.length) {
      logger.debug(
        `${
          ForceRefresh ? 'Forcing refresh of' : 'Fetch uncached'
        } Schema DescribeSObject(s): ${ComponentNames}`,
      )
      const sfApiClient = await new SfApi(
        SCHEMA_INSTANCE_URL,
        SCHEMA_USER,
        OrgId,
        ApiVersion,
        IsSandbox,
        redis.client,
        req.id,
      )
      // Fetch objects
      const objDescribe = await sfApiClient.getObjectDescribe(ComponentNames)
      // Cache newly fetched objects
      for (const [key, value] of Object.entries(objDescribe)) {
        redis.client.setex(
          schemaKey(SCHEMA_INSTANCE_URL, ApiVersion, key),
          SCHEMA_DESCRIBE_TTL,
          JSON.stringify(value),
        )
      }
      // Combine cached objects with fetched objects
      describeSObjMap = { ...describeSObjMap, ...objDescribe }
    }
    return res.send(describeSObjMap)
  } catch (err) {
    next(err)
  }
}
