import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { SfApi } from '../../util/sfApi'
import * as redis from '../services/redis'
import logger from '../../util/logger'
import { SALESFORCE_API_VERSION, PACKAGE_ID, LATEST_VERSION_NUMBER, LATEST_VERSION_ID, MINIMUM_SUPPORTED_VERSION_NUMBER } from '../../util/secrets'

const PACKAGE_TOOLING_QUERY  = `SELECT SubscriberPackageId, SubscriberPackageVersion.Id, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage WHERE SubscriberPackageId = `
const PACKAGE_INSTALL_LINK  = `/packaging/installPackage.apexp?p0=`

export const checkPackageVersion = async (
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
    const result : any = {}

    //Create connection
    sfApiClient.createJsForceConnection()

    //Query for current Package
    const fullToolingQuery = PACKAGE_TOOLING_QUERY + `'${PACKAGE_ID}'`
    const toolingQueryResult = await sfApiClient.getToolingQuery(fullToolingQuery)

    if(toolingQueryResult){
        const toolingRecords : any[] = toolingQueryResult.records
        //Grab 1st entry
        const currentPackageInfo : any = toolingRecords[0]

        const currentPackageVersion : any = currentPackageInfo['SubscriberPackageVersion']
        const currentVersionNumber = `${currentPackageVersion['MajorVersion']}.${currentPackageVersion['MinorVersion']}.${currentPackageVersion['PatchVersion']}.${currentPackageVersion['BuildNumber']}`

        //Compare version numbers (if currentVersionNumber is lower, compare to "minimum" version and create update object)
        if(currentVersionNumber.localeCompare(LATEST_VERSION_NUMBER, undefined, { numeric: true, sensitivity: 'base' }) === -1){
            result['url'] =  InstanceUrl + PACKAGE_INSTALL_LINK + LATEST_VERSION_ID
            result['severity'] = (currentVersionNumber.localeCompare(MINIMUM_SUPPORTED_VERSION_NUMBER, undefined, { numeric: true, sensitivity: 'base' }) === -1) ? 'high' : 'low'
        }
    }else{
        //No package found
        logger.debug(`No package found for ${PACKAGE_ID}`)
    }

    //Return install url if outdated, else return nothing
    return res.send(result)
    
  } catch (err) {
    next(err)
  }
}