import api from './services/api'
import * as db from './services/db'
import deployPackageQueue from './services/deployPackageQueue'
import * as redis from './services/redis'
import logger from '../util/logger'
import scanQueue from './services/scanQueue'
import pdfQueue from './services/pdfQueue'
import packageInstallQueue from './services/packageInstallQueue'
import generateDeploymentPackageQueue from './services/generateDeploymentPackageQueue'
import https from 'https'
import { readFileSync } from 'fs'
import { DATABASE_URL, HTTPS_CERT, HTTPS_KEY } from '../util/secrets'

// main
;(async () => {
  try {
    // Connect to redis
    try {
      await redis.connect()
    } catch (err) {
      logger.error('Failed to connect to redis')
    }

    // Start scan message queue
    scanQueue.start(redis.client)

    // Start pdf message queue
    pdfQueue.start(redis.client)

    // Start deployment package message queue
    generateDeploymentPackageQueue.start(redis.client)

    // Start package install queue
    packageInstallQueue.start(redis.client)

    // Start deploy package message queue
    deployPackageQueue.start(redis.client)

    // Connect to DB
    if (DATABASE_URL) {
      try {
        const dbConnection = await db.connect()
        const {
          type,
          synchronize,
          logging,
          extra,
          entities,
          migrations,
        } = dbConnection.options
        logger.debug(
          `DB is connected with options: ${JSON.stringify({
            type,
            synchronize,
            logging,
            extra,
            entities,
            migrations,
          })}`,
        )
      } catch (err) {
        console.log('DB could not connect: ', err)
        logger.error(err)
      }
    }

    // Start Express Web Server
    // If not HTTPS certs are supplied run HTTP
    if (!HTTPS_CERT || !HTTPS_KEY) {
      api.listen(api.get('port'), () => {
        logger.debug(
          ` Express is running at http://${api.get('host')}:${api.get(
            'port',
          )} in ${api.get('env')} mode`,
        )
        logger.debug('  Press CTRL-C to stop')
      })
    } else {
      https
        .createServer(
          {
            key: readFileSync(`/app/certs/${HTTPS_KEY}`),
            cert: readFileSync(`/app/certs/${HTTPS_CERT}`),
          },
          api,
        )
        .listen(api.get('port'), () => {
          logger.debug(
            ` Express is running at https://${api.get('host')}:${api.get(
              'port',
            )} in ${api.get('env')} mode`,
          )
          logger.debug('  Press CTRL-C to stop')
        })
    }
  } catch (err) {
    if(err instanceof Error){
      logger.error(err.stack)
    }
    
  }
})()
