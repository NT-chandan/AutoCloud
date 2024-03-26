/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */

// Contains labels that are used in Salesforce, for their Heroku-equivalent operations
import { HEROKU_APP_NAME } from './secrets'
import { SfApi } from './sfApi'
import logger from './logger'
import { forceArray } from '../util/general'

export default class labels {
  // App references
  private static readonly FSC_REF = 'salesforce-f'
  private static readonly HC_REF = 'salesforce-h'
  private static readonly AC_REF = 'salesforce-a'
  private static readonly FSC = 'FSC'
  private static readonly HC = 'Health Cloud'
  private static readonly AC = 'Automotive Cloud'
  private static appReference = HEROKU_APP_NAME.startsWith(labels.FSC_REF)
    ? labels.FSC
    : HEROKU_APP_NAME.startsWith(labels.HC_REF)
    ? labels.HC
    : HEROKU_APP_NAME.startsWith(labels.AC_REF)
    ? labels.AC
    : ''

  //User Messages
  public static readonly RecComponentTypeAutomateDefault =
    'Can be automatically migrated. Use the Generate Changes tab to select and generate changes for deployment.'
  public static readonly RecComponentTypeDefault =
    'Requires manual review and cannot be automatically migrated.'

  //Effort Levels
  public static readonly EffortLabelLow = 'Low'
  public static readonly EffortLabelMedium = 'Medium'
  public static readonly EffortLabelHigh = 'High'

  public static readonly EffortRecommendationHigh = 'Requires manual migration'
  public static readonly EffortRecommendationMedium =
    'Automatic steps, requires additional consideration'
  public static readonly EffortRecommendationLow =
    'Can be automatically migrated'

  //Component-specific messages
  public static readonly RecComponentTypeApexClass =
    'Custom code requires technical review and cannot be automatically migrated.'
  public static readonly RecComponentTypeApexPage =
    'Requires technical review. Consider retiring remaining Visualforce pages and migrate to Lightning Web Components where still applicable.'
  public static readonly RecComponentTypeApexTrigger =
    'Custom database triggers require technical review. Evaluate the logic and determine whether it is still optimal to perform calculations in Apex or if can be consolidated into a Before/After Flow trigger. https://architect.salesforce.com/design/decision-guides/trigger-automation'
  public static readonly RecComponentTypeAuraComponentBundle =
    'Review Aura lightning component and make necessary code adjustments to apply on destination object. Consider migrating to LWC to optimize performance.'
  public static readonly RecComponentTypeContactB2C =
    'The Contact object must be converted into Person Account which is a record type on the Account object and includes all fields and relationships from both Account and Contact objects.'
  public static readonly RecComponentTypeCustomField = `Custom Fields that are mapped to target ${labels.appReference} objects will be matched to corresponding fields or replicated where missing.`
  public static readonly RecComponentTypeCustomObject = `Custom Objects can be transitioned to the ${labels.appReference} object model and will require data migration to move record data into the destination object.`
  public static readonly RecComponentTypeFlexiPage = `Lightning Pages need to be reviewed and will need to be manually updated to reflect ${labels.appReference} target objects.`
  public static readonly RecComponentTypeFlow = `Flows and Process Builder definitions need to be reviewed and updated to point to new ${labels.appReference} objects. Consider moving Process Builder flows to Before/After Flow Triggers to optimize performance. https://architect.salesforce.com/design/decision-guides/trigger-automation`
  public static readonly RecComponentTypeQuickAction =
    'Quick Actions can reference other objects, Lightning Components, or Flows and need to be manually reviewed by an expert prior to moving to the target object.'
  public static readonly RecComponentTypeSameTarget = `This object is not mapped to a new target ${labels.appReference} object and does not require migration of components or data. Review the dependent components and verify no new changes are required.`
  public static readonly RecComponentTypeStandardObject = `Standard Objects can be transitioned to the ${labels.appReference} object model and will require data migration to move record data into the destination object.`
  public static readonly RecComponentTypeWebLink =
    'URL Buttons and Links can contain merge fields and need to be manually reviewed by an expert prior to moving to the target object.'
  public static readonly RecComponentTypeWorkflowRule = `Workflow rules need to be reviewed. They can be migrated to ${labels.appReference} but consider transitioning Workflows to Before/After Flow Triggers to optimize performance. https://architect.salesforce.com/design/decision-guides/trigger-automation`

  //Component Names
  public static readonly TypeCustomObject = 'Custom Object'
  public static readonly TypeStandardObject = 'Standard Object'
  public static readonly TypeCustomField = 'Custom Field'
  public static readonly TypePageLayout = 'Page Layout'
  public static readonly TypeProfile = 'Profile'
  public static readonly TypePermissionSet = 'Permission Set'
  public static readonly TypeApprovalProcess = 'Approval Process'
  public static readonly TypeEmailAlert = 'Email Alert'
  public static readonly TypeOutboundMessage = 'Outbound Message'
  public static readonly TypeLightningPage = 'Lightning Page'
  public static readonly TypeValidationRule = 'Validation Rule'
  public static readonly TypeVisualforcePage = 'Visualforce Page'
  public static readonly TypeSharingSetting = 'SharingSetting'

  public static readonly TypeSharingCriteria = 'Sharing Rule (Criteria)'
  public static readonly TypeSharingRuleOwner = 'Sharing Rule (Owner)'
  public static readonly SharingRuleReimplement =
    'Sharing Criteria/Owner rules may have to be reimplemented.'
  public static readonly SharingApexReason = 'Apex Sharing Reason'
  public static readonly SharingSettingsApexReason =
    'Custom Apex Sharing Reason settings may either become obsolete or may need to be reimplemented.'
  public static readonly SharingSettingsCDSReason =
    'Apex class contains reference to a Compliant Data Sharing object, where the Apex is creating Share object entries.'

  public static readonly SharingControlledByCampaign = 'Controlled By Campaign'
  public static readonly SharingControlledByParent = 'Controlled By Parent'
  public static readonly SharingFullAccess = 'Public Full Access'
  public static readonly SharingPrivate = 'Private'
  public static readonly SharingReadSelect = 'Use'
  public static readonly SharingReadWrite = 'Public Read/Write'
  public static readonly SharingReadWriteTransfer = 'Public Read/Write/Transfer'
  public static readonly SharingRead = 'Public Read Only'

  //Post-Scan Labels
  public static readonly FeatureReasonDefault =
    'This feature will be available to use when needed'
  public static readonly EncryptionTypeClassic = 'Classic'
  public static readonly EncryptionTypeDeterministic = 'Deterministic'
  public static readonly EncryptionTypeProbabilistic = 'Probabilistic'

  //Report Summary Labels
  public static readonly NonAdminMessage = 'Unknown'
  public static readonly ReportSummaryOverviewEnabledFeatureChat = 'Web Chat'
  public static readonly ReportSummaryOverviewEnabledFeatureChatter = 'Chatter'
  public static readonly ReportSummaryOverviewEnabledFeatureOmnichannel =
    'Omni-Channel'

  //Report Section Names
  public static readonly ReportSectionWelcome = 'Welcome'
  public static readonly ReportSectionReportSummary = 'ReportSummary'
  public static readonly ReportSectionOverallRecommendation =
    'OverallRecommendation'
  public static readonly ReportSectionAssessmentResults = 'AssessmentResults'
  public static readonly ReportSectionMigrationAnalysis = 'MigrationAnalysis'
  public static readonly ReportSectionFieldAnalysis = 'FieldAnalysis'
  public static readonly ReportSectionSharingSettingAnalysis =
    'SharingSettingAnalysis'
  public static readonly ReportSectionProfileAnalysis = 'ProfileAnalysis'
  public static readonly ReportSectionComponentsNotCovered =
    'ComponentsNotCovered'
  public static readonly ReportSectionBestPractices = 'BestPractices'

  //Report Summary Section Names
  public static readonly ReportSummarySystemOverview =
    'ReportSummarySystemOverview'
  public static readonly ReportSummaryUsedObjects = 'ReportSummaryUsedObjects'
  public static readonly ReportSummaryRecommendedSettings =
    'ReportSummaryRecommendedSettings'
  public static readonly ReportSummaryMigrationAnalysis =
    'ReportSummaryMigrationAnalysis'
  public static readonly ReportSummaryConsiderations =
    'ReportSummaryConsiderations'
  public static readonly ReportSummaryBasisofAssessment =
    'ReportSummaryBasisofAssessment'
  public static readonly ReportSummaryTransitionApproach =
    'ReportSummaryTransitionApproach'

  //Maps
  public static readonly TYPE_TO_LABEL = new Map<string, string>([
    ['CustomObject', labels.TypeCustomObject],
    ['CustomField', labels.TypeCustomField],
    ['StandardEntity', labels.TypeStandardObject],
    ['Layout', labels.TypePageLayout],
    ['Profile', labels.TypeProfile],
    ['PermissionSet', labels.TypePermissionSet],
    ['ProcessDefinition', labels.TypeApprovalProcess],
    ['WorkflowAlert', labels.TypeEmailAlert],
    ['WorkflowOutboundMessage', labels.TypeOutboundMessage],
    ['FlexiPage', labels.TypeLightningPage],
    ['ApexPage', labels.TypeVisualforcePage],
    ['ValidationRule', labels.TypeValidationRule],
  ])

  public static readonly ENCRYPTION_TYPE_TO_LABEL = new Map<string, string>([
    ['Classic', labels.EncryptionTypeClassic],
    ['Deterministic', labels.EncryptionTypeDeterministic],
    ['Probabilistic', labels.EncryptionTypeProbabilistic],
  ])

  public static readonly SHARING_VALUE_TO_LABEL = new Map<string, string>([
    ['ControlledByCampaign', labels.SharingControlledByCampaign],
    ['ControlledByParent', labels.SharingControlledByParent],
    ['FullAccess', labels.SharingFullAccess],
    ['Private', labels.SharingPrivate],
    ['ReadSelect', labels.SharingReadSelect],
    ['ReadWrite', labels.SharingReadWrite],
    ['ReadWriteTransfer', labels.SharingReadWriteTransfer],
    ['Read', labels.SharingRead],
  ])
}

/********************************************************************************************************
 * Get Custom Label from Salesforce
 ********************************************************************************************************/
export async function getSFDCLabel(
  apiClient: SfApi,
  refClient: SfApi,
  labelNames: string[],
  namespace: string,
): Promise<Map<string, string>> {
  const customLabelMap: Map<string, any> = new Map()
  const andNamespace = namespace ? ` AND NamespacePrefix = '${namespace}'` : ''
  let query =
    `SELECT Id, Name, MasterLabel, Value, NamespacePrefix FROM CustomLabel WHERE Name IN ('${labelNames.join(
      "', '",
    )}')` + andNamespace
  logger.debug(`==Preview query: ${query}`)
  const result = await apiClient.getToolingQuery(query)
  if (result) {
    // eslint-disable-next-line no-var
    var labelRecords: any[] = forceArray(result.records)
    labelRecords.forEach((label) => {
      logger.debug(`==Label: ${JSON.stringify(label)}`)
      // if(label['NamespacePrefix']){
      //     customLabelMap.set(label['NamespacePrefix'] + '__' + label['Name'], label['Value']);
      // }else{
      //     customLabelMap.set(label['Name'], label['Value']);
      // }
      customLabelMap.set(label['Name'], label['Value'])
    })
  }
  query = `SELECT Id, Name, MasterLabel, Value, NamespacePrefix FROM CustomLabel WHERE Name IN ('${labelNames.join(
    "', '",
  )}') AND NamespacePrefix = ''`
  const schemaOrgResult = await refClient.getToolingQuery(query)
  if (schemaOrgResult) {
    // eslint-disable-next-line no-var
    var labelRecords: any[] = forceArray(schemaOrgResult.records)
    labelRecords.forEach((label) => {
      logger.debug(`==Label: ${JSON.stringify(label)}`)
      // if(label['NamespacePrefix']){
      //     customLabelMap.set(label['NamespacePrefix'] + '__' + label['Name'], label['Value']);
      // }else{
      //     customLabelMap.set(label['Name'], label['Value']);
      // }
      customLabelMap.set(label['Name'], label['Value'])
    })
  }
  return customLabelMap
}
