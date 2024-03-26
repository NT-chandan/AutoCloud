/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Process upgrade analysis results
 */
public inherited sharing class TransitionAnalysis {
    @AuraEnabled public List<AssessmentResultItem> assessmentResults;
    @AuraEnabled public List<AssessmentResultItem> assessmentResultsListItems;
    @AuraEnabled public List<MigrationAnalysisItem> migrationAnalysis;
    @AuraEnabled public List<MigrationAnalysisItem> accessInfoResults;
    @AuraEnabled public List<MigrationAnalysisItem> sharingSettingResults;
    @AuraEnabled public List<MigrationAnalysisItem> encryptionResults;
    @AuraEnabled public List<MigrationAnalysisItem> fieldAuditResults;
    @AuraEnabled public List<AssessmentResultItem> orgOverviewResults;
    @AuraEnabled public ReportSummary reportSummaryResults;

    private static final String ASSESSMENT_FILE_ANALYSIS = 'analysis';
    private static final String MIGRATION_FILE_ANALYSIS = 'Migration-Analysis_';

    private static final String ENCRYPTION_TYPE_CLASSIC = 'Classic';
    private static final String ENCRYPTION_TYPE_DETERMINISTIC = 'Deterministic';
    private static final String ENCRYPTION_TYPE_PROBABILISTIC = 'Probabilistic';

    private static final String FIELD_TRACKING_CLASSIC = 'Field History Tracking';
    private static final String FIELD_TRACKING_SHIELD = 'Field Audit Trail';

    private static final String DEFAULT_ARCHIVE_AFTER_MONTHS = '18';
    private static final String DEFAULT_ARCHIVE_RETENTION_YEARS = '2';
    private static final String SHIELD_ARCHIVE_RETENTION_YEARS = '10';

    private static final String SECTION_NAME_ASSESSMENT_RESULTS = 'AssessmentResults';
    private static Utilities.Warnings LIMIT_CHECK = new Utilities.Warnings();

    /**
     * Component types that can automatically be migrated
     */
    public static final Set<String> COMPONENT_TYPES_DEPLOYABLE = new Set<String>{
        DependencyHelper.TYPE_CUSTOM_OBJECT,
        DependencyHelper.TYPE_RECORD_TYPE,
        DependencyHelper.TYPE_CUSTOM_FIELD,
        DependencyHelper.TYPE_FIELD_SET,
        DependencyHelper.TYPE_PAGE_LAYOUT,
        DependencyHelper.TYPE_COMPACT_LAYOUT,
        DependencyHelper.TYPE_LIST_VIEW,
        DependencyHelper.TYPE_PERMISSION_SET,
        DependencyHelper.TYPE_PROFILE,
        DependencyHelper.TYPE_EMAIL_TEMPLATE,
        DependencyHelper.TYPE_VALIDATION_RULE
        //DependencyHelper.TYPE_APPROVAL_PROCESS,
        //DependencyHelper.TYPE_WOKFLOW_RULE,
        //DependencyHelper.TYPE_EMAIL_ALERT,
        //DependencyHelper.TYPE_FIELD_UPDATE,
        //DependencyHelper.TYPE_OUTBOUND_MESSAGE,
        //DependencyHelper.TYPE_WORKFLOW_TASK
    };

    /**
     * Sharing Setting Labels
     */
    private static final Map<String, String> SHARING_VALUE_TO_LABEL = new Map<String, String>{
        'ControlledByCampaign' => Label.SharingControlledByCampaign,
        'ControlledByParent' => Label.SharingControlledByParent,
        'FullAccess' => Label.SharingFullAccess,
        'Private' => Label.SharingPrivate,
        'ReadSelect' => Label.SharingReadSelect,
        'ReadWrite' => Label.SharingReadWrite,
        'ReadWriteTransfer' => Label.SharingReadWriteTransfer,
        'Read' => Label.SharingRead
    };

    /**
     * Encryption Type Labels
     */
    private static final Map<String, String> ENCRYPTION_TYPE_TO_LABEL = new Map<String, String> {
            'Classic' => Label.EncryptionTypeClassic,
            'Deterministic' => Label.EncryptionTypeDeterministic,
            'Probabilistic' => Label.EncryptionTypeProbabilistic
    };

    public static Id assessmentIdStatic;
    private Assessment__c assessment;
    private MappingService.MappedComponents mapping;

    public TransitionAnalysis() {
    }

    public TransitionAnalysis(Id assessmentId) {
        //load record and saved object mapping
        this.assessment = AssessmentService.queryAssessment(assessmentId);
        this.mapping = MappingService.parseMappedComponents(assessment);
    }

    public void prepareAndCompleteAnalysis(Id assessmentId) {
        TransitionAnalysis transitionAnalysis = new TransitionAnalysis(assessmentId);
        //TODO: Potential try-catch might be added here to cirumvent error when timing out 
        //transitionAnalysis.generateAnalysis();
        // END TODO
        TransitionReadinessUtility.completeAssessmentAnalysis(assessmentId, transitionAnalysis);
    }

    /**
     * Load Analysis File and return this data type instance
     */
    public static TransitionAnalysis loadAnalysis(Id assessmentId) {
        TransitionAnalysis analysis;
        String analysisJson = FileUtility.readFileDataString(assessmentId, ASSESSMENT_FILE_ANALYSIS);
        if (String.isNotBlank(analysisJson)) {
            analysis = (TransitionAnalysis) JSON.deserialize(analysisJson, TransitionAnalysis.class);
        }
        return analysis;
    }

    /**
     * Save Analysis File and return file Id
     */
    public static Id saveAnalysis(Id assessmentId, TransitionAnalysis analysis) {
        //prevent saving private instance variables
        analysis.assessment = null;
        analysis.mapping = null;
        //save instance as result file         
        return FileUtility.writeFileData(assessmentId, ASSESSMENT_FILE_ANALYSIS, 'json', JSON.serialize(analysis, true)); //suppress nulls
    }

    public Id saveMigrationAnalysis(Id assessmentId, Id requestId, List<MigrationAnalysisItem> migrationAnalysisItems) {
        //List<MigrationAnalysisItem> items = buildTypeGrouping(buildMissingRelationships(migrationAnalysisItems, mapping), mapping);
        List<MigrationAnalysisItem> items = new List<MigrationAnalysisItem>();
        return FileUtility.writeFileData(assessmentId, MIGRATION_FILE_ANALYSIS + requestId, 'json', JSON.serialize(items, true)); //suppress nulls
    }

    /**
     * Generate TransitionAnalysis with recommendations for Report Results view
     * @param migrationAnalysis - previously generated MigrationAnalysisItem tree with DAPI results
     */
    public TransitionAnalysis generateAnalysis(List<MigrationAnalysisItem> migrationAnalysisItems) {
        this.migrationAnalysis = migrationAnalysisItems;
        //yyyyyyyyyynhnk
        return generateAnalysis();
    }

    public TransitionAnalysis generateAnalysis() {
        if (this.migrationAnalysis == null) {
            //generate finalized Migration Analysis
            //this.migrationAnalysis = buildMigrationAnalysis(assessment.Id);
        }

        //generate summary Assessment Results
        //this.assessmentResults = buildAssessmentResults(assessment);
        //this.assessmentResultsListItems = buildAssessmentListItems(assessment);

        //generate Permission Results
        //this.accessInfoResults = buildAccessInfoResults(mapping.mappedObjects, mapping.mappedFields);

        //generate Sharing Results
        //this.sharingSettingResults = buildSharingSettingResults(assessment, mapping.sourceToDestinationObject, mapping.mappedObjects);

        //this.orgOverviewResults = buildOrgOverviewResults(assessment);

        //generate Encryption (Classic and Shield) Results
        if(!Test.isRunningTest()){
            //this.encryptionResults = buildEncryptionResults(mapping);
        }
       
        return this;
    }
    
    private static String getObjectFieldHistoryUrl(String objectId) {
        return URL.getSalesforceBaseUrl().toExternalForm() + '/lightning/setup/ObjectManager/' + objectId + '/FieldsAndRelationships/setHistoryTracking';
    }
    
    public static Map<String, Map<String, String>> getApexSharingReasons(Set<String> sourceObjects) {
        Map<String, Map<String, String>> sharingReasonMap = new Map<String, Map<String, String>>();
        Set<String> customObjects = new Set<String>();

        //Filter list to have only Custom Objects
        for (String objectApiName : sourceObjects) {
            if (objectApiName.endsWith('__c')) {
                customObjects.add(objectApiName);
            }
        }

        //Grab the Picklist Entries for the Share object variant of the Custom Object. The entries contain the Apex Sharing
        // Reason with a __c suffix.
        for (String customObject : customObjects) {
            String shareObjectApiName = customObject.replace('__c', '__share');
            if (SchemaService.GLOBAL_DESCRIBE.containsKey(shareObjectApiName)) {
                if (SchemaService.getFieldMap(shareObjectApiName).containsKey('RowCause')) {
                    List<Schema.PicklistEntry> entries = SchemaService.getPicklistValues(shareObjectApiName, 'RowCause');

                    //Find the Apex Sharing Reasons
                    for (Schema.PicklistEntry entry : entries) {
                        String entryValue = entry.getValue();
                        if (entryValue.endsWith('__c')) {
                            if (!sharingReasonMap.containsKey(shareObjectApiName)) {
                                sharingReasonMap.put(shareObjectApiName, new Map<String, String>());
                            }
                            sharingReasonMap.get(shareObjectApiName).put(entry.getLabel(), entry.getValue());
                        }
                    }
                }
            }
        }

        return sharingReasonMap;
    }

    public static String getSharingSettingLabel(String value) {
        String label = SHARING_VALUE_TO_LABEL.get(value);
        return String.isNotBlank(label) ? label : value;
    }

    

    public static List<EntityDefinition> getEntityDefinitions(Set<String> sObjectDeveloperNames) {
        return [SELECT Label, DeveloperName, QualifiedApiName, ExternalSharingModel, InternalSharingModel, DurableId FROM EntityDefinition WHERE QualifiedApiName IN :sObjectDeveloperNames];
    }
    /**
     * Custom Exceptions
     */
    public class AnalysisException extends Exception {
    }


    /**
     * Wrappers for LWC
     */

    /**
     * Assessment Results section data list type
     */
    public class AssessmentResultItem implements Comparable {
        @AuraEnabled public String uuid;
        @AuraEnabled public String priority;
        @AuraEnabled public String reasonText;
        @AuraEnabled public String goalText;
        @AuraEnabled public String replaceWithFscUrl;
        @AuraEnabled public String replaceWithFsc;
        @AuraEnabled public String iconOverride;

        //NEWER FIELDS FOR FEATURES
        @AuraEnabled public String featureText;
        @AuraEnabled public String recommendText;
        //@AuraEnabled public List<AssessmentResultItem> children;

        public AssessmentResultItem(String replaceWithFsc, String priority) {
            this.replaceWithFsc = replaceWithFsc;
            this.priority = priority;
            this.uuid = Utilities.uuid();
        }

        /*public void addChild(AssessmentResultItem child) {
            if (this.children == null) {
                this.children = new List<AssessmentResultItem>();
            }
            this.children.add(child);
        }*/

        public Integer compareTo(Object compareTo) {
            AssessmentResultItem compareToObj = (AssessmentResultItem) compareTo;
            Map<String, Integer> sortMap = new Map<String, Integer>{
                'High' => 1,
                'Medium' => 2,
                'Low' => 3
            };
            if (sortMap.get(priority) == sortMap.get(compareToObj.priority)) return 0;
            if (sortMap.get(priority) > sortMap.get(compareToObj.priority)) return 1;
            return -1;
        }
    }

    /**
     * TODO: Build this out as Report Summary becomes more dynamic
     * Wrapper for data points relevant to the Report Summary (aka Executive Summary)
     */
    public class ReportSummary {

        @AuraEnabled public String licenseCount;
        @AuraEnabled public String assignedLicenseCount;
        @AuraEnabled public String profileCount;
        @AuraEnabled public String permissionSetCount;
        @AuraEnabled public String roleCount;
        @AuraEnabled public String flowCount;
        @AuraEnabled public String processBuilderFlowCount;
        @AuraEnabled public String workflowCount;
        @AuraEnabled public String queueCount;
        @AuraEnabled public String emailToCaseCount;
        @AuraEnabled public String customObjectCount;
        @AuraEnabled public String apexClassCount;
        @AuraEnabled public String apexTriggerCount;
        @AuraEnabled public String customAppCount;

        @AuraEnabled public Integer mappedObjectsCount;
        @AuraEnabled public Integer totalObjectsCount;
        @AuraEnabled public Integer mappedFieldsCount;
        @AuraEnabled public Integer totalFieldsCount;
        @AuraEnabled public Integer avgFieldsPerMappedObject;
        @AuraEnabled public Integer relatedObjectsNotMappedCount;

        @AuraEnabled public Integer profilesRelatedLegacyObjects;
        @AuraEnabled public Integer permissionSetsRelatedLegacyObjects;

        @AuraEnabled public List<String> linesOfBusiness = new List<String>();

        @AuraEnabled public String dataUsage;
        @AuraEnabled public String fileStorageUsage;
        // TODO: Determine the format this chatSetup data takes
        @AuraEnabled public List<String> enabledChatFeatures = new List<String>();
        @AuraEnabled public List<NotableObject> coreNotableObjects;
        @AuraEnabled public List<NotableObject> additionalNotableObjects;

        @AuraEnabled public List<ReportSummaryMigrationAnalysisItem> migrationAnalysis = new List<ReportSummaryMigrationAnalysisItem>();

        @AuraEnabled public List<ReportSummaryBasisOfAssessment> basisOfAssessment = new List<ReportSummaryBasisOfAssessment>();

        @AuraEnabled public TransitionReadinessUtility.InstallReadiness recommendedSettings;
    }

    /**
    * Org Overview for the Executive Summary section data list type
    */
    public class OrgDetailItem {
        @AuraEnabled public String uuid;
        @AuraEnabled public String orgDetailName;
        @AuraEnabled public String orgDetailValue;
    }

    /**
     * Notable Objects for the Executive Summary section data list type
     */
    public class NotableObject implements Comparable {
        @AuraEnabled public String objectName;
        @AuraEnabled public Integer recordCount;
        @AuraEnabled public List<String> recordTypes = new List<String>();
        @AuraEnabled public String allRecordTypes;
        @AuraEnabled public List<String> profiles = new List<String>();
        @AuraEnabled public String allProfiles;
        @AuraEnabled public Integer modifiedRecords;

        // Implement sorting function to allow sorting of a list of record counts
        public Integer compareTo(Object compareTo) {

            NotableObject compareToNo = (NotableObject)compareTo;

            if(recordCount == compareToNo.recordCount) return 0;
            if(recordCount > compareToNo.recordCount) return -1;
            return 1;
        }
    }
    public class RecordCount {
        @AuraEnabled public List<RecordCountObject> sObjects = new List<RecordCountObject>();
    }
    public class RecordCountObject implements Comparable {
        @AuraEnabled public Integer count;
        @AuraEnabled public String name;

        // Implement sorting function to allow sorting of a list of record counts
        public Integer compareTo(Object compareTo) {

            RecordCountObject compareToRco = (RecordCountObject)compareTo;

            if(count == compareToRco.count) return 0;
            if(count > compareToRco.count) return -1;
            return 1;
        }
    }

    /**
     * Migration Analysis Summary Items for the Executive Summary section data list type
     */
    public class ReportSummaryMigrationAnalysisItem {

        @AuraEnabled public String recommendation = '';
        @AuraEnabled public String effort = '';
        @AuraEnabled public String objectName = '';
        @AuraEnabled public String itemType = '';
        @AuraEnabled public String itemCount = '';
        
    }

    /**
     * Basis Of Assessment Items for the Executive Summary section data list type
     */
    public class ReportSummaryBasisOfAssessment {
        @AuraEnabled public String recommendation;
        @AuraEnabled public String feature;
        @AuraEnabled public String featureUrl;
        @AuraEnabled public String goal;
    }

    public class ReportSummaryBasisOfAssessmentReason {
        @AuraEnabled public String reasonText;
        @AuraEnabled public List<AssessmentResultItem> children = new List<AssessmentResultItem>();
    }

    /**
     * Migration Analysis section tree grid data list type
     */
    public class MigrationAnalysisItem implements Comparable {
        @AuraEnabled public String uuid = Utilities.uuid();
        public String fromComponentId;
        @AuraEnabled public String fromComponentName;
        @AuraEnabled public String fromComponentType;
        @AuraEnabled public String fromComponentUrl;
        @AuraEnabled public String fromComponentSize;
        @AuraEnabled public String fromComponentInternalSharing;
        @AuraEnabled public String fromComponentExternalSharing;
        @AuraEnabled public String fromComponentArchiveAfterMonths;
        @AuraEnabled public String fromComponentArchiveRetentionYears;
        @AuraEnabled public String toComponentName;
        @AuraEnabled public String toComponentUrl;
        @AuraEnabled public String reasonText;
        @AuraEnabled public String effort;
        @AuraEnabled public List<MigrationAnalysisItem> children = new List<MigrationAnalysisItem>();

        public Integer compareTo(Object compareTo) {
            MigrationAnalysisItem compareToObj = (MigrationAnalysisItem) compareTo;

            if (fromComponentName == null) {
                return -1;
            } else if (compareToObj.fromComponentName == null) {
                return 1;
            }

            if(fromComponentName.compareTo(compareToObj.fromComponentName)!=0){
                return fromComponentName.compareTo(compareToObj.fromComponentName);
            }

            // Integer thisInt = Integer.valueOf(reasonText);
            // Integer thatInt = Integer.valueOf(compareToObj.reasonText);

            // if (thisInt > thatInt) {
            //     return -1;
            // } else if (thisInt < thatInt) {
            //     return 1;
            // }

            return fromComponentName.compareTo(compareToObj.fromComponentName);
        }

        public Boolean equals(Object obj) {
            // Your implementation
            if (obj instanceof MigrationAnalysisItem) {
                MigrationAnalysisItem m = (MigrationAnalysisItem)obj;
                return fromComponentName.equals(m.fromComponentName);
            }
            return false;
        }
    }

    public class TransitionAnalysisParams {
        public String dataType;
        public List<ToolingService.MetadataComponentDependency> metadataComponentDependencies;
        public List<MigrationAnalysisItem> migrationAnalysisItems;
    }
}