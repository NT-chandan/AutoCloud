export interface XlsxContent {
  Sheets: {
    Name: string
    Columns: { Name: string; Width: number }[]
    DataRows: string[][]
  }[]
}

export interface PdfContent {
  analysisDocumentId: string
  label: any
  assessment: any
  sections: any
  assessmentResults: AssessmentResultsView
  type: string
  mode: string
  hideSummary: boolean
}

export interface AnalysisResults {
  assessmentResults?: MigrationAnalysisItem[]
  migrationAnalysis?: MigrationAnalysisItem[]
  accessInfoResults?: MigrationAnalysisItem[]
  sharingSettingResults?: MigrationAnalysisItem[]
  encryptionResults?: MigrationAnalysisItem[]
  fieldAuditResults?: MigrationAnalysisItem[]
  reportSummaryResults?: ReportSummary
}

interface AssessmentResultsView {
  assessmentVersion: string
  dateRun: Date
  Id: string
  orgEdition: string
  upgradeType: string
  installReadiness: InstallReadiness
  overallRecommendation: RecommendationView
  recommendations: RecommendationView[]
  preSalesItems?: PreSalesItem[]
  reportSummary?: ReportSummary
  assessmentResults?: MigrationAnalysisItem[]
  migrationAnalysis?: MigrationAnalysisItem[]
  accessInfoResults?: MigrationAnalysisItem[]
  sharingSettingResults?: MigrationAnalysisItem[]
  encryptionResults?: MigrationAnalysisItem[]
  fieldAuditResults?: MigrationAnalysisItem[]
  reportSummaryResults?: ReportSummary
}

interface RecommendationView {
  text: string
  reasons: RecommendationReason[]
  severityIcon: string
}

interface RecommendationReason {
  title: string
  reason: string
  hasDescription: string
  description: string
}

interface MigrationAnalysisItem {
  uuid: string
  fromComponentId: string
  fromComponentName: string
  fromComponentType: string
  fromComponentUrl: string
  fromComponentInternalSharing: string
  fromComponentExternalSharing: string
  fromComponentSize: string
  toComponentName: string
  toComponentUrl: string
  reasonText: string
  children: MigrationAnalysisItem[]
}

interface InstallReadiness {
  hasContactToMultipleAccounts: boolean
  hasLex: boolean
  hasPackage: boolean
  hasPersonAccounts: boolean
  isLicensesAvailable: boolean
  isOrgInstallationReady: boolean
}

interface ReportSummary {
  apexClassCount: string
  apexTriggerCount: string
  assignedLicenseCount: string
  customAppCount: string
  customObjectCount: string
  dataUsage: string
  emailToCaseCount: string
  enabledChatFeatures: string[]
  fileStorageUsage: string
  flowCount: string
  licenseCount: string
  permissionSetCount: string
  processBuilderFlowCount: string
  profileCount: string
  queueCount: string
  roleCount: string
  workflowCount: string
  linesOfBusiness: string[]
  recommendedSettings: ReportSummaryRecommendedSettings
  notableObjects: ReportSummaryNotableObject[]
  overallRecommendation: RecommendationView
  majorConsiderationsData: RecommendationView[]
  basisOfAssessment: ReportSummaryBasisOfAssessment[]
  migrationAnalysis: ReportSummaryMigrationAnalysis[]
  recommendations: RecommendationView[]
}

interface ReportSummaryRecommendedSettings {
  hasContactToMultipleAccounts: boolean
  hasLex: boolean
  hasPackage: boolean
  hasPersonAccounts: boolean
  isLicensesAvailable: boolean
  isOrgInstallationReady: boolean
}

interface ReportSummaryNotableObject {
  modifiedRecords: string
  objectName: string
  recordCount: string
  allRecordTypes: string
  allProfiles: string
}

interface ReportSummaryBasisOfAssessment {
  replaceWithFsc: string
  replaceWithFscUrl: string
  goalText: string
  reasonText: string
}

interface ReportSummaryMigrationAnalysis {
  recommendation: string
  effort: string
  object: string
  itemType: string
  number: string
}

interface PreSalesItem {
  iconOverride: string
  reasonText: string
}