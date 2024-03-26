import logger from './logger'

export const translationMap: Record<string, Record<string, string>> = {
  // 'Account' needs to stay on top so it gets priority mapping over others in 'sfToOracleTranslationMap' since it seems that duplicate Oracle Contact fields
  // are not translatable for FSC objects
  Account: {
    NAME: 'Name',
    ACCOUNT_NUMBER: 'AccountNumber',
    'CORE.USERS.ALIAS': 'Ownership',
    RECORDTYPE: 'Type',
    SITE: 'Site',
    ACCOUNT_SOURCE: 'AccountSource',
    SALES: 'AnnualRevenue',
    PC_ASSISTANT_NAME: 'PersonAssistantName',
    PC_PHONE6: 'PersonAssistantPhone',
    ADDRESS1_CITY: 'BillingCity',
    ADDRESS1_COUNTRY: 'BillingCountry',
    ADDRESS1_STATE: 'BillingState',
    ADDRESS1_STREET: 'BillingStreet',
    ADDRESS1_ZIP: 'BillingPostalCode',
    PC_BIRTHDATE: 'PersonBirthdate',
    CLEAN_STATUS: 'CleanStatus',
    // 'CREATEDBY_USER.ALIAS': 'MISSING',
    CREATED_DATE: 'CreatedDate',
    DANDB_COMPANY: 'DandbCompanyId',
    JIGSAW_KEY: 'Jigsaw',
    PC_DEPARTMENT: 'PersonDepartment',
    DUNS_NUMBER: 'DunsNumber',
    PC_EMAIL: 'PersonEmail',
    PC_EMAIL_BOUNCED_DATE: 'PersonEmailBouncedDate',
    PC_EMAIL_BOUNCED_REASON: 'PersonEmailBouncedReason',
    EMPLOYEES: 'NumberOfEmployees',
    PHONE2: 'Fax',
    PC_FIRST_NAME: 'FirstName',
    PC_PHONE4: 'PersonHomePhone',
    INDUSTRY: 'Industry',
    // IS_EMAIL_ADDRESS_BOUNCED: 'MISSING',
    IS_PERSON_ACCOUNT: 'IsPersonAccount',
    LAST_ACTIVITY: 'LastActivityDate',
    // 'UPDATEDBY_USER.ALIAS': 'MISSING',
    LAST_UPDATE: 'LastModifiedDate',
    PC_LAST_NAME: 'LastName',
    PC_LAST_CU_REQUEST_DATE: 'PersonLastCURequestDate',
    PC_LAST_CU_UPDATE_DATE: 'PersonLastCUUpdateDate',
    PC_LEAD_SOURCE: 'PersonLeadSource',
    PC_ADDRESS2_CITY: 'PersonMailingCity',
    PC_ADDRESS2_COUNTRY: 'PersonMailingCountry',
    PC_ADDRESS2_STATE: 'PersonMailingState',
    PC_ADDRESS2_STREET: 'PersonMailingStreet',
    PC_ADDRESS2_ZIP: 'PersonMailingPostalCode',
    PC_PHONE3: 'PersonMobilePhone',
    NAICS_CODE: 'NaicsCode',
    NAICS_DESC: 'NaicsDesc',
    OperatingHours: 'OperatingHoursId',
    PC_ADDRESS1_CITY: 'PersonOtherCity',
    PC_ADDRESS1_COUNTRY: 'PersonOtherCountry',
    PC_PHONE5: 'PersonOtherPhone',
    PC_ADDRESS1_STATE: 'PersonOtherState',
    PC_ADDRESS1_STREET: 'PersonOtherStreet',
    PC_ADDRESS1_ZIP: 'PersonOtherPostalCode',
    // 'CORE.USERS.FIRST_NAME': 'MISSING',
    // 'CORE.USERS.LAST_NAME': 'MISSING',
    OWNERSHIP: 'Ownership',
    PARENT_NAME: 'ParentId',
    PHONE1: 'Phone',
    RATING: 'Rating',
    PC_SALUTATION: 'Salutation',
    ADDRESS2_CITY: 'ShippingCity',
    ADDRESS2_COUNTRY: 'ShippingCountry',
    ADDRESS2_STATE: 'ShippingState',
    ADDRESS2_STREET: 'ShippingStreet',
    ADDRESS2_ZIP: 'ShippingPostalCode',
    SIC: 'Sic',
    SIC_DESC: 'SicDesc',
    TICKER: 'TickerSymbol',
    PC_TITLE: 'PersonTitle',
    // Topics: 'MISSING',
    DBA_NAME: 'Tradestyle',
    TYPE: 'Type',
    URL: 'Website',
    YEAR_STARTED: 'YearStarted',
  },
  Contact: {
    ASSISTANT_NAME: 'AssistantName',
    PHONE6: 'AssistantPhone',
    BIRTHDATE: 'Birthdate',
    CLEAN_STATUS: 'CleanStatus',
    'CORE.USERS.ALIAS': 'OwnerId',
    'CREATEDBY_USER.ALIAS': 'CreatedById',
    CREATED_DATE: 'CreatedDate',
    JIGSAW_KEY: 'Jigsaw',
    DEPARTMENT: 'Department',
    EMAIL: 'Email',
    EMAIL_BOUNCED_DATE: 'EmailBouncedDate',
    EMAIL_BOUNCED_REASON: 'EmailBouncedReason',
    PHONE2: 'Fax',
    FIRST_NAME: 'FirstName',
    PHONE4: 'HomePhone',
    IS_EMAIL_ADDRESS_BOUNCED: 'IsEmailBounced',
    IS_PERSON_ACCOUNT: 'IsPersonAccount',
    LAST_ACTIVITY: 'LastActivityDate',
    'UPDATEDBY_USER.ALIAS': 'LastModifiedById',
    LAST_UPDATE: 'LastModifiedDate',
    LAST_NAME: 'LastName',
    LAST_CU_REQUEST_DATE: 'LastCURequestDate',
    LAST_CU_UPDATE_DATE: 'LastCUUpdateDate',
    LEAD_SOURCE: 'LeadSource',
    ADDRESS2_CITY: 'MailingCity',
    ADDRESS2_COUNTRY: 'MailingCountry',
    ADDRESS2_STATE: 'MailingState',
    ADDRESS2_STREET: 'MailingStreet',
    ADDRESS2_ZIP: 'MailingPostalCode',
    PHONE3: 'MobilePhone',
    FULL_NAME: 'Name',
    ADDRESS1_CITY: 'OtherCity',
    ADDRESS1_COUNTRY: 'OtherCountry',
    PHONE5: 'OtherPhone',
    ADDRESS1_STATE: 'OtherState',
    ADDRESS1_STREET: 'OtherStreet',
    ADDRESS1_ZIP: 'OtherPostalCode',
    // 'CORE.USERS.FIRST_NAME': 'MISSING',
    // 'CORE.USERS.LAST_NAME': 'MISSING',
    PHONE1: 'Phone',
    // 'REPORTS_TO.NAME': 'MISSING',
    // 'REPORTS_TO.FIRST_NAME': 'MISSING',
    // 'REPORTS_TO.LAST_NAME': 'MISSING',
    SALUTATION: 'Salutation',
    TITLE: 'Title',
  },
}

/**
 * Map Sf field to Oracle field
 * @type {Record<string, string>}
 */
export const sfToOracleTranslationMap = Object.values(translationMap).reduce(
  // Iterate SfObject: {}
  (accumulator, values) => {
    return {
      ...accumulator,
      // Iterate { SfField: OracleField }
      ...Object.entries(values).reduce((subAccumulator, [key, value]) => {
        return accumulator[value]
          ? { ...subAccumulator }
          : { ...subAccumulator, [value]: key }
      }, {}),
    }
  },
  {},
)

/**
 * Translate an Oracle DB API name to an SF api name
 * @param {string} field - Oracle field
 * @param {string} objectName - Source object
 * @returns {string}
 */
export const OracleFieldToSfField = (
  field: string,
  objectName: string,
): string => {
  field = field?.split('.').pop() || field // Remove any preceding Object reference, ex: ACCOUNT.PHONE2 -> PHONE2
  const sfField = translationMap?.[objectName]?.[field] // Try and match on Object.Field
  return sfField ? `${objectName}.${sfField}` : field
}

export const SfFieldToOracleField = (field: string): string => {
  return sfToOracleTranslationMap[field]
    ? sfToOracleTranslationMap[field]
    : field
}
