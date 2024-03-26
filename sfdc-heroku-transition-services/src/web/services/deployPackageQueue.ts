import { RedisClient } from 'redis'
import RSMQWorker from 'rsmq-worker'
import logger from '../../util/logger'

const REDIS_WORKER_QUEUE_NAME = 'deployPackageQueue'

class DeployPackageQueue {
  client!: RSMQWorker.Client
  start(redis: RedisClient) {
    this.client = new RSMQWorker(REDIS_WORKER_QUEUE_NAME, {
      redis,
      autostart: true,
      timeout: 6 * 60 * 1000,
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

export default new DeployPackageQueue()
