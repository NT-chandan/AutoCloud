import express, { NextFunction, Request, Response } from 'express'
import { HOST, PORT } from '../../util/secrets'
import { checkSchema, ParamSchema } from 'express-validator'
import { GenerateDocumentType } from '../controllers/generate'
import uuid from 'uuid'
import { AxiosError } from 'axios'
import logger from '../../util/logger'
import httpContext from 'express-http-context'
import xmlParser from 'express-xml-bodyparser'

import * as userController from '../controllers/scan'
import * as toolingController from '../controllers/tooling'
import * as schemaController from '../controllers/schema'
import * as metadataController from '../controllers/metadata'
import * as packageInstallController from '../controllers/installPackages'
import * as generate from '../controllers/generate'
import * as deploy from '../controllers/deploy'
import * as loggerController from '../controllers/systemLogger'
import * as packageVersionController from '../controllers/packageVersion'
import * as customMetadataController from '../controllers/customMetadata'

// Create Express server
const api = express()
// Express configuration
api.set('port', PORT)
api.set('host', HOST)
api.use(express.json({ limit: '10mb' }))
api.use(xmlParser())
api.use(express.urlencoded({ extended: true }))
api.use(httpContext.middleware)

// Create a x-request-id header if not present for easier log tracing
api.use((req, res, next) => {
  const requestId = req.headers['x-request-id']
    ? (req.headers['x-request-id'] as string)
    : uuid.v4()
  req.headers['x-request-id'] = requestId
  res.setHeader('X-Request-ID', requestId)
  httpContext.set('requestId', requestId)
  req.id = requestId
  next()
})

api.use((req: Request, res: Response, next: NextFunction) => {
  const { method, path, body, headers, httpVersion } = req
  const referer = headers['referer'] || '-'
  const userAgent = headers['user-agent'] || '-'
  logger.info(
    `[express] ${method} ${path} HTTP/${httpVersion} ${JSON.stringify(
      body,
    )} "${referer}" "${userAgent}" ${res.statusCode}`,
  )
  next()
})
/**
 * Primary api routes.
 */
const OrgInfoBody: Record<string, ParamSchema> = {
  'OrgInfo.OrgId': {
    isString: true,
    notEmpty: true,
  },
  'OrgInfo.Username': {
    isString: true,
    notEmpty: true,
  },
  'OrgInfo.InstanceUrl': {
    isURL: {
      options: {
        protocols: ['https', 'http'],
        require_host: true,
        require_protocol: true,
      },
    },
    notEmpty: true,
  },
  'OrgInfo.IsSandbox': {
    isBoolean: true,
    optional: { options: { nullable: true } },
  },
  'OrgInfo.ApiVersion': {
    isString: true,
    optional: { options: { nullable: true } },
  },
}

export interface OrgInfo {
  OrgId: string
  Username: string
  InstanceUrl: string
  IsSandbox?: boolean
  ApiVersion?: string
}

// Health check
api.get('/', (req, res) => res.send())

api.post(
  '/scan',
  checkSchema(
    {
      ...OrgInfoBody,
      AssessmentId: {
        isString: true,
        notEmpty: true,
      },
      Namespace: {
        isString: true,
      },
    },
    ['body'],
  ),
  userController.postScan,
)

api.post(
  '/tooling/query',
  checkSchema(
    {
      ...OrgInfoBody,
      Query: {
        isString: true,
        notEmpty: true,
      },
    },
    ['body'],
  ),
  toolingController.postQuery,
)
api.post(
  '/query',
  checkSchema(
    {
      ...OrgInfoBody,
      Query: {
        isString: true,
        notEmpty: true,
      },
    },
    ['body'],
  ),
  customMetadataController.postSFQuery,
)
api.post(
  '/schema/describe',
  checkSchema({
    'OrgInfo.OrgId': {
      isString: true,
      notEmpty: true,
    },
    'OrgInfo.IsSandbox': {
      isBoolean: true,
      optional: { options: { nullable: true } },
    },
    'OrgInfo.ApiVersion': {
      isString: true,
      optional: { options: { nullable: true } },
    },
    ComponentNames: {
      isArray: true,
      notEmpty: true,
    },
    ComponentType: {
      isString: true,
      notEmpty: true,
    },
    ForceRefresh: {
      isBoolean: true,
      optional: true,
    },
  }),
  schemaController.postDescribe,
)

api.post(
  '/metadata/read',
  checkSchema(
    {
      ...OrgInfoBody,
      ComponentNames: {
        isArray: true,
        notEmpty: true,
      },
      ComponentType: {
        isString: true,
        notEmpty: true,
      },
    },
    ['body'],
  ),
  metadataController.postRead,
)

api.post(
  '/metadata/list',
  checkSchema(
    {
      ...OrgInfoBody,
      ComponentTypes: {
        isArray: true,
        notEmpty: true,
      },
    },
    ['body'],
  ),
  metadataController.postList,
)

api.post(
  '/describeMetadata',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  metadataController.getMetadataDescribe,
)

api.post(
  '/getReportConfig',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  metadataController.getReportConfig,
)

api.post(
  '/saveReportConfig',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  metadataController.saveReportConfig,
)

api.post(
  '/generateDocument',
  checkSchema(
    {
      Content: {
        optional: {
          options: {
            nullable: false,
          },
        },
      },
      AnalysisDocumentId: {
        isString: true,
        optional: true,
      },
      Url: {
        isURL: {
          options: {
            protocols: ['https', 'http'],
            require_host: true,
            require_protocol: true,
          },
        },
        optional: true,
      },
      Type: {
        isIn: {
          options: [Object.values(GenerateDocumentType)],
          errorMessage: `Must be of type(s) [${Object.values(
            GenerateDocumentType,
          ).map((type) => `'${type}'`)}]`,
        },
      },
      AssessmentId: {
        isString: true,
        optional: true,
      },
      Namespace: {
        isString: true,
        optional: true,
      },
    },
    ['body'],
  ),
  generate.postDocument,
)

api.post(
  '/installPackages',
  checkSchema(
    {
      ...OrgInfoBody,
      AssessmentId: {
        isString: true,
      },
      Packages: {
        isArray: true,
        notEmpty: true,
      },
      'Packages.*.VersionId': {
        isString: true,
      },
      'Packages.*.Name': {
        isString: true,
      },
      Namespace: {
        isString: true,
        optional: true,
      },
    },
    ['body'],
  ),
  packageInstallController.postPackageInstall,
)

api.post(
  '/generateDeploymentPackage',
  checkSchema(
    {
      ...OrgInfoBody,
      DeploymentChecklistFileId: {
        isString: true,
      },
      AssessmentId: {
        isString: true,
        optional: true,
      },
      Namespace: {
        isString: true,
        optional: true,
      },
    },
    ['body'],
  ),
  generate.postDeploymentPackage,
)

api.post(
  '/deployPackage',
  checkSchema(
    {
      ...OrgInfoBody,
      PackageFileId: {
        isString: true,
      },
      AssessmentId: {
        isString: true,
        optional: true,
      },
      Namespace: {
        isString: true,
        optional: true,
      },
    },
    ['body'],
  ),
  deploy.postPackage,
)

api.post(
  '/hasLatestPackageVersion',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  packageVersionController.checkPackageVersion,
)

api.post(
  '/getCustomMetadata',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  customMetadataController.postQuery,
)

api.post(
  '/getCustomMetadataCount',
  checkSchema(
    {
      ...OrgInfoBody
    },
    ['body'],
  ),
  customMetadataController.postCountQuery,
)

api.post('/systemLogger', loggerController.postSystemLogger)

// Note: even though 'next' isn't technically used, this handler will not work if it is not defined
// eslint-disable-next-line @typescript-eslint/no-unused-vars
api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack)
  if ('isAxiosError' in err) {
    const { request, response, message } = err as AxiosError
    const errorObj = {
      message: `${request.method} ${request.res.responseUrl} ${message}`,
      error: response && response.data,
    }
    logger.error(errorObj)
    return res.status(response?.status || 500).send(errorObj)
  } else {
    logger.error(err.message)
    return res.status(500).send(err.message)
  }
})

export default api
