import { readFileSync, writeFileSync } from 'fs'
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import * as crypto from 'crypto'
// NOTE: this complains about no form-data types even though they are installed
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import FormData from 'form-data'
import jwt, { SignOptions } from 'jsonwebtoken'
import { RedisClient } from 'redis'
import Stream from 'stream'
import { decrypt, encrypt } from './crypto'
import logger from './logger'
import url from 'url'
import {ReadMapDefinitions} from './metadataTypes'
import {
  PROXY_URL,
  SALESFORCE_CLIENT_ID,
  SALESFORCE_API_VERSION,
  SALESFORCE_KEY,
  SALESFORCE_KEY_FILE,
  SALESFORCE_KEY_STRING,
  SALESFORCE_PRIVATE_KEY_PASSPHRASE,
  ERROR_METADATA_TTL
} from './secrets'

import jsforce, {
  Connection,
  DescribeSObjectResult,
  Job,
  QueryResult,
} from 'jsforce'
import { forceArray } from './general'

export const PRIVATE_KEY = SALESFORCE_KEY_STRING
  ? SALESFORCE_KEY_STRING
  : readFileSync(`/app/certs/${SALESFORCE_KEY}`, 'utf8')

const SF_API_VERSION = SALESFORCE_API_VERSION
const DEFAULT_CHUNK_SIZE = 10
const DEFAULT_CONCURRENT_API_LIMIT = 20

let tempErrorMetadataList : string[]

const PROXY_URL_DATA = url.parse(PROXY_URL)
const AXIOS_PROXY = PROXY_URL
  ? {
      host:
        PROXY_URL_DATA.host?.substring(0, PROXY_URL_DATA.host?.indexOf(':')) ||
        '',
      port: parseInt(PROXY_URL_DATA.port || ''),
      auth: {
        username: PROXY_URL_DATA.auth?.split(':')[0] || '',
        password: PROXY_URL_DATA.auth?.split(':')[1] || '',
      },
    }
  : false

// Create unencrypted RSA private key
const privateKey = crypto
  .createPrivateKey({
    key: PRIVATE_KEY,
    format: 'pem',
    passphrase: SALESFORCE_PRIVATE_KEY_PASSPHRASE,
  })
  .export({
    format: 'pem',
    type: 'pkcs1',
  })
writeFileSync(SALESFORCE_KEY_FILE, privateKey)
export const getToken = async (
  clientId: string,
  privateKey: jwt.Secret,
  userName: string,
  instanceUrl?: string,
): Promise<string> => {
  const options: SignOptions = {
    issuer: clientId,
    audience: instanceUrl
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com',
    expiresIn: 3 * 60,
    algorithm: 'RS256',
  }

  const token = jwt.sign({ prn: userName }, privateKey, options)
  const formData = new FormData()
  formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  formData.append('assertion', token)
  const {
    data: { access_token },
  } = await axios.post(
    instanceUrl
      ? `${instanceUrl}/services/oauth2/token`
      : 'https://login.salesforce.com/services/oauth2/token',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
      },
      proxy: AXIOS_PROXY,
    },
  )
  return access_token
}

interface QueryResponse {
  id: string
  operation: Operation
  object: string
  createdById: string
  createdDate: Date
  systemModstamp: Date
  state: JobState
  concurrencyMode: ConcurrencyMode
  contentType: ContentType
  apiVersion: string
  lineEnding: LineEnding
  columnDelimiter: 'COMMA'
}

export enum Operation {
  QUERY = 'query',
  QUERY_ALL = 'queryAll',
}

export enum JobState {
  UPLOAD_COMPLETE = 'UploadComplete',
  IN_PROGRESS = 'InProgress',
  ABORTED = 'Aborted',
  JOB_COMPLETE = 'JobComplete',
  FAILED = 'Failed',
}

export enum ConcurrencyMode {
  PARALLEL = 'Parallel',
}

export enum ContentType {
  CSV = 'CSV',
}

export enum LineEnding {
  LF = 'LF',
  CRLF = 'CRLF',
}

export enum ColumnDelimiter {
  BACK_QUOTE = 'BACKQUOTE',
  CARET = 'CARET',
  COMMA = 'COMMA',
  PIPE = 'PIPE',
  SEMI_COLON = 'SEMICOLON',
  TAB = 'TAB',
}

export interface ToolingQueryRecords {
  attributes?: { type: string; url: string }
}

export interface ToolingQueryResponse<T> {
  size: number
  totalSize: number
  done: boolean
  queryLocator?: string
  entityTypeName: string
  nextRecordsUrl: string
  records: (T & ToolingQueryRecords)[]
}

export interface InstalledSubscriberPackage {
  Id: string
  SubscriberPackage: SubscriberPackage
  SubscriberPackageVersion: SubscriberPackageVersion
}

export interface SubscriberPackage {
  Name: string
}

export interface SubscriberPackageVersion {
  MajorVersion: number
  MinorVersion: number
  PatchVersion: number
  BuildNumber: number
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PATH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

interface CompositeRequestObj<T> {
  method: HttpMethod
  url: string
  referenceId?: string
  body?: T
}

interface CompositeResponseBodySuccess {
  id: string
  success: boolean
  errors: unknown[]
  records: unknown[]
}

interface CompositeResponseBodyError {
  message: string
  errorCode: string
  fields: string[]
}

interface CompositeResponseBody {
  compositeResponse: {
    body: CompositeResponseBodySuccess | CompositeResponseBodyError[]
    httpHeaders: {
      Location: string
    }
    httpStatusCode: number
    referenceId: string
  }[]
}

export type DescribeSObjectResultMap = {
  [key: string]: DescribeSObjectResult
}

export class SfApi {
  client: AxiosInstance
  redis!: RedisClient
  username: string
  orgId: string
  apiVersion: string
  isSandbox!: boolean
  assessmentId!: string
  namespace!: string
  instanceUrl: string
  messageId!: string
  jsforceConn!: Connection
  accessToken!: string
  errorMetadata: any
  constructor(
    instanceUrl: string,
    username: string,
    orgId: string,
    apiVersion: string,
    isSandbox?: boolean,
    redis?: RedisClient,
    messageId?: string,
    assessmentId?: string,
    namespace?: string,
  ) {
    this.username = username
    this.orgId = orgId
    this.apiVersion = apiVersion
    this.instanceUrl = instanceUrl
    this.client = axios.create({
      baseURL: `${instanceUrl}/services/data/v${apiVersion}`,
      proxy: AXIOS_PROXY,
    })
    this.errorMetadata = {}
    // Request interceptor
    this.client.interceptors.request.use((req) => {
      // Logging
      logger.debug(
        `[SfApi] [HTTP Client - REQUEST] ${req.method?.toUpperCase()} ${
          req.baseURL
        }${req.url}`,
        this.messageId,
      )
      return req
    })
    // Response interceptor
    this.client.interceptors.response.use(
      (res) => {
        // Logging
        logger.debug(
          `[SfApi] [HTTP Client - RESPONSE] ${res.request.method?.toUpperCase()} ${
            res.config.baseURL
          }${res.config.url} responded with ${res.status}: ${res.statusText}`,
          this.messageId,
        )
        return res
      },
      async (error) => {
        // FSCTA-1420: log errors, response and config when available
        logger.error( error.message, this.messageId )
        if( error.response ) {
          logger.debug( error.response, this.messageId )
        } else {
          if( error.request ) {
            logger.debug( error.request, this.messageId )
          }
        }
        if (isSandbox) {
          logger.debug(error.config, this.messageId)
        }
        const originalRequest = error.config
        // Handle expired access token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          try {
            // Attempt to refresh and update access token
            await this.setAccessToken()
            originalRequest.headers[
              'Authorization'
            ] = `Bearer ${this.accessToken}`
          } catch (error) {
            // If refresh fails then we should really get outta here
            return Promise.reject(error)
          }
          // Retry original request
          return this.client(originalRequest)
        }
        return Promise.reject(error)
      },
    )
    if (redis) this.redis = redis
    if (assessmentId) this.assessmentId = assessmentId
    if (namespace) this.namespace = namespace
    if (messageId) this.messageId = messageId
    if (isSandbox) this.isSandbox = isSandbox
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (async () => {
      await this.updateAccessToken()
      return this
    })()
  }

  createJsForceConnection(): void {
    logger.debug(
      `[SfApi] [JsForce] Creating connection ${this.username}:${this.orgId}:${this.instanceUrl}`,
      this.messageId,
    )
    this.jsforceConn = new jsforce.Connection({
      instanceUrl: this.instanceUrl,
      accessToken: this.accessToken,
      version: this.apiVersion,
    })
    this.jsforceConn.metadata.pollTimeout = 120000 // 120seconds
    this.jsforceConn.on('refresh', (accessToken) => {
      logger.debug(
        `[SfApi] [JsForce] Refreshing token for ${this.username}:${this.orgId}:${this.instanceUrl}`,
        this.messageId,
      )
      this.accessToken = accessToken
    })
  }
  async updateAccessToken(): Promise<void> {
    let accessToken = ''

    // Try to fetch from Redis cache first
    try {
      const orgDataStr: string | null = await new Promise((resolve, reject) => {
        this.redis.get(this.username, (err, data) => {
          if (err) reject(err)
          resolve(data)
        })
      })
      if (orgDataStr) {
        const orgDataObj: {
          Username: string
          OrgId: string
          AssessmentId: string
          InstanceUrl: string
          AccessToken: { iv: string; content: string }
        } = JSON.parse(orgDataStr)
        accessToken = decrypt({ ...orgDataObj.AccessToken })
      }
    } catch (err) {
      logger.warn(
        `[SfApi] Failed to fetch cached access token ${err}`,
        this.messageId,
      )
    }

    if (accessToken) {
      logger.debug(
        `[SfApi] Fetched cached access token ${this.username}:${this.orgId}:${this.instanceUrl}`,
        this.messageId,
      )
      this.accessToken = accessToken
      // Update axios client instance header
      this.client.defaults.headers.common = {
        Authorization: `Bearer ${accessToken}`,
      }
      return
    }

    logger.debug(
      `[SfApi] Requesting access token for ${this.username}:${this.orgId}:${this.instanceUrl}`,
      this.messageId,
    )
    await this.setAccessToken()
  }

  setAccessToken = async (): Promise<void> => {
    // Fetch token
    const accessToken = await getToken(
      SALESFORCE_CLIENT_ID,
      {
        key: PRIVATE_KEY,
        passphrase: SALESFORCE_PRIVATE_KEY_PASSPHRASE,
      },
      this.username,
      this.isSandbox ? this.instanceUrl : undefined,
    )

    this.accessToken = accessToken
    // Update axios client instance header
    this.client.defaults.headers.common = {
      Authorization: `Bearer ${accessToken}`,
      
    }

    // Update redis entry
    if (this.redis) {
      this.redis.setex(
        this.username,
        60 * 60,
        JSON.stringify({
          Username: this.username,
          OrgId: this.orgId,
          AssessmentId: this.assessmentId,
          InstanceUrl: this.instanceUrl,
          AccessToken: encrypt(accessToken),
        }),
      )
    }
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/query_create_job.htm
  postJobQuery = async (query: string): Promise<QueryResponse> =>
    (
      await this.client.post('/tooling/jobs/query', {
        operation: 'query',
        query,
      })
    ).data

  // https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/query_get_one_job.htm
  getJobQuery = async (id: string): Promise<QueryResponse> =>
    (await this.client.get(`/tooling/jobs/query/${id}`)).data

  // https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/query_get_job_results.htm
  getJobResult = async <T>(id: string, locator?: string): Promise<T[]> => {
    const url = locator
      ? `/tooling/jobs/query/${id}/results?locator=${locator}`
      : `/tooling/jobs/query/${id}/results`
    //try {
      const results: T[] = []
      const { data, headers } = await this.client.get(url)
      // Convert csv string body in the response to an array of objects
      results.push(...csvStrToObj<T>(data))
      if (headers['sforce-locator'] !== 'null') {
        results.push(
          ...(await this.getJobResult<T>(id, headers['sforce-locator'])),
        )
      }
      return results
    //} catch (err) {
    //  throw err
    //}
  }

  // Create job query, poll and return results
  async queryJobWithResults<T>(query: string): Promise<T[]> {
    const JOB_TIMEOUT = 5 * 1000 // How many seconds to wait between job state polling
    let jobCreate
    try {
      jobCreate = await this.postJobQuery(query)
    } catch (err) {
      if (err instanceof Error) {
        logger.error(
          `[SfApi] Error Posting Job Query '${query}': ${err.message}`,
          this.messageId,
        )
      } else {
        console.log('Unexpected error', err)
      }
      throw err
    }
    const jobId = jobCreate.id
    let state = jobCreate.state
    logger.debug(`[SfApi] Job created ${jobId}:${state}`, this.messageId)
    while (state !== JobState.JOB_COMPLETE) {
      state = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const { state } = await this.getJobQuery(jobId)
            resolve(state)
          } catch (err) {
            reject(err)
          }
        }, JOB_TIMEOUT)
      })
      logger.debug(`[SfApi]Job ${jobId} State: ${state}`, this.messageId)
    }
    return await this.getJobResult<T>(jobId)
  }

  // NOTE: currently using 'locator' / SOQL OFFSET clause is NOT supported by the dependencies API and will return a 400 error
  // https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_metadatacomponentdependency.htm
  getToolingQuery = async <T>(
    query: string,
  ): Promise<ToolingQueryResponse<T>> => {
    const data: ToolingQueryResponse<T> = (
      await this.client.get(`/tooling/query/?q=${encodeURIComponent(query)}`)
    ).data
    data.records.forEach((item) => {
      delete item['attributes']
    })
    return data
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_sobject_describe.htm
  getObjectDescribe = async (
    componentNames: string[],
  ): Promise<DescribeSObjectResultMap> =>
    (
      await Promise.all(
        componentNames.map(
          async (
            componentName,
          ): Promise<AxiosResponse<DescribeSObjectResult>> => {
            return this.client.get(`/sobjects/${componentName}/describe/`)
          },
        ),
      )
    ).reduce(
      (accumulator, response) => ({
        ...accumulator,
        [`${response.data.name}`]: response.data,
      }),
      {} as DescribeSObjectResultMap,
    )

  // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_insert_update_blob.htm
  postContentVersion = async (
    filename: string,
    data: Buffer,
  ): Promise<string> => {
    const formData = new FormData()
    const CRLF = '\r\n'
    const options = {
      header:
        CRLF +
        '--' +
        formData.getBoundary() +
        CRLF +
        'Content-Disposition: form-data; name="entity_content"' +
        CRLF +
        'Content-Type: application/json' +
        CRLF +
        CRLF,
      knownLength: 2,
    }
    formData.append(
      'entity_content',
      JSON.stringify({
        PathOnClient: filename,
      }),
      options,
    )
    formData.append('VersionData', data, {
      filename: filename,
    })
    const {
      data: { id, success, errors },
    } = await this.client.post<{
      id: string
      success: boolean
      errors: string[]
    }>('/sobjects/ContentVersion', formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    if (!success) throw Error(JSON.stringify(errors))
    return id
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm
  compositeRequest = async <T>(
    compositeRequestObjs: CompositeRequestObj<T>[],
    allOrNone = true,
  ): Promise<CompositeResponseBody> => {
    return (
      await this.client.post('/composite', {
        allOrNone,
        compositeRequest: compositeRequestObjs,
      })
    ).data
  }
  query = async <T>(
    query: string,
  ): Promise<ToolingQueryResponse<T>> => {
    const data: ToolingQueryResponse<T> = (
      await this.client.get(`/query/?q=${encodeURIComponent(query)}`)
    ).data
    data.records.forEach((item) => {
      delete item['attributes']
    })
    return data
  }

  /**
   * Fetch all ContentVersion Ids OR the latestOnly ContentVersion Id from a given DocumentId
   * https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm
   * @param {string} documentId - Id of the Document to query
   * @param {boolean} latestOnly - If 'true' will return the latestOnly ContentVersion Id as a 'string'. If 'false' will return
   * all ContentVersion Ids as a string[]
   * @returns {Promise<string[] | string>}
   */
  // TODO: implement nextRecordsUrl for query results over 2000
  getContentVersionIds = async (
    documentId: string,
    latestOnly = false,
  ): Promise<string[] | string> => {
    const records = (
      await this.query<{ Id: string }>(
        `SELECT Id FROM ContentVersion WHERE ContentDocumentId = '${documentId}'${
          latestOnly ? ' AND IsLatest = true' : ''
        }`,
      )
    ).records
    if (latestOnly) {
      const record = records.shift()
      if (record) {
        return record.Id
      } else
        throw Error(
          `Unable to fetch latest ContentVersion Id from  ${documentId}`,
        )
    } else {
      return records.map((records) => records.Id)
    }
  }

  insertFile = async (
    recordId: string,
    filename: string,
    filecontent: Buffer,
  ): Promise<boolean> => {
    // Create ContentVersion file
    logger.debug(
      `[SfApi:insertFile] Create ContentVersion file "${filename}"`,
      this.messageId,
    )
    const contentVersionId = await this.postContentVersion(
      filename,
      filecontent,
    )
    logger.debug(
      `[SfApi:insertFile] Link ContentVersion ${contentVersionId} to SObject record ${recordId}`,
      this.messageId,
    )
    const compositeResults = await this.compositeRequest(
      [
        // Get ContentDocumentId from ContentVersion obj just created
        {
          method: HttpMethod.GET,
          url: `/services/data/v${this.apiVersion}/query/?q=SELECT+Id,+ContentDocumentId+FROM+ContentVersion+WHERE+Id+=+\'${contentVersionId}\'`,
          referenceId: 'refContentVersion',
        },
        // Use ContentDocumentId to link it to the SObject
        {
          method: HttpMethod.POST,
          url: `/services/data/v${this.apiVersion}/sobjects/ContentDocumentLink`,
          referenceId: 'refContentDocumentLink',
          body: {
            ContentDocumentId:
              '@{refContentVersion.records[0].ContentDocumentId}',
            LinkedEntityId: recordId,
          },
        },
      ],
      true,
    )

    let isSuccess = false
    compositeResults.compositeResponse.forEach((response) => {
      // The response body is different depending on the URL used in the composite sub request
      // /query contains 'records'
      // /sobjects contains 'id'
      if ('records' in response.body || 'id' in response.body) {
        isSuccess = true
        logger.debug(
          `[SfApi:insertFile] ContentVersion Successfully Linked to SObject record: ${JSON.stringify(
            response.body,
          )}`,
          this.messageId,
        )
      } else {
        if (response.body.length) {
          throw new Error(JSON.stringify(compositeResults.compositeResponse))
        } else {
          throw Error(
            `Unexpected Results in Composite Response: ${JSON.stringify(
              compositeResults,
            )}`,
          )
        }
      }
    })
    return isSuccess
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_update_fields.htm
  updateRecordData = async (
    objectName: string,
    recordId: string,
    recordData: Record<string, unknown>,
  ): Promise<void> => {
    logger.debug(
      `Updating SF Record /sobjects/${objectName}/${recordId}: ${JSON.stringify(
        recordData,
      )}`,
    )
    await this.client.patch(`/sobjects/${objectName}/${recordId}`, recordData)
  }

  /**
   * Fetch a record and return it as a buffer
   * @param {string} sobject
   * @param {string} recordId
   * @returns {Promise<Buffer>}
   */
  fetchRecord = async (sobject: string, recordId: string): Promise<Buffer> =>
    await new Promise((resolve, reject) => {
      try {
        const data: Uint8Array[] = []
        const writableStream = new Stream.Writable()
        // Put add chunk into the 'data' array
        writableStream._write = (chunk, encoding, next) => {
          data.push(chunk)
          next()
        }
        // When stream ends combine chunks in 'data' array and return as a buffer
        writableStream._final = () => {
          resolve(Buffer.concat(data))
        }
        if (!this.jsforceConn) this.createJsForceConnection()
        this.jsforceConn
          .sobject('ContentVersion')
          .record(recordId)
          .blob('VersionData')
          .pipe(writableStream)
      } catch (error) {
        reject(error)
      }
    })

  //https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_listmetadata.htm
  listMetadata = async (metadataType : string, folder?: string) : Promise<any[]> => {
    // logger.debug(
    //   `==START List Metadata for: ${metadataType}`,
    // )
    let finalList : any[] = []
    //Establish jsForce connection, if not already established
    if (!this.jsforceConn) this.createJsForceConnection()
    // this.createJsForceConnection();
    // logger.debug(
    //   `==Connection Established`,
    // )

    //Create expected "types" object for jsForce
    const types = {type: metadataType, folder: (folder===undefined) ? '' : folder!}
    // logger.debug(
    //   `==Params ${JSON.stringify(types)}`,
    // )

    //Call Metadata List
    await this.jsforceConn.metadata.list(types, SF_API_VERSION, function(err: any, metadata: any) {
      if (err) { 
        logger.debug(
          `==ERR | Metadata List | Type: ${metadataType}, Folder: ${folder} |: ${err} | ${metadata}`,
        )
      }else{
        finalList = forceArray(metadata)
        logger.debug(
          `==SUCCESS | Metadata List | Type: ${metadataType}, Folder: ${folder} |: ${err} | ${finalList.length}`,
        )
      }
    })

    // await this.jsforceConn.metadata.list(types, SF_API_VERSION, function(err: any, metadata: any) {
    //   if (!err) { 
    //     logger.debug(
    //       `==ERR | Metadata List | Type: ${metadataType}, Folder: ${folder} |: ${err}`,
    //     )
    //   }else{
    //     finalList = forceArray(metadata)
    //   }
    // }).catch((err: any) => {
    //   logger.debug(
    //     `==ERR | Metadata List | Type: ${metadataType}, Folder: ${folder} |: ${err}`,
    //   )
    // })
    finalList = ReadMapDefinitions(finalList, metadataType, 'list')
    return finalList
  }

  //https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
  readMetadata = async (metadataType : string, fullNames : string[]) : Promise<any[]> => {
    let finalList : any[] = []
    
    //Initialize error cache
    const orgErrorCacheKey : string = 'orgErrorCache:'+this.orgId
    if(this.errorMetadata){
      // this.errorMetadata = this.redis.get(orgErrorCacheKey)
      const errorCacheStr: string | null = await new Promise((resolve, reject) => {
        this.redis.get(orgErrorCacheKey, (err, data) => {
          if (err) reject(err)
          resolve(data)
        })
      })

      if(!errorCacheStr){
        this.errorMetadata = {}
      }else{
        logger.debug(
          `==INFO | ErrorMetadata: ${errorCacheStr}`,
        )
        this.errorMetadata = JSON.parse(errorCacheStr)
        if(Object.keys(this.errorMetadata).length === 0){
          this.errorMetadata = {}
        }
      }
    }else{
      this.errorMetadata = {}
    }

    tempErrorMetadataList = (this.errorMetadata && this.errorMetadata[metadataType]) ? this.errorMetadata[metadataType] : []

    //Establish jsForce connection, if not already established
    if (!this.jsforceConn) this.createJsForceConnection()
    // this.createJsForceConnection();

    //Declare batch size, and chunk out "fullNames" accordingly
    const chunkSize = DEFAULT_CHUNK_SIZE 
    const chunkedNamesList : string[][] = []
    let tempNameChunk : string[] = []
    for (let i = 0; i < fullNames.length; i +=chunkSize) {
      tempNameChunk = fullNames.slice(i, i + chunkSize)
      //Check if in cache
      tempErrorMetadataList.forEach(errorItem => {
        if(tempNameChunk.includes(errorItem)){
          logger.debug(
            `==INFO | Cache Hit - Error Metadata | Type: ${metadataType}| Item: ${errorItem}`,
          )
          tempNameChunk.splice(tempNameChunk.indexOf(errorItem),1)
        }
      })
      chunkedNamesList.push(tempNameChunk)
    }

    //DEBUG ONLY - REMOVE
    // chunkedNamesList.forEach(namesList => {
    //   logger.debug(
    //     `==DEBUG | Metadata Read | Reading Chunk: ${namesList}`,
    //   )
    // });
    //END DEBUG ONLY - REMOVE

    //With chunked list, make callouts to Metadata API (and do it asynchronously if possible)
    const promiseList : Promise<any[]>[] = []
    chunkedNamesList.forEach(chunk => {
      promiseList.push(executeMetadataRead(this.jsforceConn, metadataType, chunk, chunkSize))
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
        `==DEBUG | Metadata Read | Block finished for chunkSize ${chunkSize}`,
      )
    })

    // logger.debug(
    //   `==DEBUG | Metadata Read | Finished ${finalList}`,
    // )
    //Print error cache (if any)
    logger.debug(
      `==Error Metadata? | Type: ${metadataType}|: ${JSON.stringify(tempErrorMetadataList)}`,
    )
    if(tempErrorMetadataList.length > 0){
      this.errorMetadata[metadataType] = tempErrorMetadataList
      logger.debug(
        `==INFO | Record error cache: ${JSON.stringify(this.errorMetadata)}`,
      )
      this.redis.setex(orgErrorCacheKey, ERROR_METADATA_TTL, JSON.stringify(this.errorMetadata))
    }

    return finalList
  }
}


// Convert a csv formatted string to an array of objects
const csvStrToObj = <T>(string: string): T[] => {
  const csvArr = string.trim().split('\n')
  const columnNames = csvArr.splice(0, 1)[0]
  const columnNamesArr = columnNames.split(',').map((columnName: string) => {
    // Remove beginning and ending quotes
    return columnName.slice(1, columnName.length - 1)
  })
  // Generate an array of objects from columns
  return csvArr.map((rowStr: string) =>
    rowStr.split(',').reduce(
      (acc: T, item: string, index) => ({
        ...acc,
        [columnNamesArr[index]]: item.slice(1, item.length - 1), // Remove beginning and ending quotes
      }),
      {} as T,
    ),
  )
}

// Helper function for executing Metadata Read call (is a spearate function to satisfy Promise.all call and separate out for readibility)
async function executeMetadataRead(jsforceConn: Connection,  metadataType : string, fullNames : string[], chunkSize: number) : Promise<any[]> {
  // logger.debug(
  //   `==START executeMetadataRead`,
  // )
  let finalList : any[] = []

  //Metadata API Call
  let hasError  = 0
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
      const chunkedList : string[][] = []
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
    }else{
      //In this case, ignore Metadata and add it to the org's "error cache" list
      tempErrorMetadataList.push(fullNames[0])
    }
  }
  finalList = ReadMapDefinitions(finalList, metadataType, 'read')
  return finalList
}
