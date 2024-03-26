import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { SfApi } from '../../util/sfApi'
import * as redis from '../services/redis'
import logger from '../../util/logger'
import { SALESFORCE_API_VERSION } from '../../util/secrets'

export const postQuery = async (
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
    Query,
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
    return res.send(await sfApiClient.getToolingQuery(Query))
  } catch (err) {
    next(err)
  }
}
