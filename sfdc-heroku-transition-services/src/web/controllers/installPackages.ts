import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import logger from '../../util/logger'
import { SALESFORCE_API_VERSION } from '../../util/secrets'
import { OrgInfo } from '../services/api'
import packageInstallQueue from '../services/packageInstallQueue'

interface InstallPackagesRequestBody {
  OrgInfo: OrgInfo
  AssessmentId: string
  Packages: InstallPackage[]
  Namespace: string
}

interface InstallPackage {
  Name: string
  VersionId: string
}

export const postPackageInstall = async (
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
    body: { OrgInfo, Packages, Namespace, AssessmentId },
  } = req as Request<unknown, unknown, InstallPackagesRequestBody>
  OrgInfo.ApiVersion = OrgInfo.ApiVersion || SALESFORCE_API_VERSION
  try {
    const messageId = await new Promise((resolve, reject) =>
      packageInstallQueue.client.send(
        JSON.stringify({
          OrgInfo,
          Packages,
          Namespace: Namespace ? Namespace : '',
          AssessmentId,
          RequestId: req.id,
        }),
        (err, messageId) => (err ? reject(err) : resolve(messageId)),
      ),
    )
    return res.send(messageId)
  } catch (error) {
    next(error)
  }
}
