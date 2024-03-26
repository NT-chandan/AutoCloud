import { AxiosError } from 'axios'
import { RedisClient } from 'redis'
import RSMQWorker from 'rsmq-worker'
import logger from '../../util/logger'
import { SfApi } from '../../util/sfApi'
import { Sfdx } from '../../util/sfdx'
import {
  QUEUE_INTERVAL,
  SALESFORCE_CLIENT_ID,
  SALESFORCE_KEY_FILE,
} from '../../util/secrets'

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
  Packages: { Name: string; VersionId: string }[]
  RequestId: string
}

enum InstallPackageStatus {
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

interface InstallRecordData {
  status: InstallPackageStatus
  error?: string
}

const REDIS_WORKER_QUEUE_NAME = 'packageInstallQueue'
const SF_ASSESSMENT_OBJECT = 'Assessment__c'
const SF_RECORD_STATUS_JSON = 'InstallDataJSON__c'

class PackageInstallQueue {
  client!: RSMQWorker.Client
  start(redis: RedisClient) {
    this.client = new RSMQWorker(REDIS_WORKER_QUEUE_NAME, {
      redis,
      autostart: true,
      timeout: 6 * 60 * 60 * 1000, // NOTE: 6hr timeout
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // NOTE: interval DOES except number | number[] but the @types definition have not been updated
      //  https://github.com/mpneuried/rsmq-worker/blob/master/README.md#options-interval
      interval: QUEUE_INTERVAL,
    })
    this.client.on('message', async function (msg, next, id) {
      const {
        OrgInfo: { Username, OrgId, InstanceUrl, IsSandbox, ApiVersion },
        Packages,
        Namespace,
        RequestId,
        AssessmentId,
      } = JSON.parse(msg) as MessageObj
      let recordData: InstallRecordData = {
        status: InstallPackageStatus.SUCCESS,
      }
      try {
        logger.debug(`[${REDIS_WORKER_QUEUE_NAME}:${id}] ${msg}`, RequestId)
        const sfdx = new Sfdx(
          SALESFORCE_CLIENT_ID,
          Username,
          IsSandbox ? 'https://test.salesforce.com' : InstanceUrl,
          SALESFORCE_KEY_FILE,
          OrgId,
        )
        await sfdx.login()
        for (const Package of Packages) {
          try {
            logger.debug(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Installing Package: ${JSON.stringify(
                Package,
              )}...`,
              RequestId,
            )
            const response = await sfdx.installPackage(Package.VersionId)
            logger.debug(
              `[${REDIS_WORKER_QUEUE_NAME}:${id}] Successfully Installed Package: ${JSON.stringify(
                response,
              )}`,
              RequestId,
            )
          } catch (error) {
            if (error instanceof Error) {
              logger.error(error, RequestId)
              logger.debug(
                `[${REDIS_WORKER_QUEUE_NAME}:${id}] Error Installing Package: ${JSON.stringify(
                  Package,
                )}`,
                RequestId,
              )
              recordData = {
                status: InstallPackageStatus.ERROR,
                error: error.message,
              }
            }
            break
          }
        }
        logger.debug('Finished installing package(s)', RequestId)
        await sfdx.logout()
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
        await sfApi.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_RECORD_STATUS_JSON}`]:
              JSON.stringify(recordData),
          },
        )
        //ACK MQ
        next()
      } catch (error) {
        if (error instanceof Error) {
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
        
        try {
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
          await sfApi.updateRecordData(
            `${Namespace}${SF_ASSESSMENT_OBJECT}`,
            AssessmentId,
            {
              [`${Namespace}${SF_RECORD_STATUS_JSON}`]: JSON.stringify(
                error.message ||
                  'An error occurred while attempting to install the deployment package.',
              ),
            },
          )
        } catch (error) {
          if (error instanceof Error) {
          logger.error(error.stack || error.message || error)
          }
        }
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

export default new PackageInstallQueue()
