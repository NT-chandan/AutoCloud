/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

import { MetadataComponent } from './sfDependencyHelper'
import {
  MappedObjectsInfo,
  MigrationAnalysisItem,
  getEntityDefinitions,
  EntityDefinition,
  ReportConfig,
  shouldProcessSection,
  shouldProcessMetadata,
} from './sfMigrationAnalysis'
import uuid from 'uuid'
import logger from './logger'
import labels from './labels'
import { getSFDCLabel } from './labels'
import {
  SfApi,
  DescribeSObjectResultMap,
  ToolingQueryResponse,
  ToolingQueryRecords,
} from './sfApi'
import { SystemLoggerLevel } from './sfdc'
import { forceArray } from '../util/general'
import {
  SALESFORCE_API_VERSION,
  SCHEMA_INSTANCE_URL,
  SCHEMA_USER,
  JWT_AUDIENCE,
} from './secrets'

let namespaceUnderscore = ''
let namespaceNoUnderscore = ''
let globalDescribe: Map<string, any>
let customObjectNameIdMap: Map<string, string>
let PackageType: string = ''

let APEX_SERVICE_PREFIX: string = '/services/apexrest'
const APEX_GET_FERATURES: string = '/PostScanData/features'
const APEX_GET_ANSWERS: string = '/PostScanData/answers'
const APEX_GET_HC_RECS: string = '/PostScanData/hcRecs'
const APEX_GET_FIELD_COUNT: string = '/PostScanData/fieldcount'
const APEX_GET_READINESS: string = '/PostScanData/installReadiness'

/********************************************************************************************************
 * ---Class Definition---
 ********************************************************************************************************/

export class SfPostAnalysis {
  instanceUrl: string
  ownedNamespace: string
  constructor(instanceUrl: string, ownedNamespace: string) {
    this.instanceUrl = instanceUrl
    this.ownedNamespace = ownedNamespace
    namespaceUnderscore = ownedNamespace ? ownedNamespace : ''
    namespaceNoUnderscore = ownedNamespace
      ? ownedNamespace.replace('__', '')
      : ''
    APEX_SERVICE_PREFIX = ownedNamespace
      ? '/services/apexrest' + `/${namespaceNoUnderscore}`
      : '/services/apexrest'
  }

  /********************************************************************************************************
   * Generate Post-Scan Sections of the report
   ********************************************************************************************************/
  async generateAnalysis(
    refClient: SfApi,
    apiClient: SfApi,
    assessmentId: string,
    mappedObjectInfo: MappedObjectsInfo,
    mappedSections: Set<string>,
    PackageTypeValue: string,
    config: ReportConfig,
  ): Promise<TransitionAnalysis> {
    logger.debug('==START Post-Scan Analysis')
    logger.debug(`==Namespace: ${namespaceUnderscore}`)
    if (PackageTypeValue) {
      PackageType = PackageTypeValue
    }
    if (!apiClient.jsforceConn) apiClient.createJsForceConnection()
    if (!refClient.jsforceConn) refClient.createJsForceConnection()
    const analysis: TransitionAnalysis = new TransitionAnalysis()

    //Get Assessment
    let assessment: any = await apiClient.jsforceConn
      .sobject(namespaceUnderscore + 'Assessment__c')
      .find({ Id: assessmentId })
      .execute()
    assessment = JSON.parse(JSON.stringify(assessment[0]))

    //Get Global Describe
    globalDescribe = new Map()
    await apiClient.jsforceConn.describeGlobal(function (err: any, res: any) {
      if (err) {
        logger.debug(`==Error getting global describe: ${err}`)
      }
      const globalDescribeBase: any[] = res['sobjects']
      globalDescribeBase.forEach((describeItem) => {
        globalDescribe.set(describeItem['name'], describeItem)
      })
    })

    //Get Custom Object Id Map
    customObjectNameIdMap = new Map()
    const toolingQueryResult = await apiClient.getToolingQuery(
      'SELECT Id, DeveloperName FROM CustomObject WHERE NamespacePrefix = null',
    )
    if (toolingQueryResult) {
      const customObjectRecords: any[] = toolingQueryResult.records
      customObjectRecords.forEach((objectDef) => {
        customObjectNameIdMap.set(objectDef['DeveloperName'], objectDef['Id'])
      })
    }

    //Execute sub-functions
    try {
      if (shouldProcessSection(config, labels.ReportSectionAssessmentResults)) {
        analysis.assessmentResults = await buildAssessmentResults(
          refClient,
          apiClient,
          assessment,
          mappedSections,
        )
      }
    } catch (e) {
      logger.debug(`Summary Section Error: ${e}`)
    }

    if (PackageType === 'HC' || PackageType === 'AC') {
      try {
        if (
          shouldProcessSection(config, labels.ReportSectionAssessmentResults)
        ) {
          analysis.assessmentResultsListItems = await buildAssessmentListItems(
            refClient,
            apiClient,
            assessment,
            mappedSections,
          )
        }
      } catch (e) {
        logger.debug(`Summary Section Error: ${e}`)
      }
    }

    try {
      if (shouldProcessSection(config, labels.ReportSectionProfileAnalysis)) {
        analysis.accessInfoResults = await buildAccessInfoResults(
          apiClient,
          Array.from(mappedObjectInfo.objectMapping.keys()),
          Array.from(mappedObjectInfo.fieldMapping.keys()),
          config,
        )
      }
    } catch (e) {
      logger.debug(`Summary Section Error: ${e}`)
    }

    try {
      if (
        shouldProcessSection(config, labels.ReportSectionSharingSettingAnalysis)
      ) {
        analysis.sharingSettingResults = await buildSharingSettingResults(
          apiClient,
          assessment,
          mappedObjectInfo.objectMapping,
          Array.from(mappedObjectInfo.objectMapping.keys()),
          config,
        )
      }
    } catch (e) {
      logger.debug(`Summary Section Error: ${e}`)
    }

    try {
      if (shouldProcessSection(config, labels.ReportSectionFieldAnalysis)) {
        analysis.encryptionResults = await buildEncryptionResults(
          apiClient,
          mappedObjectInfo,
          config,
        )
      }
    } catch (e) {
      logger.debug(`Summary Section Error: ${e}`)
    }

    try {
      if (shouldProcessSection(config, labels.ReportSectionFieldAnalysis)) {
        analysis.fieldAuditResults = await buildFieldAuditResults(
          apiClient,
          mappedObjectInfo,
          config,
        )
      }
    } catch (e) {
      logger.debug(`Report Section Error: ${e}`)
    }

    logger.debug('==FINISH Post-Scan Analysis')
    return analysis
  }

  /********************************************************************************************************
   * Build LWC data list for the "Report Summary" section of the report
   * (Ported from previous Apex version for FSCTA-1609)
   ********************************************************************************************************/
  async buildReportSummaryResults(
    apiClient: SfApi,
    refClient: SfApi,
    assessmentId: string,
    migrationAnalysis: MigrationAnalysisItem[],
    assessmentResults: AssessmentResultItem[],
    mappedObjectInfo: MappedObjectsInfo,
    PackageTypeValue: string,
    config: ReportConfig,
  ): Promise<ReportSummary> {
    logger.debug('==START Report Summary')
    if (PackageTypeValue) {
      PackageType = PackageTypeValue
    }
    if (!apiClient.jsforceConn) apiClient.createJsForceConnection()
    const reportSummaryResults: ReportSummary = {}

    if (shouldProcessSection(config, labels.ReportSectionReportSummary)) {
      try {
        //Get Assessment
        let assessment: any = await apiClient.jsforceConn
          .sobject(namespaceUnderscore + 'Assessment__c')
          .find({ Id: assessmentId })
          .execute()
        assessment = JSON.parse(JSON.stringify(assessment[0]))

        // //Get Global Describe
        globalDescribe = new Map()
        await apiClient.jsforceConn.describeGlobal(function (
          err: any,
          res: any,
        ) {
          if (err) {
            logger.debug(`==Error getting global describe: ${err}`)
          }
          const globalDescribeBase: any[] = res['sobjects']
          globalDescribeBase.forEach((describeItem) => {
            globalDescribe.set(describeItem['name'], describeItem)
          })
        })

        //Get Custom Object Id Map
        customObjectNameIdMap = new Map()
        const toolingQueryResult = await apiClient.getToolingQuery(
          'SELECT Id, DeveloperName FROM CustomObject WHERE NamespacePrefix = null',
        )
        if (toolingQueryResult) {
          const customObjectRecords: any[] = toolingQueryResult.records
          customObjectRecords.forEach((objectDef) => {
            customObjectNameIdMap.set(
              objectDef['DeveloperName'],
              objectDef['Id'],
            )
          })
        }

        // Gather data points for the "Recommended Features" section
        if (
          shouldProcessSection(config, labels.ReportSummaryRecommendedSettings)
        ) {
          const readinessRequest = {
            url: APEX_SERVICE_PREFIX + APEX_GET_READINESS,
            method: 'get',
            body: '',
            headers: {
              'Content-Type': 'application/json',
            },
          }
          const readinessResult: any = await apiClient.jsforceConn.request(
            readinessRequest,
          )
          reportSummaryResults.recommendedSettings = JSON.parse(
            readinessResult,
          ) as InstallReadiness
        }

        // Gather each data point for the System Overview section (Tooling API)
        if (shouldProcessSection(config, labels.ReportSummarySystemOverview)) {
          reportSummaryResults.profileCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM Profile',
            )
          reportSummaryResults.permissionSetCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM PermissionSet',
            )
          reportSummaryResults.flowCount = await getReportSummaryOverviewCount(
            apiClient,
            "SELECT COUNT() FROM Flow WHERE ProcessType = 'Flow'",
          )
          reportSummaryResults.processBuilderFlowCount =
            await getReportSummaryOverviewCount(
              apiClient,
              "SELECT COUNT() FROM Flow WHERE ProcessType = 'Workflow'",
            )
          reportSummaryResults.workflowCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM WorkflowRule',
            )
          reportSummaryResults.customObjectCount =
            await getReportSummaryOverviewCount(
              apiClient,
              "SELECT COUNT() FROM EntityDefinition WHERE KeyPrefix LIKE 'a0%' AND IsCustomSetting = false",
            )
          reportSummaryResults.apexTriggerCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM ApexTrigger',
            )
          reportSummaryResults.apexClassCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM ApexClass',
            )
          reportSummaryResults.customAppCount =
            await getReportSummaryOverviewCount(
              apiClient,
              'SELECT COUNT() FROM CustomApplication',
            )

          // Gather each data point for the System Overview section (Direct SOQL Query)
          // eslint-disable-next-line no-var
          var result = await apiClient.query(
            "SELECT TotalLicenses, UsedLicenses FROM UserLicense WHERE LicenseDefinitionKey = 'SFDC'",
          )
          if (result) {
            const crmLicenses = [...result.records]
            reportSummaryResults.licenseCount = String(
              (crmLicenses[0] as any)['TotalLicenses'],
            )
            reportSummaryResults.assignedLicenseCount = String(
              (crmLicenses[0] as any)['UsedLicenses'],
            )
          }
          result = await apiClient.query('SELECT COUNT() FROM UserRole')
          if (result) {
            reportSummaryResults.roleCount = String(result.totalSize)
          }
          result = await apiClient.query('SELECT COUNT() FROM Group')
          if (result) {
            reportSummaryResults.queueCount = String(result.totalSize)
          }
          result = await apiClient.query(
            'SELECT COUNT() FROM EmailServicesAddress',
          )
          if (result) {
            reportSummaryResults.emailToCaseCount = String(result.totalSize)
          }

          reportSummaryResults.mappedObjectsCount = Array.from(
            mappedObjectInfo.objectMapping.keys(),
          ).length
          reportSummaryResults.totalObjectsCount = globalDescribe.size
          reportSummaryResults.mappedFieldsCount = Array.from(
            mappedObjectInfo.fieldMapping.keys(),
          ).length

          reportSummaryResults.totalFieldsCount =
            assessment[namespaceUnderscore + 'Org_Field_Count__c']
          reportSummaryResults.avgFieldsPerMappedObject =
            mappedObjectInfo.objectMapping &&
            mappedObjectInfo.objectMapping.size > 0
              ? Math.round(
                  Array.from(mappedObjectInfo.fieldMapping.keys()).length /
                    Array.from(mappedObjectInfo.objectMapping.keys()).length,
                )
              : 0
          reportSummaryResults.relatedObjectsNotMappedCount =
            await getRelatedObjectsNotMappedCount(
              apiClient,
              Array.from(mappedObjectInfo.objectMapping.keys()),
            )

          let lobString: string = String(
            assessment[namespaceUnderscore + 'Selected_Products__c'],
          )
          reportSummaryResults.linesOfBusiness = []
          if (lobString.includes(';')) {
            lobString.split(';').forEach((lob) => {
              lob = lob.replace('FSC ', '')
              lob = lob.replace('HC ', '')
              lob = lob.replace('AC ', '')
              reportSummaryResults.linesOfBusiness!.push(lob)
            })
          } else {
            lobString = lobString.replace('FSC ', '')
            lobString = lobString.replace('HC ', '')
            lobString = lobString.replace('AC ', '')
            reportSummaryResults.linesOfBusiness.push(lobString)
          }

          // Use the OrgLimits information to check data and file storage usage percents
          const limitsMap: any = await getOrgLimits(apiClient)

          if (limitsMap['DataStorageMB']) {
            const dataUsage: any = limitsMap['DataStorageMB']
            const dataValue: number = dataUsage['Remaining']
            const dataLimit: number = dataUsage['Max']
            //var totalDataUsage : number = parseInt((dataValue / dataLimit).toFixed(2)) * 100;
            const totalDataUsage = Math.ceil(
              ((dataLimit - dataValue) / dataLimit) * 100,
            )
            reportSummaryResults.dataUsage = String(totalDataUsage)
          }

          if (limitsMap['FileStorageMB']) {
            const fileStorage: any = limitsMap['FileStorageMB']
            const fileValue: number = fileStorage['Remaining']
            const fileLimit: number = fileStorage['Max']
            //var totalFileUsage : number = parseInt((fileValue / fileLimit).toFixed(2)) * 100;
            const totalFileUsage: number = Math.ceil(
              ((fileLimit - fileValue) / fileLimit) * 100,
            )
            reportSummaryResults.fileStorageUsage = String(totalFileUsage)
          }

          // Check if Chat is enabled
          reportSummaryResults.enabledChatFeatures = []
          if (globalDescribe.has('LiveChatTranscript')) {
            reportSummaryResults.enabledChatFeatures.push(
              labels.ReportSummaryOverviewEnabledFeatureChat,
            )
          }
          if (globalDescribe.has('OmniSupervisorConfig')) {
            reportSummaryResults.enabledChatFeatures.push(
              labels.ReportSummaryOverviewEnabledFeatureOmnichannel,
            )
          }
          if (globalDescribe.has('FeedItem')) {
            reportSummaryResults.enabledChatFeatures.push(
              labels.ReportSummaryOverviewEnabledFeatureChatter,
            )
          }

          // Check the count of Profiles and Permission Sets related to mapped Custom Objects
          const mappedCustomObjectNames: string[] = []
          Array.from(mappedObjectInfo.objectMapping.keys()).forEach(
            (objectName) => {
              if (objectName.slice(objectName.length - 3) === '__c') {
                mappedCustomObjectNames.push(objectName)
              }
            },
          )
          result = await apiClient.query(
            `SELECT COUNT() FROM ObjectPermissions WHERE Parent.IsOwnedByProfile = true AND SObjectType IN ('${mappedCustomObjectNames.join(
              "', '",
            )}')`,
          )
          if (result) {
            reportSummaryResults.profilesRelatedLegacyObjects = result.totalSize
          }

          const permissionSetIds: Set<string> = new Set()
          result = await apiClient.query(
            `SELECT ParentId FROM ObjectPermissions WHERE SObjectType IN ('${mappedCustomObjectNames.join(
              "', '",
            )}')`,
          )
          if (result) {
            const records: any[] = [...result['records']]
            records.forEach((record) => {
              permissionSetIds.add(record['ParentId'])
            })
          }
          reportSummaryResults.permissionSetsRelatedLegacyObjects =
            permissionSetIds.size
        }

        if (shouldProcessSection(config, labels.ReportSummaryUsedObjects)) {
          // Create an initial base list of objectsToCheck
          const objectsToCheck: string[] = ['Account', 'Contact']

          // Get a list of all standard / custom objects in the system to evaluate for Notable Object record counts
          const allObjectNames: Set<string> = new Set()
          result = await apiClient.query(
            "SELECT Label, QualifiedApiName FROM EntityDefinition WHERE IsCustomizable = true AND (NOT NamespacePrefix LIKE 'CTransition%')",
          )
          if (result) {
            const resultRecords: any[] = []
            resultRecords.push(...result.records)
            resultRecords.forEach((ed) => {
              allObjectNames.add(ed['QualifiedApiName'])
            })
          }

          // Assemble the Record Count API endpoint URL dynamically
          const recordCountUrl: string = `/services/data/v${SALESFORCE_API_VERSION}/limits/recordCount`

          // Use the Record Count API to get count of all objects in the system
          const retrievedCounts: any[] = []
          const limitRequest = {
            url: recordCountUrl,
            method: 'get',
            body: '',
            headers: {
              'Content-Type': 'application/json',
            },
          }
          // await apiClient.jsforceConn.request(limitRequest, function(err: any, meta: { sObjects: any[] }) {
          //     if (err) { return console.error(err); }
          //     retrievedCounts = meta.sObjects;
          // });

          const requestResult: any = await apiClient.jsforceConn.request(
            limitRequest,
          )

          // Loop through retrieved objects and their counts, adding any that match customizable objects to a sorted list
          let caseCount: number = 0
          let leadCount: number = 0
          let opportunityCount: number = 0
          const filteredCounts: any[] = []
          retrievedCounts.forEach((rco) => {
            if (allObjectNames.has(rco['Name'])) {
              filteredCounts.push(rco)
            }
            if (rco['Name'] === 'Case') {
              caseCount = rco['count']
            }
            if (rco['Name'] === 'Lead') {
              leadCount = rco['count']
            }
            if (rco['Name'] === 'Opportunity') {
              opportunityCount = rco['count']
            }
          })
          filteredCounts.sort((a, b) => (a['count'] > b['count'] ? 1 : -1))

          //Get Custom Settings
          let customSettings: any = {}
          //TODO: We should probably have a story to make the "Notable_Object_Threshold__c" identical between packages (HC has it as "Notable_Objects_Threshold__c", do that.)
          const noteableFieldName: string =
            PackageType === 'FSC'
              ? 'Notable_Object_Threshold__c'
              : 'Notable_Objects_Threshold__c'
          result = await apiClient.query(
            `SELECT Id, ${namespaceUnderscore}Hide_Report_Summary__c, ${namespaceUnderscore}Notable_Objects_Count__c, ${namespaceUnderscore}${noteableFieldName} FROM ${namespaceUnderscore}TransitionAppSettings__c WHERE SetupOwnerId = '${apiClient.orgId}'`,
          )
          if (result) {
            customSettings = result.records[0]
          }

          //Get the threshold and object count values from the custom settings for comparison against retrieved data
          const notableObjectCount: number =
            customSettings[namespaceUnderscore + 'Notable_Objects_Count__c']
          const notableObjectThreshold: number =
            customSettings[namespaceUnderscore + noteableFieldName]

          // Check Case, Lead and Opportunity for count versus the threshold and add to objectsToCheck if past that value
          if (caseCount >= notableObjectThreshold) {
            objectsToCheck.push('Case')
          }
          if (leadCount >= notableObjectThreshold) {
            objectsToCheck.push('Lead')
          }
          if (opportunityCount >= notableObjectThreshold) {
            objectsToCheck.push('Opportunity')
          }

          // Take top objects from sorted list by record count until objectsToCheck equals the number of notable objects from custom setting
          while (objectsToCheck.length < notableObjectCount) {
            if (filteredCounts[0].count >= notableObjectThreshold) {
              objectsToCheck.push(filteredCounts[0].name)
              filteredCounts.splice(0, 1)
            } else {
              // If first item in list doesn't meet threshold, none do so lets break the loop
              break
            }
          }

          // Create a list of NotableObjects to hold those queried in objectsToCheck
          const coreNotableObjects: any[] = []
          const additionalNotableObjects: any[] = []

          // Query the profile object permissions for the indicated objects once, placing them into a map for access
          const allOp: any[] = []
          result = await apiClient.query(
            `SELECT Id, Parent.Profile.Name, Parent.Profile.Id, SObjectType FROM ObjectPermissions WHERE Parent.IsOwnedByProfile = true AND SObjectType IN ('${objectsToCheck.join(
              "', '",
            )}')`,
          )
          if (result) {
            allOp.push(...result.records)
          }
          const profilePermissionsMap: Map<string, string[]> = new Map()
          objectsToCheck.forEach((objectName) => {
            const profileNames: string[] = []
            allOp.forEach((op) => {
              const parent = op['Parent']
              const parentProfile = parent['Profile']
              profileNames.push(String(parentProfile['Id']))
            })
            profilePermissionsMap.set(objectName, profileNames)
          })

          await Promise.all(
            objectsToCheck.map(async (objectToCheck) => {
              if (
                (objectToCheck.includes('__c') &&
                  shouldProcessMetadata(config, 'CustomField')) ||
                (!objectToCheck.includes('__c') &&
                  shouldProcessMetadata(config, 'StandardEntity'))
              ) {
                const notableObject: NotableObject = {}
                notableObject.objectName = objectToCheck
                result = await apiClient.query(
                  `SELECT COUNT() FROM ${objectToCheck}`,
                )
                notableObject.recordCount = result ? result.totalSize : 0
                if (
                  objectToCheck === 'Account' ||
                  objectToCheck === 'Contact' ||
                  notableObject.recordCount > 100
                ) {
                  result = await apiClient.query(
                    `SELECT COUNT() FROM ${objectToCheck} WHERE LastModifiedDate > LAST_YEAR`,
                  )
                  notableObject.modifiedRecords = result ? result.totalSize : 0

                  let objectDescibe: any
                  let objectRecordTypeInfos: any[]
                  await apiClient.jsforceConn
                    .sobject('' + objectToCheck)
                    .describe(function (err: any, meta: any) {
                      if (err) {
                        return console.error(err)
                      }
                      objectDescibe = meta
                    })

                  if (objectDescibe) {
                    objectRecordTypeInfos = forceArray(
                      objectDescibe['recordTypeInfos'],
                    )
                    const rtIds: string[] = []
                    objectRecordTypeInfos.forEach((rti) => {
                      rtIds.push(rti['recordTypeId'])
                    })

                    const recordTypes = await apiClient.query(
                      `SELECT COUNT(ID), Name FROM RecordType WHERE Id IN ('${rtIds.join(
                        "', '",
                      )}') GROUP BY Name ORDER BY COUNT(ID) DESC`,
                    )
                    notableObject.recordTypes = []
                    if (
                      recordTypes &&
                      (recordTypes.records as any[]) &&
                      (recordTypes.records as any[]).length > 10
                    ) {
                      // eslint-disable-next-line no-var
                      var recordTypeRecords: any[] = recordTypes.records
                      for (let i = 0; i <= 9; i++) {
                        notableObject.recordTypes.push(
                          '' +
                            recordTypeRecords[i]['Name'] +
                            ' (' +
                            recordTypeRecords[i]['expr0'] +
                            ')',
                        )
                      }
                    } else {
                      if (recordTypes && recordTypes.records) {
                        // eslint-disable-next-line no-var
                        var recordTypeRecords: any[] = recordTypes.records
                        for (let i = 0; i < recordTypeRecords.length; i++) {
                          notableObject.recordTypes.push(
                            '' +
                              recordTypeRecords[i]['Name'] +
                              ' (' +
                              recordTypeRecords[i]['expr0'] +
                              ')',
                          )
                        }
                      }
                    }

                    notableObject.allRecordTypes =
                      '' + notableObject.recordTypes.join(', ')

                    notableObject.profiles = []
                    if (profilePermissionsMap.has(objectToCheck)) {
                      const objectProfiles = await apiClient.query(
                        `SELECT COUNT(ID), Name FROM Profile WHERE Id IN ('${profilePermissionsMap
                          .get(objectToCheck)!
                          .join(
                            "', '",
                          )}') GROUP BY Profile.Name ORDER BY COUNT(ID) DESC`,
                      )
                      if (
                        objectProfiles &&
                        (objectProfiles.records as any[]) &&
                        (objectProfiles.records as any[]).length > 10
                      ) {
                        // eslint-disable-next-line no-var
                        var objectProfilesRecords: any[] =
                          objectProfiles.records
                        for (let i = 0; i <= 9; i++) {
                          notableObject.profiles.push(
                            '' +
                              objectProfilesRecords[i]['Name'] +
                              ' (' +
                              objectProfilesRecords[i]['expr0'] +
                              ')',
                          )
                        }
                      } else {
                        if (objectProfiles && objectProfiles.records) {
                          // eslint-disable-next-line prefer-const
                          let objectProfilesRecords: any[] =
                            objectProfiles.records
                          for (
                            let i = 0;
                            i < objectProfilesRecords.length;
                            i++
                          ) {
                            notableObject.profiles.push(
                              '' +
                                objectProfilesRecords[i]['Name'] +
                                ' (' +
                                objectProfilesRecords[i]['expr0'] +
                                ')',
                            )
                          }
                        }
                      }
                    }

                    notableObject.allProfiles =
                      '' + notableObject.profiles.join(', ')

                    if (
                      notableObject.objectName === 'Account' ||
                      notableObject.objectName === 'Contact' ||
                      notableObject.objectName === 'Case' ||
                      notableObject.objectName === 'Lead' ||
                      notableObject.objectName === 'Opportunity'
                    ) {
                      coreNotableObjects.push(notableObject)
                    } else {
                      additionalNotableObjects.push(notableObject)
                    }
                  } else {
                    logger.debug(`==No Describe found for : ${objectToCheck}`)
                  }
                }
              }
            }),
          )

          coreNotableObjects.sort((a, b) =>
            a.recordCount < b.recordCount ? 1 : -1,
          )
          additionalNotableObjects.sort((a, b) =>
            a.recordCount < b.recordCount ? 1 : -1,
          )
          reportSummaryResults.coreNotableObjects = coreNotableObjects
          reportSummaryResults.additionalNotableObjects =
            additionalNotableObjects
        }

        // Gather and transform the data for the Migration Analysis Summary section of the Report Summary
        if (
          shouldProcessSection(config, labels.ReportSummaryMigrationAnalysis)
        ) {
          if (migrationAnalysis != null && migrationAnalysis.length > 0) {
            const lowEffort: ReportSummaryMigrationAnalysisItem[] = []
            const medEffort: ReportSummaryMigrationAnalysisItem[] = []
            const highEffort: ReportSummaryMigrationAnalysisItem[] = []

            migrationAnalysis.forEach((mai) => {
              const currentItem: ReportSummaryMigrationAnalysisItem =
                parseSummaryMigrationAnalysisRow(
                  mai,
                  mai.fromComponentName,
                  'parent',
                )

              // Sort the row into the correct effort
              if (currentItem.effort === labels.EffortLabelLow) {
                lowEffort.push(currentItem)
              } else if (currentItem.effort === labels.EffortLabelMedium) {
                medEffort.push(currentItem)
              } else if (currentItem.effort === labels.EffortLabelHigh) {
                highEffort.push(currentItem)
              }

              mai.children.forEach((maiChild) => {
                const currentChildItem: ReportSummaryMigrationAnalysisItem =
                  parseSummaryMigrationAnalysisRow(
                    maiChild,
                    mai.fromComponentName,
                    'child',
                  )

                // Sort the row into the correct effort
                if (currentChildItem.effort === labels.EffortLabelLow) {
                  lowEffort.push(currentChildItem)
                } else if (
                  currentChildItem.effort === labels.EffortLabelMedium
                ) {
                  medEffort.push(currentChildItem)
                } else if (currentChildItem.effort === labels.EffortLabelHigh) {
                  highEffort.push(currentChildItem)
                }
              })
            })

            // OLD TODO: Sort each of these lists by objectName before passing to these methods so they're grouped correctly

            // Process each level of effort into the proper order before assembling into the final list to add to the Report Summary
            reportSummaryResults.migrationAnalysis = []
            if (highEffort.length > 0) {
              const highEffortItems: ReportSummaryMigrationAnalysisItem[] =
                parseSummaryMigrationAnalysisEffortRow(highEffort)
              reportSummaryResults.migrationAnalysis.push(...highEffortItems)
            }

            if (medEffort.length > 0) {
              const medEffortItems: ReportSummaryMigrationAnalysisItem[] =
                parseSummaryMigrationAnalysisEffortRow(medEffort)
              reportSummaryResults.migrationAnalysis.push(...medEffortItems)
            }

            if (lowEffort.length > 0) {
              const lowEffortItems: ReportSummaryMigrationAnalysisItem[] =
                parseSummaryMigrationAnalysisEffortRow(lowEffort)
              reportSummaryResults.migrationAnalysis.push(...lowEffortItems)
            }
          }
        }

        // Assembled the Basis of Assessment data for the Report Summary
        if (
          shouldProcessSection(config, labels.ReportSummaryBasisofAssessment)
        ) {
          const basisOfAssessmentReasons: ReportSummaryBasisOfAssessmentReason[] =
            []
          reportSummaryResults.basisOfAssessment = []

          // OLD TODO: Determine if assessmentResults has the correct data and test why only one item is being returned
          // OLD TODO: Consider creating a list for each reason like in Migration Analysis and adding items to that,
          // then clearing data for all but the first, and adding them to a unified list to pass to the report summary

          for (let i = 0; i < assessmentResults.length; i++) {
            const currentReasonText: string = assessmentResults[i].reasonText
            const currentResultsData: AssessmentResultItem =
              assessmentResults[i]

            // If no values have been added to basisOfAssessment, just add the first
            if (basisOfAssessmentReasons.length == 0) {
              // eslint-disable-next-line no-var
              var currentBasisItem: ReportSummaryBasisOfAssessmentReason = {
                reasonText: currentReasonText,
                children: [assessmentResults[i]],
              }
              basisOfAssessmentReasons.push(currentBasisItem)
            } else {
              let foundReason: boolean = false

              // Loop through the existing basisOfAssessment objects in the list to check reason values
              for (let j = 0; j < basisOfAssessmentReasons.length; j++) {
                // If an object is found with the correct reason, add the data to its children
                if (
                  basisOfAssessmentReasons[j].reasonText == currentReasonText
                ) {
                  currentResultsData.reasonText = ''
                  basisOfAssessmentReasons[j].children.push(currentResultsData)
                  foundReason = true
                }
              }

              // If no existing object was found with a matching priority, add one with the current data in its children
              if (!foundReason) {
                // eslint-disable-next-line no-var
                var currentBasisItem: ReportSummaryBasisOfAssessmentReason = {
                  reasonText: currentReasonText,
                  children: [assessmentResults[i]],
                }
                basisOfAssessmentReasons.push(currentBasisItem)
              }
            }
          }

          // Process the parsed Basis of Assessment data into the corrected format
          const reasonLabelMap: Map<string, string> = await getSFDCLabel(
            apiClient,
            refClient,
            [
              'FeatureReasonDefault',
              'FeatureReasonDefaultReportSummary',
              'FeatureReasonActionPlan',
              'FeatureReasonActionPlanReportSummary',
              'FeatureReasonLifeEvents',
              'FeatureReasonLifeEventsReportSummary',
            ],
            namespaceNoUnderscore,
          )
          if (basisOfAssessmentReasons.length > 0) {
            basisOfAssessmentReasons.forEach((rsboar) => {
              let isFirst: boolean = true

              rsboar.children.forEach((ari) => {
                const currentChild: ReportSummaryBasisOfAssessment = {
                  feature: ari.replaceWithFsc,
                  featureUrl: ari.replaceWithFscUrl,
                  goal: ari.goalText,
                }

                // If this is the first row for a recommendation, add all data and ensure its using the report summary version of the label.
                // Otherwise, drop reasonText

                if (isFirst) {
                  if (
                    ari.reasonText == reasonLabelMap.get('FeatureReasonDefault')
                  ) {
                    currentChild.recommendation = reasonLabelMap.get(
                      'FeatureReasonDefaultReportSummary',
                    )
                  } else if (
                    ari.reasonText ==
                    reasonLabelMap.get('FeatureReasonActionPlan')
                  ) {
                    currentChild.recommendation = reasonLabelMap.get(
                      'FeatureReasonActionPlanReportSummary',
                    )
                  } else if (
                    ari.reasonText ==
                    reasonLabelMap.get('FeatureReasonLifeEvents')
                  ) {
                    currentChild.recommendation = reasonLabelMap.get(
                      'FeatureReasonLifeEventsReportSummary',
                    )
                  }

                  isFirst = false
                } else {
                  currentChild.recommendation = ''
                }

                reportSummaryResults.basisOfAssessment?.push(currentChild)
              })
            })
          }
        }

        //If neccessary, mark Non-Admin status for this assessment
        await checkNonAdminPermissions(
          apiClient,
          reportSummaryResults,
          assessmentId,
        )

        logger.debug('==FINISH Report Summary')
      } catch (e) {
        logger.debug(`==ERR Report Summary: ${e}`)
      }
    }

    return reportSummaryResults
  }
}

/********************************************************************************************************
 * ---Primary Functions---
 ********************************************************************************************************/

/********************************************************************************************************
 * Build LWC data list for the "Assessment Results" (Features) section of the upgrade report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildAssessmentResults(
  refClient: SfApi,
  apiClient: SfApi,
  assessment: any,
  mappedSections: Set<string>,
): Promise<AssessmentResultItem[]> {
  const itemList: AssessmentResultItem[] = []
  let itemToAdd: AssessmentResultItem

  //Get Assessment__c Describe (specifically, field names)
  const availableAssessmentFields: Set<string> = new Set()
  let assessmentDescribe: any

  await apiClient.jsforceConn
    .sobject(namespaceUnderscore + 'Assessment__c')
    .describe(function (err: any, meta: any) {
      if (err) {
        return console.error(err)
      }
      assessmentDescribe = meta
    })

  // logger.debug(
  //     `==Post-Scan Assessment Field Describe: ${JSON.stringify(assessmentDescribe['fields'])}`,
  // )
  const assessmentFieldData: any[] = assessmentDescribe['fields']
  assessmentFieldData.forEach((fieldData) => {
    availableAssessmentFields.add(fieldData['name'])
  })

  //prioritize and recommend SFDC native features
  const allFeatures: any[] = []
  const allAnswers: any[] = []

  //var featuresRequest = {url: APEX_SERVICE_PREFIX+APEX_GET_FERATURES, method: 'get', body: '', headers : {"Content-Type" : "application/json"}};

  //var featuresResults : any = await apiClient.jsforceConn.request(featuresRequest);

  let featureQuery = ''
  if (PackageType !== 'FSC') {
    featureQuery =
      'SELECT Id, DeveloperName, MasterLabel, Answer_API_Name__c, Assessment_Result_Fields__c, Conflicting_Custom_Objects__c, Custom_Label__c, Documentation_URL__c, Explanation_Label__c, Feature_Description__c, Index__c, Negative_Label__c, Priority__c, Reason_Label__c, Render_Flags__c FROM SFDC_Feature__mdt'
  } else {
    featureQuery =
      'SELECT Id, DeveloperName, MasterLabel, Assessment_Result_Fields__c, Conflicting_Custom_Objects__c, Custom_Label__c, Documentation_URL__c, Goal_Label__c, Priority__c, Reason_Label__c FROM SFDC_Feature__mdt'
  }
  const featuresResults: any = await refClient.jsforceConn.query(featureQuery)
  // if(featuresResults){
  //     allFeatures = JSON.parse(featuresResults) as any[];
  // }
  if (featuresResults && featuresResults.records) {
    featuresResults.records.forEach((rec: any) => {
      delete rec['attributes']
      allFeatures.push(rec)
    })
  }

  if (PackageType !== 'FSC') {
    //HC Features have Indices, FSC does not
    allFeatures.sort((a, b) => (a['Index__c'] > b['Index__c'] ? 1 : -1))

    //Also grab the answer mdt records if in HC
    // var answersRequest = {url: APEX_SERVICE_PREFIX+APEX_GET_ANSWERS, method: 'get', body: '', headers : {"Content-Type" : "application/json"}};
    // var answersResults : any = await apiClient.jsforceConn.request(answersRequest);
    // if(answersResults){
    //     allAnswers = JSON.parse(answersResults) as any[];
    // }
    const answersResults: any = await refClient.jsforceConn.query(
      'SELECT Id, DeveloperName, Question_Label__c, Question__r.Question_Group__r.MasterLabel FROM SFDC_Industry_Assessment_Answer__mdt',
    )
    if (answersResults && answersResults.records) {
      answersResults.records.forEach((rec: any) => {
        delete rec['attributes']
        allAnswers.push(rec)
      })
    }
  }

  const labelList: string[] = []
  allFeatures.forEach((fscFeature) => {
    labelList.push(fscFeature['Custom_Label__c'])
    labelList.push(fscFeature['Reason_Label__c'])
    if (PackageType === 'FSC') {
      labelList.push(fscFeature['Goal_Label__c'])
    } else {
      labelList.push(fscFeature['Explanation_Label__c'])
      labelList.push(fscFeature['Negative_Label__c'])
      labelList.push(fscFeature['Feature_Description__c'])
    }
  })

  allAnswers.forEach((answer) => {
    labelList.push(answer['Question_Label__c'])
  })

  const featureLabelMap: Map<string, string> = await getSFDCLabel(
    apiClient,
    refClient,
    labelList,
    namespaceNoUnderscore,
  )

  let featureLabel: string,
    reasonLabel: string,
    goalLabel: string,
    priority: string,
    reasonText: string
  allFeatures.forEach((fscFeature) => {
    featureLabel = featureLabelMap.has(fscFeature['Custom_Label__c'])
      ? String(featureLabelMap.get(fscFeature['Custom_Label__c']))
      : ''
    reasonLabel = featureLabelMap.has(fscFeature['Reason_Label__c'])
      ? String(featureLabelMap.get(fscFeature['Reason_Label__c']))
      : ''
    if (PackageType === 'FSC') {
      goalLabel = featureLabelMap.has(fscFeature['Goal_Label__c'])
        ? String(featureLabelMap.get(fscFeature['Goal_Label__c']))
        : ''
    }
    priority = PackageType === 'FSC' ? 'Low' : fscFeature['Priority__c']
    reasonText = labels.FeatureReasonDefault

    let stillShow: boolean = true

    if (PackageType === 'FSC') {
      //FSC Feature List
      if (fscFeature['Assessment_Result_Fields__c']) {
        const fieldApiNames: string[] = String(
          fscFeature['Assessment_Result_Fields__c'],
        ).split(',')
        fieldApiNames.forEach((fieldApiName) => {
          fieldApiName = namespaceUnderscore + fieldApiName
          if (availableAssessmentFields.has(fieldApiName.toLowerCase())) {
            //Detect a populated field or true value
            const fieldValue: any =
              assessment['' + namespaceUnderscore + fieldApiName]
            if (
              fieldValue &&
              (typeof fieldValue == 'boolean' || String(fieldValue) != null)
            ) {
              //Set specified pritority and reason
              priority = fscFeature['Priority__c']
              reasonText = reasonLabel ? reasonLabel : reasonText
            }
          }
        })
      }

      //Add Item
      itemToAdd = new AssessmentResultItem(featureLabel, priority)
      itemToAdd.reasonText = reasonText
      itemToAdd.goalText = goalLabel
      itemToAdd.replaceWithFscUrl = fscFeature['Documentation_URL__c']
      itemList.push(itemToAdd)
    } else {
      //HC Feature List
      if (
        !fscFeature['Answer_API_Name__c'] ||
        checkSectionName(
          allAnswers,
          mappedSections,
          fscFeature['Answer_API_Name__c'],
          featureLabelMap,
        )
      ) {
        //Also check render flags
        const renderFlags: Set<string> = new Set<string>()
        if (fscFeature['Render_Flags__c']) {
          const flagList: string[] = (
            fscFeature['Render_Flags__c'] as string
          ).split(',')
          flagList.forEach((flag) => {
            renderFlags.add(flag.trim())
          })
        }

        if (renderFlags && renderFlags.size > 0) {
          renderFlags.forEach((flag) => {
            if (flag) {
              if (flag.includes('!')) {
                flag = flag.replace('!', '')
                //Check falsey
                if (Boolean(assessment[namespaceUnderscore + flag])) {
                  stillShow = false
                }
              } else {
                //Check truthy
                if (Boolean(assessment[namespaceUnderscore + flag]) === false) {
                  stillShow = false
                }
              }
            }
          })
        }
      } else {
        stillShow = false
      }

      const recommendText: string =
        stillShow === true
          ? fscFeature['Explanation_Label__c']
          : fscFeature['Negative_Label__c']
      //Add Item
      itemToAdd = new AssessmentResultItem(featureLabel, priority)
      itemToAdd.reasonText = reasonText
      itemToAdd.recommendText = featureLabelMap.get(recommendText)
      itemToAdd.featureText = featureLabelMap.get(
        fscFeature['Feature_Description__c'],
      )
      itemToAdd.replaceWithFscUrl = fscFeature['Documentation_URL__c']
      itemList.push(itemToAdd)
    }
  })

  //Sort list
  if (PackageType === 'FSC') {
    itemList.sort((a, b) => (a.priorityNumber() > b.priorityNumber() ? 1 : -1))
  }

  return itemList
}

/********************************************************************************************************
 * HC ONLY
 * Build List Items underneath the "Assessment Results" (Features) section of the upgrade report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildAssessmentListItems(
  refClient: SfApi,
  apiClient: SfApi,
  assessment: any,
  mappedSections: Set<string>,
): Promise<AssessmentResultItem[]> {
  const items: AssessmentResultItem[] = []
  const preSalesItems: any[] = []
  const allAnswers: any[] = []
  const labelList: string[] = []

  // var recRequest = {url: APEX_SERVICE_PREFIX+APEX_GET_HC_RECS, method: 'get', body: '', headers : {"Content-Type" : "application/json"}};
  // var recResults : any = await apiClient.jsforceConn.request(recRequest);
  // if(recResults){
  //     preSalesItems = JSON.parse(recResults) as any[];
  // }

  const recResults: any = await refClient.jsforceConn.query(
    "SELECT DeveloperName, Answer_API_Name__c, Icon_Name__c, Render_Flags__c, Recommendation_Label__c FROM SFDC_Health_Cloud_Recommendation__mdt WHERE Section__r.DeveloperName = 'AssessmentResults' Order By List_Index__c",
  )
  if (recResults && recResults.records) {
    recResults.records.forEach((rec: any) => {
      delete rec['attributes']
      preSalesItems.push(rec)
    })
  }

  preSalesItems.forEach((preSalesItem) => {
    labelList.push(preSalesItem['Recommendation_Label__c'])
  })

  //Also grab the answer mdt records if in HC
  // var answersRequest = {url: APEX_SERVICE_PREFIX+APEX_GET_ANSWERS, method: 'get', body: '', headers : {"Content-Type" : "application/json"}};
  // var answersResults : any = await apiClient.jsforceConn.request(answersRequest);
  // if(answersResults){
  //     allAnswers = JSON.parse(answersResults) as any[];
  // }
  const answersResults: any = await refClient.jsforceConn.query(
    'SELECT Id, DeveloperName, Question_Label__c, Question__r.Question_Group__r.MasterLabel FROM SFDC_Industry_Assessment_Answer__mdt',
  )
  if (answersResults && answersResults.records) {
    answersResults.records.forEach((rec: any) => {
      delete rec['attributes']
      allAnswers.push(rec)
    })
  }

  allAnswers.forEach((answer) => {
    labelList.push(answer['Question_Label__c'])
  })

  const recLabelMap: Map<string, string> = await getSFDCLabel(
    apiClient,
    refClient,
    labelList,
    namespaceNoUnderscore,
  )

  preSalesItems.forEach((preSalesItem) => {
    if (
      checkSectionName(
        allAnswers,
        mappedSections,
        preSalesItem['Answer_API_Name__c'],
        recLabelMap,
      ) === false
    ) {
      //Also check render flags
      const renderFlags: Set<string> = new Set<string>()
      if (preSalesItem['Render_Flags__c']) {
        const flagList: string[] = (
          preSalesItem['Render_Flags__c'] as string
        ).split(',')
        flagList.forEach((flag) => {
          renderFlags.add(flag.trim())
        })
      }

      let stillShow: boolean = true
      if (renderFlags && renderFlags.size > 0) {
        renderFlags.forEach((flag) => {
          if (flag) {
            if (flag.includes('!')) {
              flag = flag.replace('!', '')
              //Check falsey
              if (Boolean(assessment[namespaceUnderscore + flag])) {
                stillShow = false
              }
            } else {
              //Check truthy
              if (Boolean(assessment[namespaceUnderscore + flag]) === false) {
                stillShow = false
              }
            }
          }
        })
      }

      if (stillShow) {
        //Add Item
        const itemToAdd = new AssessmentResultItem(
          preSalesItem['DeveloperName'],
          'Low',
        )
        itemToAdd.reasonText = recLabelMap.get(
          preSalesItem['Recommendation_Label__c'],
        )!
        itemToAdd.iconOverride = preSalesItem['Icon_Name__c']
        items.push(itemToAdd)
      }
    }
  })

  return items
}

/********************************************************************************************************
 * Build LWC data list for the "Profile and Permission Analysis" section of the report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildAccessInfoResults(
  apiClient: SfApi,
  mappedObjects: string[],
  mappedFieldList: string[],
  config: ReportConfig,
): Promise<MigrationAnalysisItem[]> {
  //Query ObjectPermissions records
  const mappedObjectPermissions: any[] = []
  if (shouldProcessMetadata(config, 'ObjectPermissions')) {
    // eslint-disable-next-line no-var
    var query = `SELECT ParentId, Parent.Name, Parent.ProfileId, Parent.Profile.Name, SobjectType, Parent.IsOwnedByProfile FROM ObjectPermissions WHERE SObjectType IN ('${mappedObjects.join(
      "', '",
    )}') ORDER BY LastModifiedDate DESC, Parent.Name ASC, Parent.Profile.Name ASC, SobjectType ASC`
    // eslint-disable-next-line no-var
    var result = await apiClient.query(query)
    if (result) {
      mappedObjectPermissions.push(...result['records'])
    }
  }

  //Create set from Mapped Fields
  const mappedFields: Set<string> = new Set()
  mappedFieldList.forEach((fieldItem) => {
    mappedFields.add(fieldItem)
  })

  //Build map of object permissions separating profile and permission set names
  const objectPermissionMap: Map<string, any[]> = new Map()
  const profileNames: Set<string> = new Set()
  const permissionSetNames: Set<string> = new Set()
  const objectPermissionUniquenessMap: Map<string, Set<string>> = new Map()

  if (mappedObjectPermissions && mappedObjectPermissions.length > 0) {
    mappedObjectPermissions.forEach((mappedObjectPermissionItem) => {
      const mappedObjectPermission: any = JSON.parse(
        JSON.stringify(mappedObjectPermissionItem),
      )
      const parent: any = mappedObjectPermission['Parent']
      let parentProfile: any
      if (parent) {
        parentProfile = parent['Profile']
      }

      const key: string = parent['IsOwnedByProfile']
        ? parentProfile['Name']
        : parent['Name']
      if (Boolean(parent['IsOwnedByProfile']) === true) {
        profileNames.add(key)
      } else {
        permissionSetNames.add(key)
      }

      //only use first/most recent object permission per sobject to avoid duplicate rows
      const currentObjects: Set<string> = objectPermissionUniquenessMap.has(key)
        ? objectPermissionUniquenessMap.get(key)!
        : new Set()
      objectPermissionUniquenessMap.set(key, currentObjects)

      if (currentObjects.has(mappedObjectPermission['SobjectType']) === true)
        return

      currentObjects.add(mappedObjectPermission['SobjectType'])
      const currentKeyPermissions: any[] = objectPermissionMap.has(key)
        ? objectPermissionMap.get(key)!
        : []

      if (currentKeyPermissions.length === 0) {
        objectPermissionMap.set(key, [mappedObjectPermission])
      } else {
        currentKeyPermissions.push(mappedObjectPermission)
        objectPermissionMap.set(key, currentKeyPermissions)
      }
    })
  } else {
    logger.debug('==No ObjectPermissions records found')
  }

  //Get field permissions
  const mappedFieldPermissions: any[] = []

  //Split up query per character limits
  const fieldNameChunks: string[][] = []
  let fieldChunk: string[] = []
  const charaterLimit: number = 3500
  let currentCharacterCount: number = 0
  mappedFields.forEach((mappedField) => {
    currentCharacterCount += mappedField.length
    if (currentCharacterCount < charaterLimit) {
      fieldChunk.push(mappedField)
    } else {
      fieldNameChunks.push([...fieldChunk])
      fieldChunk = []
      currentCharacterCount = mappedField.length
      fieldChunk.push(mappedField)
    }
  })
  fieldNameChunks.push([...fieldChunk])

  //Query each chunk and add to full mappedFieldPermissions list
  if (shouldProcessMetadata(config, 'FieldPermissions')) {
    await Promise.all(
      fieldNameChunks.map(async (fieldChunk) => {
        query = `SELECT ParentId, Parent.Name, Parent.ProfileId, Parent.Profile.Name, SobjectType, Field, Parent.IsOwnedByProfile FROM FieldPermissions WHERE SobjectType IN ('${mappedObjects.join(
          "', '",
        )}') AND Field IN ('${fieldChunk.join(
          "', '",
        )}') AND (Parent.Profile.Name IN ('${Array.from(profileNames).join(
          "', '",
        )}') OR Parent.Name IN ('${Array.from(permissionSetNames).join(
          "', '",
        )}')) ORDER BY Parent.Name ASC, Parent.Profile.Name ASC, SobjectType ASC`
        const fieldPermResult = await apiClient.query(query)
        if (result) {
          mappedFieldPermissions.push(...fieldPermResult['records'])
        }
      }),
    )
  }

  //query = `SELECT ParentId, Parent.Name, Parent.ProfileId, Parent.Profile.Name, SobjectType, Field, Parent.IsOwnedByProfile FROM FieldPermissions WHERE SobjectType IN ('${mappedObjects.join("', '")}') AND Field IN ('${mappedFields.join("', '")}') AND (Parent.Profile.Name IN ('${Array.from(profileNames).join("', '")}') OR Parent.Name IN ('${Array.from(permissionSetNames).join("', '")}')) ORDER BY Parent.Name ASC, Parent.Profile.Name ASC, SobjectType ASC`;
  // result = await apiClient.query(query);
  // if(result){
  //     mappedFieldPermissions.push(...result['records']);
  // }

  //Build map of fields permissions using profiles and permission set names as keys
  const fieldPermissionMap: Map<string, any[]> = new Map()
  if (mappedFieldPermissions && mappedFieldPermissions.length > 0) {
    mappedFieldPermissions.forEach((mappedFieldPermissionItem) => {
      const mappedFieldPermission: any = JSON.parse(
        JSON.stringify(mappedFieldPermissionItem),
      )
      // logger.debug(`==TEST Permission: ${JSON.stringify(mappedFieldPermission)}`)
      const parent: any = mappedFieldPermission['Parent']
      let parentProfile: any
      if (parent) {
        parentProfile = parent['Profile']
      }

      const key: string =
        Boolean(parent['IsOwnedByProfile']) === true
          ? parentProfile['Name']
          : parent['Name']
      const currentKeyPermissions: any[] = fieldPermissionMap.has(key)
        ? fieldPermissionMap.get(key)!
        : []
      if (currentKeyPermissions.length === 0) {
        fieldPermissionMap.set(key, [mappedFieldPermission])
      } else {
        currentKeyPermissions.push(mappedFieldPermission)
        fieldPermissionMap.set(key, currentKeyPermissions)
      }
    })
  }

  //get count of assigned profiles
  let userProfileInfo: Map<string, any[]> = new Map()
  if (shouldProcessMetadata(config, 'Profile')) {
    const profileResult = await apiClient.query(
      `SELECT count(Id) profileCount, Profile.Name FROM User WHERE Profile.Name IN ('${Array.from(
        profileNames,
      ).join("', '")}') GROUP BY Profile.Name`,
    )
    if (profileResult) {
      userProfileInfo = groupByStrings('Name', profileResult.records)
    }
  }

  //get count of assigned permission sets
  let userPermissionInfo: Map<string, any[]> = new Map()
  if (shouldProcessMetadata(config, 'PermissionSetAssignment')) {
    const permSetResult = await apiClient.query(
      `SELECT count(Id) permissionSetCount, PermissionSet.Name FROM PermissionSetAssignment WHERE PermissionSet.Name IN ('${Array.from(
        permissionSetNames,
      ).join("', '")}') GROUP BY PermissionSet.Name`,
    )
    if (permSetResult) {
      userPermissionInfo = groupByStrings('Name', permSetResult.records)
      if (!userPermissionInfo) {
        userPermissionInfo = new Map()
      }
    }
  }

  const accessInfoResults: MigrationAnalysisItem[] = []
  //iterate through profiles
  if (shouldProcessMetadata(config, 'Profile')) {
    Array.from(profileNames).forEach((profile) => {
      const objectInfoList: any[] = objectPermissionMap.get(profile)!
      const parent: any = objectInfoList[0]['Parent']
      let parentProfile: any
      if (parent) {
        parentProfile = parent['Profile']
      }

      const fieldPerms: any[] = fieldPermissionMap.get(profile)!
      const fieldsBySObjectMap: Map<string, any[]> = !fieldPerms
        ? new Map()
        : groupByStrings('SobjectType', fieldPerms)

      const item: MigrationAnalysisItem = {
        uuid: uuid.v4(),
        fromComponentId: parent['ProfileId'],
        fromComponentName: parentProfile['Name'],
        fromComponentType: labels.TypeProfile,
        fromComponentUrl: new MetadataComponent(
          parent['ProfileId'],
          labels.TypeProfile,
          parentProfile['Name'],
          '',
        ).Url!,
        toComponentName: '',
        children: [],
      }
      item.reasonText = userProfileInfo.has(profile)
        ? String(userProfileInfo.get(profile)![0]['profileCount'])
        : '0'

      objectInfoList.forEach((objectInfo) => {
        const objectItem: MigrationAnalysisItem = {
          uuid: uuid.v4(),
          fromComponentId: objectInfo['Id'],
          fromComponentName: objectInfo['SobjectType'].replace('__c', ''),
          fromComponentType: objectInfo['SobjectType'].endsWith('__c')
            ? labels.TypeCustomObject
            : labels.TypeStandardObject,
          fromComponentUrl: '',
          toComponentName: '',
          children: [],
        }

        const objectNameId: string =
          objectItem.fromComponentType === labels.TypeCustomObject &&
          customObjectNameIdMap.has(objectItem.fromComponentName)
            ? customObjectNameIdMap.get(objectItem.fromComponentName)!
            : objectItem.fromComponentName
        objectItem.fromComponentUrl =
          item.fromComponentUrl + '%3Fs%3DObjectsAndTabs%26o%3D' + objectNameId

        const fieldInfoList: any[] = fieldsBySObjectMap.has(
          objectInfo['SobjectType'],
        )
          ? fieldsBySObjectMap.get(objectInfo['SobjectType'])!
          : []
        if (fieldInfoList) {
          fieldInfoList.forEach((fieldInfo) => {
            let foundExisting: boolean = false
            objectItem.children.forEach((existingChild) => {
              if (
                existingChild.fromComponentName ===
                fieldInfo['Field'].replace(objectInfo['SobjectType'] + '.', '')
              ) {
                foundExisting = true
              }
            })
            if (foundExisting === false) {
              const fieldItem: MigrationAnalysisItem = {
                uuid: uuid.v4(),
                fromComponentId: fieldInfo['Id'],
                fromComponentName: fieldInfo['Field'].replace(
                  objectInfo['SobjectType'] + '.',
                  '',
                ),
                fromComponentType: labels.TypeCustomField,
                fromComponentUrl: objectItem.fromComponentUrl,
                toComponentName: '',
                children: [],
              }
              objectItem.children.push(fieldItem)
            }
          })
          objectItem.children.sort((a, b) =>
            a.fromComponentName.localeCompare(b.fromComponentName),
          )
        }
        item.children.push(objectItem)
      })

      item.children.sort((a, b) =>
        a.fromComponentName.localeCompare(b.fromComponentName),
      )
      accessInfoResults.push(item)
    })
  }

  //iterate through permission sets
  if (shouldProcessMetadata(config, 'PersmissionSet')) {
    Array.from(permissionSetNames).forEach((permissionSet) => {
      const objectInfoList: any[] = objectPermissionMap.get(permissionSet)!
      const parent: any = objectInfoList[0]['Parent']

      const fieldPerms: any[] = fieldPermissionMap.get(permissionSet)!
      const fieldsBySObjectMap: Map<string, any[]> = !fieldPerms
        ? new Map()
        : groupByStrings('SobjectType', fieldPerms)

      const item: MigrationAnalysisItem = {
        uuid: uuid.v4(),
        fromComponentId: objectInfoList[0]['ParentId'],
        fromComponentName: parent['Name'],
        fromComponentType: labels.TypePermissionSet,
        fromComponentUrl: new MetadataComponent(
          objectInfoList[0]['ParentId'],
          labels.TypePermissionSet,
          parent['Name'],
          '',
        ).Url!,
        toComponentName: '',
        children: [],
      }
      item.reasonText = userPermissionInfo.has(permissionSet)
        ? String(
            userPermissionInfo.get(permissionSet)![0]['permissionSetCount'],
          )
        : '0'

      objectInfoList.forEach((objectInfo) => {
        const objectItem: MigrationAnalysisItem = {
          uuid: uuid.v4(),
          fromComponentId: objectInfo['Id'],
          fromComponentName: objectInfo['SobjectType'].replace('__c', ''),
          fromComponentType: objectInfo['SobjectType'].endsWith('__c')
            ? labels.TypeCustomObject
            : labels.TypeStandardObject,
          fromComponentUrl: '',
          toComponentName: '',
          children: [],
        }

        const objectNameId: string =
          objectItem.fromComponentType === labels.TypeCustomObject &&
          customObjectNameIdMap.has(objectItem.fromComponentName)
            ? customObjectNameIdMap.get(objectItem.fromComponentName)!
            : objectItem.fromComponentName
        objectItem.fromComponentUrl =
          item.fromComponentUrl +
          '%3Fs%3DEntityPermissions%26o%3D' +
          objectNameId

        const fieldInfoList: any[] = fieldsBySObjectMap.has(
          objectInfo['SobjectType'],
        )
          ? fieldsBySObjectMap.get(objectInfo['SobjectType'])!
          : []
        if (fieldInfoList) {
          fieldInfoList.forEach((fieldInfo) => {
            let foundExisting: boolean = false
            objectItem.children.forEach((existingChild) => {
              if (
                existingChild.fromComponentName ===
                fieldInfo['Field'].replace(objectInfo['SobjectType'] + '.', '')
              ) {
                foundExisting = true
              }
            })
            if (foundExisting === false) {
              const fieldItem: MigrationAnalysisItem = {
                uuid: uuid.v4(),
                fromComponentId: fieldInfo['Id'],
                fromComponentName: fieldInfo['Field'].replace(
                  objectInfo['SobjectType'] + '.',
                  '',
                ),
                fromComponentType: labels.TypeCustomField,
                fromComponentUrl: objectItem.fromComponentUrl,
                toComponentName: '',
                children: [],
              }
              objectItem.children.push(fieldItem)
            }
          })
          objectItem.children.sort((a, b) =>
            a.fromComponentName.localeCompare(b.fromComponentName),
          )
        }
        item.children.push(objectItem)
      })

      item.children.sort((a, b) =>
        a.fromComponentName.localeCompare(b.fromComponentName),
      )
      accessInfoResults.push(item)
    })
  }

  accessInfoResults.sort((a, b) =>
    a.fromComponentName.localeCompare(b.fromComponentName),
  )

  return accessInfoResults
}

/********************************************************************************************************
 * Build LWC data list for the "Sharing Settings Analysis" section of the report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildSharingSettingResults(
  apiClient: SfApi,
  assessment: any,
  sourceToDestinationObject: Map<string, string>,
  mappedObjects: string[],
  config: ReportConfig,
): Promise<MigrationAnalysisItem[]> {
  const sharingSettingsItems: MigrationAnalysisItem[] = []
  try {
    if (shouldProcessMetadata(config, 'SharingRules')) {
      //Get Sharing Rules
      const metadataMap: Map<string, any> = new Map()
      const metadataRead: any[] = await apiClient.readMetadata(
        'SharingRules',
        Array.from(mappedObjects),
      )
      metadataRead.forEach((item) => {
        if (item['fullName']) {
          metadataMap.set(item['fullName'], item)
        }
      })

      //Get Apex Sharing
      const customObjectToApexSharingReasons: Map<
        string,
        Map<string, string>
      > = await getApexSharingReasons(apiClient, mappedObjects, config)

      const entityDefinitions: EntityDefinition[] = await getEntityDefinitions(
        apiClient,
        mappedObjects,
      )
      let analysisItem: MigrationAnalysisItem
      if (shouldProcessMetadata(config, 'SharingSet')) {
        entityDefinitions.forEach((entityDefinition) => {
          analysisItem = {
            uuid: uuid.v4(),
            fromComponentId: '',
            fromComponentName: entityDefinition['Label'],
            fromComponentType: getTypeLabel(labels.TypeSharingSetting),
            fromComponentUrl: new MetadataComponent(
              '',
              getTypeLabel(labels.TypeSharingSetting),
              entityDefinition['Label'],
              '',
            ).Url!,
            toComponentName: sourceToDestinationObject.get(
              entityDefinition['QualifiedApiName'],
            ),
            children: [],
          }
          analysisItem.fromComponentInternalSharing =
            labels.SHARING_VALUE_TO_LABEL.get(
              entityDefinition['InternalSharingModel'],
            )
          analysisItem.fromComponentExternalSharing =
            labels.SHARING_VALUE_TO_LABEL.get(
              entityDefinition['ExternalSharingModel'],
            )

          //add child sharing rules
          const childItems: MigrationAnalysisItem[] = getParsedSharingRuleItems(
            entityDefinition['QualifiedApiName'],
            metadataMap,
            config,
          )
          analysisItem.children.push(...childItems)

          //add child apex share reasons
          const shareObjectApiName: string = entityDefinition[
            'QualifiedApiName'
          ].replace('__c', '__share')
          if (shouldProcessMetadata(config, 'SharingReason')) {
            if (customObjectToApexSharingReasons.has(shareObjectApiName)) {
              const apexSharingChildItems: MigrationAnalysisItem[] =
                getParsedApexSharingReasonItems(
                  customObjectToApexSharingReasons.get(shareObjectApiName)!,
                )
              analysisItem.children.push(...apexSharingChildItems)
            }
          }

          sharingSettingsItems.push(analysisItem)
        })
      }

      //Add any items that happen to be in the 'ApexShareAnalysisJSON__c' field as well
      if (assessment[namespaceUnderscore + 'ApexShareAnalysisJSON__c']) {
        const apexAnalysisItems: MigrationAnalysisItem[] = JSON.parse(
          assessment[namespaceUnderscore + 'ApexShareAnalysisJSON__c'],
        )
        sharingSettingsItems.push(...apexAnalysisItems)
      }
    }
  } catch (e) {
    //Track error messages during sharing settings process to better debug in various orgs.
    logger.debug(`==ERROR buildSharingSettingResults | ${e}`)
  }

  sharingSettingsItems.sort((a, b) =>
    a.fromComponentName.localeCompare(b.fromComponentName),
  )

  return sharingSettingsItems
}

/********************************************************************************************************
 * Build LWC data list for the "Field Analysis - Encryption" section of the report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildEncryptionResults(
  apiClient: SfApi,
  mappedObjectInfo: MappedObjectsInfo,
  config: ReportConfig,
): Promise<MigrationAnalysisItem[]> {
  const encryptionResults: MigrationAnalysisItem[] = []
  if (
    !mappedObjectInfo.objectMapping ||
    mappedObjectInfo.objectMapping.size === 0
  ) {
    return encryptionResults
  }

  //Metadata Read for Field Mapping
  const fieldDescribeMap: Map<string, any> = new Map()
  const metadataRead: any[] = await apiClient.readMetadata(
    'CustomField',
    Array.from(mappedObjectInfo.fieldMapping.keys()),
  )
  if (metadataRead && metadataRead.length) {
    metadataRead.forEach((item) => {
      if (item['fullName']) {
        fieldDescribeMap.set(item['fullName'], item)
      }
    })
  }

  const entityDefinitionByObjectApiName: Map<string, EntityDefinition> =
    new Map()
  const entityDefs: EntityDefinition[] = await getEntityDefinitions(
    apiClient,
    Array.from(mappedObjectInfo.objectMapping.keys()),
  )
  entityDefs.forEach((entityDefinition) => {
    entityDefinitionByObjectApiName.set(
      entityDefinition['QualifiedApiName'],
      entityDefinition,
    )
  })

  const encryptedResultsByObject: Map<string, MigrationAnalysisItem[]> =
    new Map()
  let analysisItem: MigrationAnalysisItem

  //Iterate through field describes
  Array.from(fieldDescribeMap.values()).forEach((fieldDescribe) => {
    fieldDescribe = JSON.parse(JSON.stringify(fieldDescribe))
    const fullName: string = String(fieldDescribe['fullName'])
    const objectName = fullName.substring(0, fullName.indexOf('.'))
    const fieldName = fullName.substring(
      fullName.indexOf('.') + 1,
      fullName.length,
    )

    if (objectName && fieldName) {
      if (
        (fieldName.includes('__c') &&
          shouldProcessMetadata(config, 'CustomField')) ||
        (!fieldName.includes('__c') &&
          shouldProcessMetadata(config, 'StandardEntity'))
      ) {
        const shieldEncryption: string = String(
          fieldDescribe['encryptionScheme'],
        )
        let encryptionType

        //Determine if field has encryption and type of encryption
        if (shieldEncryption) {
          if (shieldEncryption === 'ProbabilisticEncryption') {
            encryptionType =
              labels.ENCRYPTION_TYPE_TO_LABEL.get('Probabilistic')
          } else if (
            shieldEncryption === 'CaseSensitiveDeterministicEncryption' ||
            shieldEncryption === 'CaseInsensitiveDeterministicEncryption'
          ) {
            encryptionType =
              labels.ENCRYPTION_TYPE_TO_LABEL.get('Deterministic')
          }
        }
        if (String(fieldDescribe['type']) === 'EncryptedText') {
          encryptionType = labels.ENCRYPTION_TYPE_TO_LABEL.get('Classic')
        }
        if (encryptionType) {
          //Create field items
          analysisItem = {
            uuid: uuid.v4(),
            fromComponentId: '',
            fromComponentName: fieldName,
            fromComponentType: encryptionType,
            fromComponentUrl: '',
            toComponentName: '',
            children: [],
          }
          if (!encryptedResultsByObject.has(objectName)) {
            encryptedResultsByObject.set(objectName, [analysisItem])
          } else {
            const tempList: MigrationAnalysisItem[] =
              encryptedResultsByObject.get(objectName)!
            tempList.push(analysisItem)
            encryptedResultsByObject.set(objectName, tempList)
          }
        }
      }
    }
  })

  // Create object items
  Array.from(encryptedResultsByObject.keys()).forEach((objectName) => {
    if (
      (objectName.includes('__c') &&
        shouldProcessMetadata(config, 'CustomField')) ||
      (!objectName.includes('__c') &&
        shouldProcessMetadata(config, 'StandardEntity'))
    ) {
      const entityDefinition: EntityDefinition =
        entityDefinitionByObjectApiName.get(objectName)!
      const item: MigrationAnalysisItem = {
        uuid: uuid.v4(),
        fromComponentId: '',
        fromComponentName: entityDefinition.Label,
        fromComponentType: '',
        fromComponentUrl: `/lightning/setup/ObjectManager/${entityDefinition.DurableId}/Details/view`,
        toComponentName: '',
        children: encryptedResultsByObject.has(objectName)
          ? encryptedResultsByObject.get(objectName)!
          : [],
      }
      item.fromComponentSize = String(
        encryptedResultsByObject.get(entityDefinition.QualifiedApiName)!.length,
      )
      encryptionResults.push(item)
    }
  })

  //Build list of object and fields for Tooling API query to get durable Id for clickable links
  const fieldApiNamesByObjectApiName: Map<string, string[]> = new Map()
  Array.from(encryptedResultsByObject.keys()).forEach((objectApiName) => {
    Array.from(encryptedResultsByObject.get(objectApiName)!).forEach((item) => {
      if (!fieldApiNamesByObjectApiName.has(objectApiName)) {
        fieldApiNamesByObjectApiName.set(objectApiName, [
          item.fromComponentName,
        ])
      } else {
        const tempList: string[] =
          fieldApiNamesByObjectApiName.get(objectApiName)!
        tempList.push(item.fromComponentName)
        fieldApiNamesByObjectApiName.set(objectApiName, tempList)
      }
    })
  })

  //Perform Tooling API FieldDefinition query to get durableId for fields - needed for field URL in Setup
  const fields: Set<string> = new Set()
  const objects: Set<string> = new Set()
  Array.from(fieldApiNamesByObjectApiName.keys()).forEach((objectName) => {
    objects.add(objectName)
    fieldApiNamesByObjectApiName.get(objectName)!.forEach((fieldName) => {
      fields.add(fieldName)
    })
  })

  let whereClause =
    objects.size > 0
      ? `WHERE EntityDefinition.QualifiedApiName IN ('${Array.from(
          objects,
        ).join("', '")}')`
      : ''
  if (fields.size > 0) {
    whereClause += ` AND QualifiedApiName IN ('${Array.from(fields).join(
      "', '",
    )}')`
  }
  //If whereClause is present, do query (otherwise no encryptedFields)
  if (whereClause) {
    const query = `SELECT DurableId, QualifiedApiName, EntityDefinition.QualifiedApiName FROM FieldDefinition ${whereClause}`
    const result = await apiClient.getToolingQuery(query)
    const allRecords: any[] = []
    const customFieldsMap: Map<string, any> = new Map()
    if (result) {
      allRecords.push(...JSON.parse(JSON.stringify(result.records)))
      allRecords.forEach((field) => {
        const key: string =
          field.EntityDefinition.QualifiedApiName + '.' + field.QualifiedApiName
        customFieldsMap.set(key, field)
      })
    }
    //Set field URL based on Tooling API results
    Array.from(encryptedResultsByObject.keys()).forEach((encryptedObject) => {
      if (entityDefinitionByObjectApiName.has(encryptedObject)) {
        const entityDefinition: EntityDefinition =
          entityDefinitionByObjectApiName.get(encryptedObject)!
        if (encryptedResultsByObject.has(encryptedObject)) {
          Array.from(encryptedResultsByObject.get(encryptedObject)!).forEach(
            (encryptedItem) => {
              const key: string =
                entityDefinition.QualifiedApiName +
                '.' +
                encryptedItem.fromComponentName
              const customField: any = customFieldsMap.get(key)
              if (customField) {
                const objectDurableId: string = customField.DurableId.substring(
                  0,
                  customField.DurableId.indexOf('.'),
                )
                const fieldDurableId: string = customField.DurableId.substring(
                  customField.DurableId.indexOf('.'),
                  customField.DurableId.length,
                )
                if (
                  entityDefinition.DurableId == objectDurableId &&
                  encryptedItem.fromComponentName ==
                    customField.QualifiedApiName
                ) {
                  const fieldUrl: string = `/lightning/setup/ObjectManager/${objectDurableId}/FieldsAndRelationships/${fieldDurableId}/view`
                  encryptedItem.fromComponentUrl = fieldUrl
                }
              }
            },
          )
        }
      }
    })
  }

  return encryptionResults
}

/********************************************************************************************************
 * Build LWC data list for the "Field Analysis - Field Audit" section of the report
 * (Ported from previous Apex version for FSCTA-1609)
 ********************************************************************************************************/
async function buildFieldAuditResults(
  apiClient: SfApi,
  mappedObjectInfo: MappedObjectsInfo,
  config: ReportConfig,
): Promise<MigrationAnalysisItem[]> {
  const fieldAuditResults: MigrationAnalysisItem[] = []

  const objectDescribeMap: Map<string, any> = new Map()
  const metadataRead: any[] = await apiClient.readMetadata(
    'CustomObject',
    Array.from(mappedObjectInfo.objectMapping.keys()),
  )
  if (metadataRead && metadataRead.length) {
    metadataRead.forEach((item) => {
      // logger.debug(`item['fullName']: ${item['fullName']}`)
      if (item['fullName']) {
        objectDescribeMap.set(item['fullName'], item)
      }
    })
  }

  const entityDefinitionByObjectApiName: Map<string, EntityDefinition> =
    new Map()
  const entityDefs: EntityDefinition[] = await getEntityDefinitions(
    apiClient,
    Array.from(mappedObjectInfo.objectMapping.keys()),
  )
  entityDefs.forEach((entityDefinition) => {
    entityDefinitionByObjectApiName.set(
      entityDefinition.QualifiedApiName,
      entityDefinition,
    )
  })

  const fieldResultsByObject: Map<string, MigrationAnalysisItem[]> = new Map()
  Array.from(objectDescribeMap.keys()).forEach((objectName) => {
    if (
      (objectName.includes('__c') &&
        shouldProcessMetadata(config, 'CustomField')) ||
      (!objectName.includes('__c') &&
        shouldProcessMetadata(config, 'StandardEntity'))
    ) {
      const result: any = JSON.parse(
        JSON.stringify(objectDescribeMap.get(objectName)),
      )!

      let archiveAfterMonths: string = '18'
      let archiveRetentionYears: string = '2'
      let policy: Map<string, any> = new Map()

      if (result.enableHistory && Boolean(result.enableHistory)) {
        if (result.historyRetentionPolicy != null) {
          policy = JSON.parse(JSON.stringify(result.historyRetentionPolicy))
          if (policy.has('archiveAfterMonths')) {
            archiveAfterMonths = '' + policy.get('archiveAfterMonths')
            archiveRetentionYears = '' + policy.get('archiveRetentionYears')
          }
        }

        const entityDefinition: EntityDefinition =
          entityDefinitionByObjectApiName.get(objectName)!
        const objectFieldHistoryUrl: string = `/lightning/setup/ObjectManager/${entityDefinition.DurableId}/FieldsAndRelationships/setHistoryTracking`
        const fields: any[] = forceArray(result.fields)

        if (fields && fields.length > 0) {
          fields.forEach((field) => {
            const fieldName: string = field['fullName']
            const objectAndFieldName: string = objectName + '.' + fieldName
            let hasTracking: boolean = false
            if (mappedObjectInfo.fieldMapping.has(objectAndFieldName)) {
              if (field['trackHistory']) {
                if (field['trackHistory'] === 'true') {
                  hasTracking = true
                }
              }

              const childItem: MigrationAnalysisItem = {
                uuid: uuid.v4(),
                fromComponentId: '',
                fromComponentName: fieldName,
                fromComponentType: '',
                fromComponentUrl: objectFieldHistoryUrl,
                toComponentName: '',
                children: [],
              }

              if (hasTracking === true) {
                if (!fieldResultsByObject.has(objectName)) {
                  fieldResultsByObject.set(objectName, [])
                }
                const tempList = fieldResultsByObject.get(objectName)!
                tempList.push(childItem)
                fieldResultsByObject.set(objectName, tempList)
              }
            }
          })
        }
      }
    }
  })

  let hasFieldAuditTrail: boolean = false
  Array.from(fieldResultsByObject.keys()).forEach((objectName) => {
    const entityDefinition: EntityDefinition =
      entityDefinitionByObjectApiName.get(objectName)!
    const objectFieldHistoryUrl: string = `/lightning/setup/ObjectManager/${entityDefinition.DurableId}/FieldsAndRelationships/setHistoryTracking`

    let archiveAfterMonths: string = '18'
    let archiveRetentionYears = hasFieldAuditTrail ? '10' : '2'
    let policy: Map<string, any> = new Map()
    const objectSchema: any = JSON.parse(
      JSON.stringify(objectDescribeMap.get(objectName)),
    )

    if (objectSchema['historyRetentionPolicy']) {
      policy = new Map(Object.entries(objectSchema['historyRetentionPolicy']))
      hasFieldAuditTrail = true

      if (policy.has('archiveAfterMonths')) {
        archiveAfterMonths = '' + policy.get('archiveAfterMonths')
      }
      if (policy.has('archiveRetentionYears')) {
        archiveRetentionYears = '' + policy.get('archiveRetentionYears')
      } else {
        archiveRetentionYears = '10'
      }
    }

    const fieldCount: number = fieldResultsByObject.get(
      entityDefinition.QualifiedApiName,
    )!.length

    const item: MigrationAnalysisItem = {
      uuid: uuid.v4(),
      fromComponentId: '',
      fromComponentName: entityDefinition.Label,
      fromComponentType: '',
      fromComponentUrl: objectFieldHistoryUrl,
      toComponentName: '',
      children: [],
    }
    item.fromComponentSize = '' + fieldCount
    item.fromComponentArchiveAfterMonths = archiveAfterMonths
    item.fromComponentArchiveRetentionYears = archiveRetentionYears
    item.children = fieldResultsByObject.has(objectName)
      ? fieldResultsByObject.get(objectName)!
      : []
    fieldAuditResults.push(item)
  })

  return fieldAuditResults
}

/********************************************************************************************************
 * ---Helper Functions---
 ********************************************************************************************************/

//Gets the appropriate Metadata Type in user-viewable form
function getTypeLabel(typeName: string): string {
  if (!typeName) {
    return ' '
  } else {
    return labels.TYPE_TO_LABEL.has(typeName)
      ? labels.TYPE_TO_LABEL.get(typeName)!
      : typeName.replace(/([a-z])([A-Z])/g, '$1 $2')
  }
}

//Group of functions that parse Sharing Rule metadata
function getParsedSharingRuleItems(
  sObjectApiName: string,
  metadataMap: Map<string, any>,
  config: ReportConfig,
): MigrationAnalysisItem[] {
  const sharingCriteriaRuleItems: MigrationAnalysisItem[] = []
  const sObjectInfo = metadataMap.get(sObjectApiName)!

  if (shouldProcessMetadata(config, 'SharingCriteriaRule')) {
    if (sObjectInfo['sharingCriteriaRules']) {
      forceArray(sObjectInfo['sharingCriteriaRules']).forEach(
        (criteriaRule) => {
          const analysisItem: MigrationAnalysisItem = {
            uuid: uuid.v4(),
            fromComponentId: '',
            fromComponentName: criteriaRule['label'],
            fromComponentType: labels.TypeSharingCriteria,
            fromComponentUrl: new MetadataComponent(
              '',
              labels.TypeSharingSetting,
              criteriaRule['label'],
              '',
            ).Url!,
            toComponentName: '',
            children: [],
          }
          analysisItem.reasonText = labels.SharingRuleReimplement
          sharingCriteriaRuleItems.push(analysisItem)
        },
      )
    }
  }

  if (shouldProcessMetadata(config, 'SharingOwnerRule')) {
    if (sObjectInfo['sharingOwnerRules']) {
      forceArray(sObjectInfo['sharingOwnerRules']).forEach((ownerRule) => {
        const analysisItem: MigrationAnalysisItem = {
          uuid: uuid.v4(),
          fromComponentId: '',
          fromComponentName: ownerRule['label'],
          fromComponentType: labels.TypeSharingRuleOwner,
          fromComponentUrl: new MetadataComponent(
            '',
            labels.TypeSharingSetting,
            ownerRule['label'],
            '',
          ).Url!,
          toComponentName: '',
          children: [],
        }
        analysisItem.reasonText = labels.SharingRuleReimplement
        sharingCriteriaRuleItems.push(analysisItem)
      })
    }
  }

  //Possible new functionality
  if (shouldProcessMetadata(config, 'SharingGuestRule')) {
    if (sObjectInfo['sharingGuestRules']) {
      forceArray(sObjectInfo['sharingGuestRules']).forEach((guestRule) => {
        const analysisItem: MigrationAnalysisItem = {
          uuid: uuid.v4(),
          fromComponentId: '',
          fromComponentName: guestRule['label'],
          fromComponentType: labels.TypeSharingRuleOwner,
          fromComponentUrl: new MetadataComponent(
            '',
            labels.TypeSharingSetting,
            guestRule['label'],
            '',
          ).Url!,
          toComponentName: '',
          children: [],
        }
        analysisItem.reasonText = labels.SharingRuleReimplement
        sharingCriteriaRuleItems.push(analysisItem)
      })
    }
  }

  //Possible new functionality
  if (shouldProcessMetadata(config, 'SharingTerritoryRule')) {
    if (sObjectInfo['sharingTerritoryRules']) {
      forceArray(sObjectInfo['sharingTerritoryRules']).forEach(
        (territoryRule) => {
          const analysisItem: MigrationAnalysisItem = {
            uuid: uuid.v4(),
            fromComponentId: '',
            fromComponentName: territoryRule['label'],
            fromComponentType: labels.TypeSharingRuleOwner,
            fromComponentUrl: new MetadataComponent(
              '',
              labels.TypeSharingSetting,
              territoryRule['label'],
              '',
            ).Url!,
            toComponentName: '',
            children: [],
          }
          analysisItem.reasonText = labels.SharingRuleReimplement
          sharingCriteriaRuleItems.push(analysisItem)
        },
      )
    }
  }

  return sharingCriteriaRuleItems
}

function getParsedApexSharingReasonItems(
  apexSharingReasons: Map<string, string>,
): MigrationAnalysisItem[] {
  const apexSharingReasonItems: MigrationAnalysisItem[] = []

  if (apexSharingReasons.size > 0) {
    Array.from(apexSharingReasons.keys()).forEach((sharingReasonLabel) => {
      const analysisItem: MigrationAnalysisItem = {
        uuid: uuid.v4(),
        fromComponentId: '',
        fromComponentName:
          sharingReasonLabel +
          '(' +
          apexSharingReasons.get(sharingReasonLabel)! +
          ')',
        fromComponentType: labels.SharingApexReason,
        fromComponentUrl: '',
        toComponentName: '',
        children: [],
      }
      analysisItem.reasonText = labels.SharingSettingsCDSReason
      apexSharingReasonItems.push(analysisItem)
    })
  }
  return apexSharingReasonItems
}

async function getApexSharingReasons(
  apiClient: SfApi,
  sourceObjects: string[],
  config: ReportConfig,
): Promise<Map<string, Map<string, string>>> {
  const sharingReasonMap: Map<string, Map<string, string>> = new Map()
  const customObjects: Set<string> = new Set()

  if (shouldProcessMetadata(config, 'SharingReason')) {
    //Filter list to have only Custom Objects
    sourceObjects.forEach((objectApiName) => {
      if (objectApiName.endsWith('__c')) {
        customObjects.add(objectApiName)
      }
    })

    //Grab the Picklist Entries for the Share object variant of the Custom Object. The entries contain the Apex Sharing Reason with a __c suffix.
    Array.from(customObjects).forEach(async (customObject) => {
      const shareObjectApiName: string = customObject.replace('__c', '__share')
      if (globalDescribe.has(shareObjectApiName)) {
        const fieldMap = await getFieldMap(apiClient, shareObjectApiName)
        if (fieldMap.has('rowCause')) {
          const entries: any[] = fieldMap.get('rowCause')['picklistValues']

          //Find the Apex Sharing Reasons
          entries.forEach((entry) => {
            const entryValue: string = entry['value']
            if (entryValue.endsWith('__c')) {
              const tempMap: Map<string, string> = sharingReasonMap.has(
                shareObjectApiName,
              )
                ? sharingReasonMap.get(shareObjectApiName)!
                : new Map()
              tempMap.set(entry['label'], entry['value'])
              sharingReasonMap.set(shareObjectApiName, tempMap)
            }
          })
        }
      }
    })
  }

  return sharingReasonMap
}

//Report Summary Related
async function getReportSummaryOverviewCount(
  apiClient: SfApi,
  query: string,
): Promise<string> {
  const result = await apiClient.getToolingQuery(query)
  if (result) {
    return String(parseReportSummaryOverviewCount(JSON.stringify(result)))
  } else {
    return labels.NonAdminMessage
  }
}

function parseReportSummaryOverviewCount(jsonStr: string): number {
  if (jsonStr) {
    const jsonObj: any = JSON.parse(jsonStr)
    return jsonObj['size']
  } else {
    return -1
  }
}

async function getOrgFieldCount(apiClient: SfApi): Promise<number> {
  let totalFields: number = 0
  const chunkedList: string[][] = []
  const objectNames = Array.from(globalDescribe.keys())
  const chunkSize = 25
  for (let i = 0; i < objectNames.length; i += chunkSize) {
    chunkedList.push(objectNames.slice(i, i + chunkSize))
  }

  const promiseList: Promise<number>[] = []
  chunkedList.forEach((chunk) => {
    promiseList.push(getChunkedDescribe(apiClient, chunk))
  })

  await Promise.all(promiseList)
    .then((results) => {
      if (results) {
        results.forEach((chunkFieldCount) => {
          totalFields += chunkFieldCount
        })
      }
    })
    .catch((err) => {
      logger.debug(`==ERR | Global Describe Field Count |: ${err}`)
    })
    .finally(() => {
      logger.debug(
        `==DEBUG | Global Describe Field Count | Total Fields: ${totalFields}`,
      )
    })
  return totalFields
}

async function getChunkedDescribe(
  apiClient: SfApi,
  objectList: string[],
): Promise<number> {
  let totalFields = 0
  objectList.forEach(async (objectName) => {
    await apiClient.jsforceConn
      .sobject(objectName)
      .describe(function (err: any, meta: any) {
        if (err) {
          return console.error(err)
        }
        const fieldList: any[] = meta.fields
        totalFields += fieldList.length
      })
  })
  return totalFields
}

async function getRelatedObjectsNotMappedCount(
  apiClient: SfApi,
  mappedObjects: string[],
): Promise<number> {
  const relatedObjectsNotMapped: Set<string> = new Set()
  const relatedObjects: Set<string> = new Set()
  const mappedObjectsSet: Set<string> = new Set(mappedObjects)

  mappedObjects.forEach(async (mappedObject) => {
    const fieldMap: Map<string, any> = await getFieldMap(
      apiClient,
      mappedObject,
    )
    Array.from(fieldMap.keys()).forEach((fieldName) => {
      if (fieldMap.get(fieldName)['type'] === 'reference') {
        const references: string[] = forceArray(
          fieldMap.get(fieldName)['referenceTo'],
        )
        references.forEach((item) => relatedObjects.add(item))
      }
    })
  })

  relatedObjects.forEach((relatedObjectName) => {
    if (!mappedObjectsSet.has(relatedObjectName)) {
      relatedObjectsNotMapped.add(relatedObjectName)
    }
  })

  return relatedObjectsNotMapped.size
}

//Used to group queried records by a common field value instead
function groupByStrings(fieldName: string, records: any[]): Map<string, any[]> {
  const resultRecords: Map<string, any[]> = new Map()
  let tempList: any[]
  records.forEach((record) => {
    if (resultRecords.has('' + record[fieldName])) {
      tempList = resultRecords.get(record[fieldName])!
    } else {
      tempList = []
    }
    tempList.push(record)
    resultRecords.set('' + record[fieldName], [...tempList])
  })
  return resultRecords
}

//Used to retrieve a single sObject's fieldMap via Describe
async function getFieldMap(
  apiClient: SfApi,
  sobjectName: string,
): Promise<Map<string, any>> {
  const fieldMap: Map<string, any> = new Map()
  let fieldList: any[] = []

  //1609 Fix: OLD Callback function (would cause exception)
  // await apiClient.jsforceConn.sobject(sobjectName).describe(function(err : any, meta : any) {
  //     if (err) {
  //         logger.debug( `==No Describe for SObject: `+sobjectName);
  //     }else{
  //         fieldList = meta.fields;
  //     }
  // });

  //1609 Fix: NEW Promise function ("catch" clause handles exception)
  await apiClient.jsforceConn
    .sobject(sobjectName)
    .describe()
    .then((meta: any) => {
      if (meta) {
        fieldList = meta.fields
      }
    })
    .catch((err: any) => {
      logger.debug(`==No Describe for SObject: ${sobjectName}`)
    })

  fieldList.forEach((field) => {
    fieldMap.set('name', field)
  })
  return fieldMap
}

async function getOrgLimits(apiClient: SfApi): Promise<any> {
  const limitRequest = {
    url: `/services/data/v${SALESFORCE_API_VERSION}/limits/`,
    method: 'get',
    body: '',
    headers: {
      'Content-Type': 'application/json',
    },
  }
  return await apiClient.jsforceConn.request(limitRequest)
}

//Report Summary section parsing functions
function parseSummaryMigrationAnalysisRow(
  rowData: MigrationAnalysisItem,
  objectName: string,
  hierarchyType: string,
): ReportSummaryMigrationAnalysisItem {
  let recommendationText: string = ''

  if (rowData.effort == labels.EffortLabelHigh) {
    recommendationText = labels.EffortRecommendationHigh
  } else if (rowData.effort == labels.EffortLabelMedium) {
    recommendationText = labels.EffortRecommendationMedium
  } else if (rowData.effort == labels.EffortLabelLow) {
    recommendationText = labels.EffortRecommendationLow
  }

  let typeCount: string = ''

  if (hierarchyType == 'parent') {
    typeCount = rowData.fromComponentSize ? rowData.fromComponentSize : ''
  } else if (hierarchyType == 'child') {
    typeCount = rowData.fromComponentName.substring(
      rowData.fromComponentName.indexOf('(') + 1,
      rowData.fromComponentName.lastIndexOf(')'),
    )
  }

  const currentRsmi: ReportSummaryMigrationAnalysisItem = {
    recommendation: recommendationText,
    effort: rowData.effort ? rowData.effort : '',
    objectName: objectName,
    itemType: rowData.fromComponentType,
    itemCount: typeCount,
  }

  return currentRsmi
}

function parseSummaryMigrationAnalysisEffortRow(
  effortRows: ReportSummaryMigrationAnalysisItem[],
): ReportSummaryMigrationAnalysisItem[] {
  const parsedRows: ReportSummaryMigrationAnalysisItem[] = []
  let currentObject: string = effortRows[0].objectName

  for (let i = 0; i < effortRows.length; i++) {
    if (i === 0) {
      parsedRows.push(effortRows[i])
    } else {
      if (effortRows[i].objectName === currentObject) {
        effortRows[i].recommendation = ''
        effortRows[i].effort = ''
        effortRows[i].objectName = ''

        parsedRows.push(effortRows[i])
      } else {
        effortRows[i].recommendation = ''
        effortRows[i].effort = ''

        parsedRows.push(effortRows[i])
        currentObject = effortRows[i].objectName
      }
    }
  }

  return parsedRows
}

async function checkNonAdminPermissions(
  apiClient: SfApi,
  reportSummary: ReportSummary,
  assessmentId: string,
) {
  const jsonString: string = JSON.stringify(reportSummary)
  const reportSummaryMap: any = JSON.parse(jsonString)
  let isNonAdmin: boolean = false
  Object.getOwnPropertyNames(reportSummary).forEach((attribute) => {
    if (reportSummaryMap[attribute] === 'Unknown') {
      isNonAdmin = true
      return
    }
  })

  if (isNonAdmin) {
    await apiClient.updateRecordData(
      `${namespaceUnderscore}Assessment__c`,
      assessmentId,
      {
        [`${namespaceUnderscore}Is_Non_Admin_User__c`]: true,
      },
    )
  }
}

function checkSectionName(
  answerRecords: any[],
  mappedSections: Set<string>,
  answerApiName: string,
  questionLabelMap: Map<string, string>,
): boolean {
  let matchingAnswer: any
  answerRecords.forEach((aRecord) => {
    if (aRecord['DeveloperName'] === answerApiName) {
      matchingAnswer = aRecord
      return
    }
  })

  if (matchingAnswer) {
    //Get Section Label Name (OLD TODO: Update Question Groups to have a dedicated label field)
    const corSection: string =
      matchingAnswer['Question__r']['Question_Group__r']['MasterLabel'] +
      ' - ' +
      questionLabelMap.get(matchingAnswer['Question_Label__c'])
    return mappedSections.has(corSection)
  }

  return false
}

/********************************************************************************************************
 * ---Wrapper Objects---
 ********************************************************************************************************/

export class TransitionAnalysis {
  assessmentResults: AssessmentResultItem[]
  assessmentResultsListItems?: AssessmentResultItem[]
  migrationAnalysis: MigrationAnalysisItem[]
  accessInfoResults: MigrationAnalysisItem[]
  sharingSettingResults: MigrationAnalysisItem[]
  encryptionResults: MigrationAnalysisItem[]
  fieldAuditResults: MigrationAnalysisItem[]
  reportSummaryResults: ReportSummary

  constructor() {
    this.assessmentResults = []
    this.migrationAnalysis = []
    this.accessInfoResults = []
    this.sharingSettingResults = []
    this.encryptionResults = []
    this.fieldAuditResults = []
    this.reportSummaryResults = {}
  }
}

export class AssessmentResultItem {
  uuid: string
  priority: string
  reasonText: string
  goalText: string
  replaceWithFscUrl: string
  replaceWithFsc: string

  //HC-Specific
  iconOverride?: string
  featureText?: string
  recommendText?: string

  constructor(replaceWithFsc: string, priority: string) {
    this.uuid = uuid.v4()
    this.replaceWithFsc = replaceWithFsc
    this.priority = priority
    this.reasonText = ''
    this.goalText = ''
    this.replaceWithFscUrl = ''
    this.iconOverride = ''
    this.featureText = ''
    this.recommendText = ''
  }

  priorityNumber(): number {
    switch (this.priority) {
      case 'High':
        return 1
        break
      case 'Medium':
        return 2
        break
      default:
        return 3
        break
    }
  }
}

// Summary Objects
export interface NotableObject {
  objectName?: string
  recordCount?: number
  recordTypes?: string[]
  allRecordTypes?: string
  profiles?: string[]
  allProfiles?: string
  modifiedRecords?: number
}

export interface ReportSummaryMigrationAnalysisItem {
  recommendation: string
  effort: string
  objectName: string
  itemType: string
  itemCount: string
}

export interface ReportSummaryBasisOfAssessment {
  recommendation?: string
  feature?: string
  featureUrl?: string
  goal?: string
}

export interface ReportSummaryBasisOfAssessmentReason {
  reasonText: string
  children: AssessmentResultItem[]
}

//TODO: Since we're doing this in Apex, see if we should/can pass it up instead of making this also here (Option 2)
export interface InstallReadiness {
  isOrgInstallationReady: boolean
  isLicensesAvailable: boolean
  hasPackage: boolean
  hasLex: boolean
  hasPersonAccounts: boolean
  hasContactToMultipleAccounts: boolean
  statusReasons: string[]
}

export interface ReportSummary {
  licenseCount?: string
  assignedLicenseCount?: string
  profileCount?: string
  permissionSetCount?: string
  roleCount?: string
  flowCount?: string
  processBuilderFlowCount?: string
  workflowCount?: string
  queueCount?: string
  emailToCaseCount?: string
  customObjectCount?: string
  apexClassCount?: string
  apexTriggerCount?: string
  customAppCount?: string

  mappedObjectsCount?: number
  totalObjectsCount?: number
  mappedFieldsCount?: number
  totalFieldsCount?: number
  avgFieldsPerMappedObject?: number
  relatedObjectsNotMappedCount?: number

  profilesRelatedLegacyObjects?: number
  permissionSetsRelatedLegacyObjects?: number

  linesOfBusiness?: string[]

  dataUsage?: string
  fileStorageUsage?: string

  enabledChatFeatures?: string[]
  coreNotableObjects?: NotableObject[]
  additionalNotableObjects?: NotableObject[]

  migrationAnalysis?: ReportSummaryMigrationAnalysisItem[]

  basisOfAssessment?: ReportSummaryBasisOfAssessment[]

  recommendedSettings?: InstallReadiness
}
//END Summary Objects
