import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import logger from '../../util/logger'
import { SystemLoggerLevel, unwrapMessage } from '../../util/sfdc'

const soapResponse = (success: boolean) =>
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:out="http://soap.sforce.com/2005/09/outbound"><soapenv:Header/><soapenv:Body><out:notificationsResponse><out:Ack>' +
  success +
  '</out:Ack></out:notificationsResponse></soapenv:Body></soapenv:Envelope>'

export const postSystemLogger = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const messageObj = unwrapMessage(req.body)
    // Log at appropriate level
    switch (messageObj.logLevel) {
      case SystemLoggerLevel.ERROR:
        logger.error(messageObj, req.id)
        break
      case SystemLoggerLevel.INFO:
        logger.info(messageObj, req.id)
        break
      case SystemLoggerLevel.WARN:
        logger.warn(messageObj, req.id)
        break
      default:
        logger.debug(messageObj, req.id)
    }
    return res.send(soapResponse(true))
  } catch (err) {
    logger.error(err)
    res.send(soapResponse(false))
  }
}
