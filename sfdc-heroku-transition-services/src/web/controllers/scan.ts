import { Response, Request, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import scanQueue from '../services/scanQueue'
import logger from '../../util/logger'
import { SALESFORCE_API_VERSION } from '../../util/secrets'

export const postScan = async (
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
    AssessmentId,
    Namespace,
    ObjectMapping,
    OverallObjectMapping,
    FieldMapping,
    MappedSections,
    HerokuPostScan,
    PackageType
  } = req.body

  const ApiVersion: string =
    req.body.OrgInfo.ApiVersion || SALESFORCE_API_VERSION

  try {
    const messageId = await new Promise((resolve, reject) =>
      scanQueue.client.send(
        JSON.stringify({
          OrgInfo: { OrgId, Username, InstanceUrl, IsSandbox, ApiVersion },
          AssessmentId,
          Namespace,
          ObjectMapping,
          OverallObjectMapping,
          FieldMapping,
          MappedSections,
          HerokuPostScan,
          PackageType,
          RequestId: req.id,
        }),
        (err, id) => {
          if (err) {
            reject(err)
          }
          resolve(id)
        },
      ),
    )
    return res.status(202).send(messageId)
  } catch (err) {
    next(err)
  }
}
