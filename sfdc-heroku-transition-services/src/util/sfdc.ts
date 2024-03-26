interface OutboundMessage<T> {
  'soapenv:envelope': {
    $: {
      'xmlns:soapenv': string
      'xmlns:xsd': string
      'xmlns:xsi': string
    }
    'soapenv:body': {
      notifications: {
        $: { xmlns: string }
        organizationid: string[]
        actionid: string[]
        sessionid: string[]
        enterpriseurl: string[]
        partnerurl: string[]
        notification: OutboundMessageNotification<T>[]
      }[]
    }[]
  }
}

interface OutboundMessageNotification<T> {
  id: string[]
  sobject: T[]
}

export enum SystemLoggerLevel {
  ERROR = 'Error',
  DEBUG = 'Debug',
  WARN = 'Warn',
  INFO = 'Info',
}

interface SystemRecord {
  $: Record<string, string>
  'sf:id': string[]
  'sf:log_level__c': SystemLoggerLevel[]
  'sf:message__c': string[]
  'sf:running_username__c': string[]
}

export const unwrapMessage = (
  soapMessage: OutboundMessage<SystemRecord>,
): {
  orgId: string
  sessionId: string
  logLevel: SystemLoggerLevel
  message: string
  username: string
} => {
  try {
    const notifications =
      soapMessage['soapenv:envelope']['soapenv:body'][0].notifications[0]

    const orgId = notifications.organizationid[0]
    const sessionId = notifications.sessionid[0]

    const sObject = notifications.notification[0].sobject[0]
    const message = sObject['sf:message__c'][0]
    const logLevel = sObject['sf:log_level__c'][0]
    const username = sObject['sf:running_username__c'][0]

    return { sessionId, message, logLevel, username, orgId }
  } catch (error) {
    throw 'Could not parse System Logger - Outbound Message XML'
  }
}
