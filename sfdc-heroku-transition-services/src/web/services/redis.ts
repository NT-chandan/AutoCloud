import redis, { RedisClient } from 'redis'
import { REDIS_STRICT_SSL, REDIS_URL } from '../../util/secrets'
import logger from '../../util/logger'

export let client: RedisClient
export const connect = (): Promise<void | Error> => {
  return new Promise((resolve, reject) => {
    client = redis.createClient({
      url: REDIS_URL,
      tls: REDIS_URL.startsWith('rediss://')
        ? {
            rejectUnauthorized: REDIS_STRICT_SSL,
          }
        : null,
    })
    client.on('connect', function () {
      const {
        port,
        host,
        socket_keepalive,
        socket_initial_delay,
        return_buffers,
        detect_buffers,
        // eslint-disable-next-line
        // @ts-ignore
      } = client.options
      logger.debug(
        `Redis is connected with options: ${JSON.stringify({
          port,
          host,
          socket_keepalive,
          socket_initial_delay,
          return_buffers,
          detect_buffers,
        })}`,
      )
      resolve()
    })
    client.on('disconnect', function () {
      logger.debug('Redis is disconnected')
    })
    client.on('error', function (error) {
      logger.error(`Redis ${error}`)
      reject(error)
    })
    client.on('quit', function () {
      logger.debug('Redis exiting from quit command.')
    })
  })
}
