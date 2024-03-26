import winston, { format } from 'winston'
import httpContext from 'express-http-context'

const options: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
    }),
    new winston.transports.File({ filename: 'debug.log', level: 'debug' }),
  ],
  format: format.combine(
    // format.colorize(),
    format.json(),
    format.prettyPrint(),
  ),
}

const winstonLogger = winston.createLogger(options)
// Wrap Winston logger to print requestId in each log
const formatMessage = function (message: string, requestId?: string) {
  requestId = requestId ? requestId : httpContext.get('requestId')
  return requestId ? { requestId, message } : message
}
const logger = {
  log: (level: string, message: any, requestId?: string) =>
    winstonLogger.log(level, formatMessage(message, requestId)),
  error: (message: any, requestId?: string) =>
    winstonLogger.error(formatMessage(message, requestId)),
  warn: (message: any, requestId?: string) =>
    winstonLogger.warn(formatMessage(message, requestId)),
  verbose: (message: any, requestId?: string) =>
    winstonLogger.verbose(formatMessage(message, requestId)),
  info: (message: any, requestId?: string) =>
    winstonLogger.info(formatMessage(message, requestId)),
  debug: (message: any, requestId?: string) =>
    winstonLogger.debug(formatMessage(message, requestId)),
  silly: (message: any, requestId?: string) =>
    winstonLogger.silly(formatMessage(message, requestId)),
}
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized at debug level')
}

export default logger
