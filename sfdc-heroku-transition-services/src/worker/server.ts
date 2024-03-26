import deployPackageQueue from './services/deployPackageQueue'
import * as redis from './services/redis'
import logger from '../util/logger'
import scanQueue from './services/scanQueue'
import pdfQueue from './services/pdfQueue'
import generateDeploymentPackageQueue from './services/generateDeploymentPackageQueue'
import packageInstallQueue from './services/packageInstallQueue'

// main
;(async () => {
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

  // Start package install queue cluster
  packageInstallQueue.start(redis.client)

  // Start deployment package queue
  generateDeploymentPackageQueue.start(redis.client)

  // Start deploy package message queue
  deployPackageQueue.start(redis.client)
})()
