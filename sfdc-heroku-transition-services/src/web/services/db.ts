import 'reflect-metadata'
import { Connection, ConnectionOptions, createConnection } from 'typeorm'
import { DATABASE_URL, isProd } from '../../util/secrets'

export let db: Connection
export const connect = async (): Promise<Connection> => {
  const connectionOptions: ConnectionOptions = {
    type: 'postgres',
    synchronize: !isProd,
    logging: false,
    extra: {
      ssl: isProd
        ? {
            rejectUnauthorized: false,
          }
        : false,
    },
    entities: ['dist/models/**/*.js'],
    migrations: ['dist/migrations/**/*.js'],
    url: DATABASE_URL,
  }
  db = await createConnection(connectionOptions)
  return db
}
