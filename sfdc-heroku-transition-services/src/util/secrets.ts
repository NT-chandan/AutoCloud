import logger from './logger'
import dotenv from 'dotenv'
import fs from 'fs'
import * as process from 'process'

// Default schema describe cache ttl (seconds)
const SCHEMA_DESCRIBE_TTL_DEFAULT = 7 * 24 * 60 * 60

// Default "error" metadata cache ttl (seconds)
const ERROR_METADATA_TTL_DEFAULT = 14 * 24 * 60 * 60


//Default JWT_Audience (assume Production unless otherwise specified)
const JWT_AUDIENCE_DEFAULT = 'https://login.salesforce.com'

// Default "config" metadata cache ttl (seconds)
const CONFIG_TTL_DEFAULT = 14 * 24 * 60 * 60

// RMSQ Worker wait interval
// https://github.com/mpneuried/rsmq-worker/blob/master/README.md#options-interval
export const QUEUE_INTERVAL = [0, 0.2, 0.5]

// Temp location to store either the SALESFORCE_KEY_STRING or `/app/certs/${SALESFORCE_KEY}`
export const SALESFORCE_KEY_FILE = '/tmp/sfdc_key_decrypted.pem'

if (fs.existsSync('.env')) {
  logger.debug('Using .env file to supply config environment variables')
  dotenv.config({ path: '.env' })
} else {
  logger.error('Unable to locate .env file')
}
export const ENVIRONMENT = process.env.NODE_ENV
export const isProd = ENVIRONMENT === 'production' // Anything else is treated as 'dev'

export const PORT = process.env['PORT'] || ''
if (!PORT) {
  logger.error('No api port. Set PORT environment variable.')
  process.exit(1)
}

export const HTTPS_CERT = process.env['HTTPS_CERT'] || ''
if (!HTTPS_CERT) {
  logger.warn('No HTTPS_CERT specified.')
}

export const HTTPS_KEY = process.env['HTTPS_KEY'] || ''
if (!HTTPS_KEY) {
  logger.warn('No HTTPS_KEY specified.')
}

export const PROXY_URL =
  process.env['PROXY_URL'] || //custom endpoint
  process.env['IPB_HTTP'] || //IP Burger
  process.env['FIXIE_URL'] || //Fixie
  ''
if (PROXY_URL) {
  process.env['HTTP_PROXY'] = PROXY_URL
  logger.info('PROXY_URL specified for routing outbound requests.')
}

export const HOST = process.env['HOST'] || ''
if (!HOST) {
  logger.error('No api host. Set HOST environment variable.')
  process.exit(1)
}

export const DATABASE_URL = process.env['DATABASE_URL'] || ''
if (!DATABASE_URL) {
  logger.warn('No database url. Set DATABASE_URL environment variable.')
}

export const REDIS_URL = process.env['REDIS_URL'] || ''
if (!REDIS_URL) {
  logger.error('No Redis url. Set REDIS_URL environment variable.')
  process.exit(1)
}

export const SALESFORCE_CLIENT_ID = process.env['SALESFORCE_CLIENT_ID'] || ''
if (!SALESFORCE_CLIENT_ID) {
  logger.error(
    'No JS Force Client ID. Set SALESFORCE_CLIENT_ID environment variable.',
  )
  process.exit(1)
}

export const SALESFORCE_PRIVATE_KEY_PASSPHRASE =
  process.env['SALESFORCE_PRIVATE_KEY_PASSPHRASE'] || ''
if (!SALESFORCE_PRIVATE_KEY_PASSPHRASE) {
  logger.error(
    'No JS Force Private Key Passphrase. Set SALESFORCE_PRIVATE_KEY_PASSPHRASE environment variable.',
  )
  process.exit(1)
}

export const SALESFORCE_API_VERSION =
  process.env['SALESFORCE_API_VERSION'] || ''
if (!SALESFORCE_API_VERSION) {
  logger.error(
    'No Salesforce API Version. Set SALESFORCE_API_VERSION environment variable.',
  )
  process.exit(1)
}

// Optional SF Key String when using ENV var instead of file
export const SALESFORCE_KEY_STRING = process.env['SALESFORCE_KEY_STRING'] || ''

export const SALESFORCE_KEY = process.env['SALESFORCE_KEY'] || ''
if (!SALESFORCE_KEY && !SALESFORCE_KEY_STRING) {
  logger.error(
    'No Salesforce key. Set SALESFORCE_KEY OR SALESFORCE_KEY_STRING environment variable.',
  )
  process.exit(1)
}

// Optional SF Decrypted/Plain Key String when using ENV var instead of file
export const SALESFORCE_PLAIN_KEY_STRING =
  process.env['SALESFORCE_PLAIN_KEY_STRING'] || ''

export const SECRET_KEY = process.env['SECRET_KEY'] || ''
if (!SECRET_KEY) {
  logger.error('No secret key. Set SECRET_KEY environment variable.')
  process.exit(1)
}

if (Buffer.byteLength(SECRET_KEY, 'utf8') < 32) {
  logger.error(
    'SECRET_KEY does not meet minimum length requirements of 32 bytes.',
  )
  process.exit(1)
}
export const SCHEMA_DESCRIBE_TTL =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  parseInt(process.env['SCHEMA_DESCRIBE_TTL']!) || SCHEMA_DESCRIBE_TTL_DEFAULT
if (!process.env['SCHEMA_DESCRIBE_TTL']) {
  logger.warn(
    `No Schema Describe TTL defined. Using fallback DEFAULT_SCHEMA_DESCRIBE_TTL value: ${SCHEMA_DESCRIBE_TTL_DEFAULT}`,
  )
}

export const ERROR_METADATA_TTL =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  parseInt(process.env['ERROR_METADATA_TTL']!) || ERROR_METADATA_TTL_DEFAULT
if (!process.env['ERROR_METADATA_TTL']) {
  logger.warn(
    `No Error Metadata TTL defined. Using fallback ERROR_METADATA_TTL_DEFAULT value: ${ERROR_METADATA_TTL_DEFAULT}`,
  )
}

export const CONFIG_TTL =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  parseInt(process.env['CONFIG_TTL']!) || CONFIG_TTL_DEFAULT
if (!process.env['CONFIG_TTL']) {
  logger.warn(
    `No Error Metadata TTL defined. Using fallback CONFIG_TTL_DEFAULT value: ${CONFIG_TTL_DEFAULT}`,
  )
}

// Default REDIS_STRICT_SSL to 'true' if not provided
export const REDIS_STRICT_SSL = process.env['REDIS_STRICT_SSL']
  ? process.env['REDIS_STRICT_SSL'] === 'true'
  : true
if (!process.env['REDIS_STRICT_SSL']) {
  logger.warn("No REDIS_STRICT_SSL defined. Using default value 'true")
}

export const SCHEMA_INSTANCE_URL = process.env['SCHEMA_INSTANCE_URL'] || ''
if (!SCHEMA_INSTANCE_URL) {
  logger.error(
    'No schema instance url. Set SCHEMA_INSTANCE_URL environment variable.',
  )
  process.exit(1)
}

export const SCHEMA_USER = process.env['SCHEMA_USER'] || ''
if (!SCHEMA_USER) {
  logger.error('No schema user. Set SCHEMA_USER environment variable.')
  process.exit(1)
}

export const JWT_AUDIENCE = process.env['JWT_AUDIENCE'] || JWT_AUDIENCE_DEFAULT
if (!JWT_AUDIENCE) {
  logger.error('No jwt audience. Set JWT_AUDIENCE_DEFAULT environment variable.')
  process.exit(1)
}

export const LEGACY_VERSION = process.env['LEGACY_VERSION'] || ''

export const PACKAGE_NAME = process.env['PACKAGE_NAME'] || ''

export const PACKAGE_ID = process.env['PACKAGE_ID'] || ''

export const LATEST_VERSION_ID = process.env['LATEST_VERSION_ID'] || ''

export const LATEST_VERSION_NUMBER = process.env['LATEST_VERSION_NUMBER'] || ''

export const MINIMUM_SUPPORTED_VERSION_NUMBER = process.env['MINIMUM_SUPPORTED_VERSION_NUMBER'] || ''

export const HEROKU_APP_NAME = process.env['HEROKU_APP_NAME'] || ''
if (!HEROKU_APP_NAME) {
  logger.error(
    'No Heroku App Name detected. Set HEROKU_APP_NAME environment variable.',
  )
} else {
  logger.debug(`HEROKU_APP_NAME: ${HEROKU_APP_NAME}`)
}