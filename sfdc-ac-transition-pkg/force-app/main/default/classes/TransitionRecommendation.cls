/*
* Copyright (c) 2023, Salesforce, Inc.
* All rights reserved.
* SPDX-License-Identifier: Apache 2.0 Clause
* For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
*/
/**
* Define and execute actions for individual recommendations to make on an industry upgrade assessment
*/
public inherited sharing virtual class TransitionRecommendation extends TransitionRecommendationBase {
    
    //Recommendation Check values
    private static final IntMap LIMIT_MAP;
    static {
        LIMIT_MAP = new IntMap();
        String query = 'SELECT DeveloperName, Value__c FROM SFDC_Limit__mdt';
        
        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        List<SFDC_Limit__mdt> limitMetaList = (List<SFDC_Limit__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Limit__mdt>.class);
        
        for (SFDC_Limit__mdt limitMeta : limitMetaList) {
            LIMIT_MAP.put(limitMeta.DeveloperName, Integer.valueOf(limitMeta.Value__c));
        }
    }
    private static final Integer ACCOUNT_HIERARCHY_WARN_THRESHOLD_PERCENT = LIMIT_MAP.get('AccountHierarchyWarnThresholdPercent', 0);
    private static final Integer RECORD_COUNT_HIGH_DATA_VOLUME_WARN = LIMIT_MAP.get('RecordCountHighVolume', 0);
    
    //Salesforce Limits
    private static final Integer CUSTOM_OBJECT_LIMIT = LIMIT_MAP.get('CustomObjectLimit', 0); //including managed packages
    private static final Integer CUSTOM_FIELD_LIMIT = LIMIT_MAP.get('CustomFieldLimitObject', 0); //800 max including managed packages
    private static final Integer CUSTOM_FIELD_LIMIT_ACTIVITIES = LIMIT_MAP.get('CustomFieldLimitActivity', 0); //20 professional edition -- support?
    private static final Integer LOOKUP_FIELD_LIMIT = LIMIT_MAP.get('CustomFieldLimitLookup', 0);
    private static final Integer LOOKUP_FIELD_LIMIT_ACTIVITIES_PER_OBJ = LIMIT_MAP.get('CustomFieldLimitLookupActivityPerObj', 0);
    private static final Integer MD_FIELD_LIMIT = LIMIT_MAP.get('CustomFieldLimitMasterDetail', 0);
    private static final Integer FK_FIELD_HARD_LIMIT = LIMIT_MAP.get('CustomFieldLimitForeignKeys', 0); //default 40 contact AE to increase to 50
    
    //FSC Package Stats
    //TODO could obtain and parse from ExternalUtilities.requestFSCObjectSchema(new List<String>{'Lead','Account', 'Contact', 'Opportunity', 'Task', 'Event'})
    private static final Integer FSC_FIELD_COUNT_LEAD = LIMIT_MAP.get('FSC_FieldCountLead', 9999);
    private static final Integer FSC_FIELD_COUNT_ACCOUNT = LIMIT_MAP.get('FSC_FieldCountAccount', 9999);
    private static final Integer FSC_FIELD_COUNT_CONTACT = LIMIT_MAP.get('FSC_FieldCountContact', 9999);
    private static final Integer FSC_FIELD_COUNT_OPPORTUNITY = LIMIT_MAP.get('FSC_FieldCountOpportunity', 9999);
    private static final Integer FSC_FIELD_COUNT_ACTIVITY = LIMIT_MAP.get('FSC_FieldCountActivity', 9999);
    private static final Integer FSC_FK_COUNT_LEAD = LIMIT_MAP.get('FSC_FieldCountLeadForeignKeys', 9999); //lookups account and contact
    private static final Integer FSC_FK_COUNT_ACCOUNT = LIMIT_MAP.get('FSC_FieldCountAccountForeignKeys', 9999); //lookup contact primary contact
    private static final Integer FSC_FK_COUNT_CONTACT = LIMIT_MAP.get('FSC_FieldCountContactForeignKeys', 9999); //lookup contact and user
    private static final Integer FSC_FK_COUNT_OPPORTUNITY = LIMIT_MAP.get('FSC_FieldCountOpportunityForeignKeys', 9999); //account, contact, user and financial account
    private static final Integer FSC_FK_COUNT_ACTIVITY = LIMIT_MAP.get('FSC_FieldCountActivityForeignKeys', 9999); //lookup Account for household
    private static final String FSC_NAMESPACE_PREFIX = 'FinServ__';
    
    private static final String MULTI_CURRENCY_OBJECT_NAME = 'CurrencyType';
    private static final String ACM_OBJECT_NAME = 'DatedConversionRate';
    private static final String EMAIL_TYPE_CLASSIC = 'Aloha';
    
    private static final Map<String, Integer> STANDARD_OBJECT_FSC_LIMITS_MAP = new Map<String, Integer> {
        'Lead' => FSC_FIELD_COUNT_LEAD,
            'Account' => FSC_FIELD_COUNT_ACCOUNT,
            'Contact' => FSC_FIELD_COUNT_CONTACT,
            'Opportunity' => FSC_FIELD_COUNT_OPPORTUNITY
            };
                
                private static final Set<String> OBJECTS_CHECK_HIGH_VOLUME = new Set<String> {
                    'Account',
                        'Contact'
                        };
                            
                            //Check for Einstein feature licenses
                            private static final Set<String> FEATURE_LICENSE_KEYS = new Set<String> {
                                'Einstein%'
                                    };
                                        
                                        //Check for Communities Users
                                        private static final Set<String> USER_LICENSE_KEYS = new Set<String> {
                                            'PID_Customer_Community%',
                                                'PID_Partner_Community%'
                                                };
                                                    
                                                    //Upgrade recommendation complexity thresholds
                                                    //tbd may need some form fuzzy logic convert reasons to complexity values
                                                    //TODO move config to custom metadata
                                                    public static final Integer COMPLEXITY_THRESHOLD_BROWNFIELD_EASY = 2;
    public static final Integer COMPLEXITY_THRESHOLD_BROWNFIELD_COMPLEX = 4;
    public static final Integer COMPLEXITY_THRESHOLD_SCALE = 5; //values ranked 1-5
    
    public static final String OWD_CONTROLLED_BY_PARENT = 'ControlledByParent';
    
    public static final String SHARING_SETTINGS_RECOMMENDATION_TEXT = 'sharingSettingsCheck';
    public static final String SHARING_SETTINGS_APEX_SHARE_REASON = 'sharingSettingsHasApexSharing';
    public static final String SHARING_SETTINGS_CDS_REASON = 'sharingSettingsCDSReason';
    
    //Rec Records
    public static List<SFDC_Recommendation__mdt> allRecRecords {
        get {
            if (allRecRecords == null) {
                String query = 'SELECT Id, DeveloperName, MasterLabel, Custom_Label__c, Recommendation_Apex__c, Recommendation_Description_Label__c, Recommendation_Description_Title_Label__c FROM SFDC_Recommendation__mdt';
                
                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                for(Object a : metaRecords){
                    System.debug(a);
                }
                allRecRecords = (List<SFDC_Recommendation__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Recommendation__mdt>.class);
            }
            return allRecRecords;
        }
        private set;
    }
    
    //Recommendation Actions
    public static Map<String,String> apexActionMap {
        get {
            if (apexActionMap == null) {
                StringMap textMap = new StringMap();
                //SFDC_Recommendation__mdt.getAll().values();
                String query = 'SELECT DeveloperName, Recommendation_Apex__c FROM SFDC_Recommendation__mdt WHERE Recommendation_Apex__c != null';
                
                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Recommendation__mdt> recList = (List<SFDC_Recommendation__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Recommendation__mdt>.class);
                
                for (SFDC_Recommendation__mdt recMeta : recList) {
                    textMap.put(recMeta.DeveloperName, Utilities.namespaceDot+recMeta.Recommendation_Apex__c);
                }
                apexActionMap = textMap.getMap();
            }
            return apexActionMap;
        }
        private set;
    }
    
    //Recommendation Texts
    public static Map<String,String> recommendTextMap {
        get {
            if (recommendTextMap == null) {
                StringMap textMap = new StringMap();
                System.debug('allRecords======> ' + allRecRecords);
                for (SFDC_Recommendation__mdt recMeta : allRecRecords) {
                    
                    textMap.put(recMeta.DeveloperName, ToolingService.customLabelMap.get(Utilities.namespaceUnderscore+recMeta.Custom_Label__c));
                }
                recommendTextMap = textMap.getMap();
            }
            return recommendTextMap;
        }
        private set;
    }
    
    public static Map<String, String> recommendationDescriptionMap {
        get {
            if (recommendationDescriptionMap == null) {
                recommendationDescriptionMap = new Map<String, String>();
                for (SFDC_Recommendation__mdt recommendation : allRecRecords) {
                    if(recommendation.Recommendation_Description_Label__c != null) {
                        recommendationDescriptionMap.put(
                            recommendation.DeveloperName, 
                            ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + recommendation.Recommendation_Description_Label__c
                                                             ));
                    }
                }
            }
            return recommendationDescriptionMap;
        }
        set;
    }
    
    public static Map<String, String> recommendationDescriptionTitleMap {
        get {
            if (recommendationDescriptionTitleMap == null) {
                recommendationDescriptionTitleMap = new Map<String, String>();
                for (SFDC_Recommendation__mdt recommendation : allRecRecords) {
                    if(recommendation.Recommendation_Description_Label__c != null) {
                        recommendationDescriptionTitleMap.put(
                            recommendation.DeveloperName, 
                            ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + recommendation.Recommendation_Description_Title_Label__c
                                                             ));
                    }
                }
            }
            return recommendationDescriptionTitleMap;
        }
        set;
    }
    
    //managed packages with known limitations
    public static Map<String,ISV_Limitation_Warning__mdt> isvWarningMap {
        get {
            if (isvWarningMap == null) {
                isvWarningMap = new Map<String,ISV_Limitation_Warning__mdt>();
                String query = 'SELECT Id, DeveloperName, MasterLabel, Custom_Label__c, HidePackage__c, Namespace__c, Package_Name__c, Vertical__c FROM ISV_Limitation_Warning__mdt';
                
                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<ISV_Limitation_Warning__mdt> warningList = (List<ISV_Limitation_Warning__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<ISV_Limitation_Warning__mdt>.class);
                
                for (ISV_Limitation_Warning__mdt isvWarningMeta : warningList) {
                    if(!isvWarningMeta.HidePackage__c){
                        isvWarningMap.put(isvWarningMeta.Namespace__c.toLowerCase(), isvWarningMeta);
                    }
                }
            }
            return isvWarningMap;
        }
        private set;
    }
    
    //common custom objects that may cause conflicts
    public static Set<String> customObjectsToWarn {
        get {
            if (customObjectsToWarn == null) {
                customObjectsToWarn = new Set<String>();
                String query = 'SELECT Id, DeveloperName, MasterLabel, Conflicting_Custom_Objects__c FROM SFDC_Feature__mdt';
                
                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Feature__mdt> featureList = (List<SFDC_Feature__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Feature__mdt>.class);
                
                for (SFDC_Feature__mdt featureMeta : featureList) {
                   
                    if (String.isNotBlank(featureMeta.Conflicting_Custom_Objects__c)) {
                        for (String objNameVal : featureMeta.Conflicting_Custom_Objects__c.split(',')) {
                            customObjectsToWarn.add(objNameVal.trim());
                        }
                    }
                }
            }
            return customObjectsToWarn;
        }
        private set;
    }
    
    //implement base method no logic needed here
    public virtual override TransitionRecommendation generate(Id assessmentId) { return this; }
    
    /**
* Execute TransitionRecommendation action generate method via apex class name as string
*/
    public static TransitionRecommendation executeAction(Id assessmentId, String recommendationActionApexName) {
        TransitionRecommendation recommendation;
        Type apexType = Type.forName(recommendationActionApexName);
        if (apexType != null) {
            Object apexInstance = apexType.newInstance();
            if (apexInstance instanceOf TransitionRecommendation) {
                recommendation = ((TransitionRecommendation)apexInstance).generate(assessmentId);
            }
        }
        return recommendation;
    }
    
    /**
* Execute all configured TransitionRecommendation actions
*/
    public static List<TransitionRecommendation> executeAllActions(Id assessmentId) {
        List<TransitionRecommendation> recommendations = new List<TransitionRecommendation>();
        for (String recommendationActionApexName : new Set<String>(apexActionMap.values())) {
            TransitionRecommendation rec = executeAction(assessmentId, recommendationActionApexName);
            //only add with populated values
            if (rec!=null && (String.isNotBlank(rec.text) || (rec.reasons != null && !rec.reasons.isEmpty()))) {
                recommendations.add(rec);
            }
        }
        return recommendations;
    }
    
    /**
* String map force empty string when null
*/
    private class StringMap {
        private Map<String,String> textMap = new Map<String,String>();
        
        public void put(String key, String val) {
            textMap.put(key, val != null ? val : '');
        }
        
        private Map<String,String> getMap() {
            return textMap;
        }
    }
    
    /**
* Integer map force 0 value when null and allow override when getting in Test mode
*/
    private class IntMap {
        private Map<String,Integer> intMap = new Map<String,Integer>();
        
        public Integer get(String key, Integer overrideTestVal) {
            return Test.isRunningTest() ? overrideTestVal : intMap.get(key);
        }
        
        public void put(String key, Integer val) {
            intMap.put(key, val != null ? val : 0);
        }
    }
    
    //check max limit custom fields post FSC install
    public class CheckCustomFieldLimits extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            //skip this scan logic if FSC is already installed
            if (TransitionReadinessUtility.getFscInstallationReadiness().hasPackage) { return this; }
            
            //Check for custom field limits on standard objects
            for (String standardObj : STANDARD_OBJECT_FSC_LIMITS_MAP.keySet()) {
                Integer fieldCountRequired = STANDARD_OBJECT_FSC_LIMITS_MAP.get(standardObj);
                //check object field limits
                Schema.DescribeSObjectResult objectDescribe = SchemaService.GLOBAL_DESCRIBE.get(standardObj).getDescribe();
                Map<String, Schema.SObjectField> objectFieldMap = objectDescribe.fields.getMap();
                Integer customFieldCount = 0;
                for (String fieldName : objectFieldMap.keySet()) {
                    Schema.DescribeFieldResult fieldDescribe = objectFieldMap.get(fieldName).getDescribe();
                    if (fieldDescribe.isCustom()) {
                        customFieldCount++;
                    }
                }
                //make recommendation
                if(customFieldCount >= CUSTOM_FIELD_LIMIT - fieldCountRequired) {
                    this.text = recommendTextMap.get('objectTooManyFields');
                    Integer fieldsNeeded = customFieldCount - (CUSTOM_FIELD_LIMIT - fieldCountRequired);
                    String description = '';
                    Boolean isNull = false;
                    for(String s : recommendTextMap.keySet()){
                        if(recommendTextMap.get(s)=='' || recommendTextMap.get(s)==null){
                            isNull = true;
                        }
                    }
                    if(!isNull){
                        this.reasons.add(String.format(recommendTextMap.get('objectTooManyFieldsReasonTotal'), new List<Object>{objectDescribe.getLabel(), customFieldCount, fieldsNeeded}));
                        description = recommendationDescriptionMap.get('objectTooManyFieldsReasonTotal');
                    }
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));  
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('objectTooManyFieldsReasonTotal');
                    this.titles.add(title == null ? '' : title);
                }
            }
            
            //check Activity field limits special handling
            Schema.DescribeSObjectResult eventDescribe = SchemaService.GLOBAL_DESCRIBE.get('Event').getDescribe();
            Schema.DescribeSObjectResult taskDescribe = SchemaService.GLOBAL_DESCRIBE.get('Task').getDescribe();
            Map<String, Schema.SObjectField> eventFieldMap = eventDescribe.fields.getMap();
            //Map<String, Schema.SObjectField> taskFieldMap = taskDescribe.fields.getMap();
            
            //callout obtain FSC schema info on what lookups will be added
            Integer customFieldCountFSCActivity = 0;
            Map<String,String> activityLookupFSCObjectNameLabel = new Map<String,String>();
            ExternalUtilities.ExternalSchema fscSchemaMap = ExternalUtilities.requestFSCObjectSchema(new List<String>{'Event'});
            if (fscSchemaMap != null) {
                List<Object> fieldDescribes = (List<Object>)fscSchemaMap.get('fields');
                if (fieldDescribes != null) {
                    for (Object fieldDescObj : fieldDescribes) {
                        Map<String,Object> fieldDescribe = (Map<String,Object>)fieldDescObj;
                        if (Boolean.valueOf(fieldDescribe.get('custom'))) {
                            customFieldCountFSCActivity++;
                            if (String.valueOf(fieldDescribe.get('type')) == 'reference') {
                                String activityLookupName = String.valueOf(fieldDescribe.get('label')) + ' (' + String.valueOf(fieldDescribe.get('name')) + ')';
                                for (Object refStringObj : (List<Object>)fieldDescribe.get('referenceTo')) {
                                    activityLookupFSCObjectNameLabel.put(String.valueOf(refStringObj), activityLookupName);
                                }
                            }
                        }
                    }
                }
            }
            
            Integer customFieldCount = 0;
            Map<String,Integer> objectLookupCountMap = new Map<String,Integer>();
            //Activity custom fields are listed on both Task and Event describes
            for (String fieldName : eventFieldMap.keySet()) {
                if(fieldName!=null){
                    Schema.DescribeFieldResult fieldDescribe = eventFieldMap.get(fieldName).getDescribe();
                    if(fieldDescribe!=null){
                        if (fieldDescribe.isCustom()) {
                            customFieldCount++;
                            if (String.isNotBlank(fieldDescribe.getRelationshipName())) {
                                String relatedObjName = fieldDescribe.getReferenceTo()[0].getDescribe().getName();
                                Integer lookupCount = objectLookupCountMap.get(relatedObjName);
                                if (lookupCount == null) { lookupCount = 0; }
                                objectLookupCountMap.put(relatedObjName, ++lookupCount);
                            }
                            
                        }                    
                    }
                }
            }
            
            //make recommendation exceed field limit
            if(customFieldCount >= CUSTOM_FIELD_LIMIT_ACTIVITIES - customFieldCountFSCActivity) {
                Boolean isNull = false;
                String description = '';
                for(String s : recommendTextMap.keySet()){
                    if(recommendTextMap.get(s)=='' || recommendTextMap.get(s)==null){
                        isNull = true;
                    }
                }
                if(!isNull){
                    this.text += String.format(recommendTextMap.get('objectTooManyFields'), new List<Object>{
                        'Activity (' + taskDescribe.getLabel() + ' + ' + eventDescribe.getLabel() + ')',
                            customFieldCountFSCActivity
                            });
                
                    this.reasons.add(String.format(recommendTextMap.get('objectTooManyFieldsReasonTotal'), new List<Object>{'Activity', customFieldCount, (CUSTOM_FIELD_LIMIT_ACTIVITIES - customFieldCountFSCActivity)}));
                    description = recommendationDescriptionMap.get('objectTooManyFieldsReasonTotal');
                }
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));  
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('objectTooManyFieldsReasonTotal');
                this.titles.add(title == null ? '' : title);
            }
            
            //make recommendation when exceed lookup limit
            for (String lookupObjName : objectLookupCountMap.keySet()) {
                Integer lookupCount = objectLookupCountMap.get(lookupObjName);
                if (activityLookupFSCObjectNameLabel.containsKey(lookupObjName) && lookupCount >= LOOKUP_FIELD_LIMIT_ACTIVITIES_PER_OBJ) {
                    this.text += String.format(recommendTextMap.get('activityTooManyLookups'), new List<Object>{
                        'Activity (' + taskDescribe.getLabel() + ' + ' + eventDescribe.getLabel() + ')',
                            LOOKUP_FIELD_LIMIT_ACTIVITIES_PER_OBJ
                            });
                    this.reasons.add(String.format(recommendTextMap.get('objectTooManyFieldsReasonTotal'), new List<Object>{'Activity', lookupCount, activityLookupFSCObjectNameLabel.get(lookupObjName)}));
                    String description = recommendationDescriptionMap.get('objectTooManyFieldsReasonTotal');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));  
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('objectTooManyFieldsReasonTotal');
                    this.titles.add(title == null ? '' : title);
                    
                    this.reasons.add(String.format(recommendTextMap.get('activityTooManyLookupsReasonTotal'), new List<Object>{'Activity', LOOKUP_FIELD_LIMIT_ACTIVITIES_PER_OBJ}));
                    description = recommendationDescriptionMap.get('activityTooManyLookupsReasonTotal');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));  
                    title = TransitionRecommendation.recommendationDescriptionTitleMap.get('activityTooManyLookupsReasonTotal');
                    this.titles.add(title == null ? '' : title);
                    
                    break;
                }
            }
            
            //determine complexity
            if (String.isNotBlank(this.text)) {
                this.complexity++;
                this.severity = SeverityLevel.CRITICAL;
            }
            
            return this;
        }
    }
    
    //check for multi-currency and advanced currency management
    // public class CheckCurrencySettings extends TransitionRecommendation {
    //     public override TransitionRecommendation generate(Id assessmentId) {
    //         //Multi-Currency
    //         if(SchemaService.isObjectAvailable(MULTI_CURRENCY_OBJECT_NAME)){
    //             this.text = recommendTextMap.get('hasCurrencyFeaturesEnabled');
    //             this.reasons.add(recommendTextMap.get('multiCurrencyEnabled'));
    //             String description = recommendationDescriptionMap.get('multiCurrencyEnabled');
    //             this.descriptions.add(description == null ? '' : description);
    //             this.hasDescription.add(String.isNotBlank(description));  
    //             String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('multiCurrencyEnabled');
    //             this.titles.add(title == null ? '' : title);
    //             //Advanced Currency Management (DatedConversionRate can be inspected via REST API to detect enable/disable state)
    //             ExternalUtilities.ExternalSchema acmSchema = ExternalUtilities.requestOrgObjectSchema(new List<String>{ACM_OBJECT_NAME});
    //             if(acmSchema!=null){
    //                 Map<String, Object> convertedSchema = (Map<String, Object>) acmSchema.objectDescribeMap.get('DatedConversionRate');
    //                 Boolean describeValue = Boolean.valueOf(convertedSchema.get('createable'));
    //                 if(describeValue==true){
    //                     this.reasons.add(recommendTextMap.get('advancedCurrencyEnabled'));
    //                     description = recommendationDescriptionMap.get('advancedCurrencyEnabled');
    //                     this.descriptions.add(description == null ? '' : description);
    //                     this.hasDescription.add(String.isNotBlank(description)); 
    //                     title = TransitionRecommendation.recommendationDescriptionTitleMap.get('advancedCurrencyEnabled');
    //                     this.titles.add(title == null ? '' : title);
    //                     this.severity = SeverityLevel.WARNING;
    //                     this.complexity++;
    //                 }
    //             }
    //         }
    //         return this;
    //     }
    // }
    
    //check custom integrations with external systems
    public class CheckOutboundIntegrations extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            
            
            return this;
        }
    }
    
    //check for ISV unmanaged or managed package conflicts
    public class CheckISVPackageConflicts extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            
            //check unmanaged packages
            for (String warningObj : customObjectsToWarn) {
                if (SchemaService.GLOBAL_DESCRIBE.containsKey(warningObj)) {
                    this.text = recommendTextMap.get('customObjectConflict');
                    this.reasons.add(String.format(recommendTextMap.get('customObjectConflictReason'), new List<Object>{SchemaService.GLOBAL_DESCRIBE.get(warningObj).getDescribe().getLabel()}));
                    String description = recommendationDescriptionMap.get('customObjectConflictReason');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));  
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('customObjectConflictReason');
                    this.titles.add(title == null ? '' : title);
                }
            }
            
            //check managed packages
            for (PackageLicense pl : [SELECT NamespacePrefix FROM PackageLicense LIMIT 1000]) {
                String installedNamespace = pl.NamespacePrefix.toLowerCase();
                if (isvWarningMap.containsKey(installedNamespace)) {
                    ISV_Limitation_Warning__mdt isvWarningMeta = isvWarningMap.get(installedNamespace);
                    this.text = recommendTextMap.get('isvPackageConflict');
                    String isvWarning = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore+isvWarningMeta.Custom_Label__c);
                    if (String.isNotBlank(isvWarning)) {
                        this.reasons.add(isvWarning);
                        this.descriptions.add('');
                        this.hasDescription.add(false);  
                        this.titles.add('');  
                    } else {
                        this.reasons.add(String.format(recommendTextMap.get('isvPackageConflictReason'), new List<Object>{isvWarningMeta.MasterLabel}));
                        String description = recommendationDescriptionMap.get('isvPackageConflictReason');
                        this.descriptions.add(description == null ? '' : description);
                        this.hasDescription.add(String.isNotBlank(description));  
                        String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('isvPackageConflictReason');
                        this.titles.add(title == null ? '' : title);    
                    }
                }
            }
            
            //determine complexity
            if (String.isNotBlank(text)) {
                this.complexity++;
                this.severity = SeverityLevel.WARNING;
            }
            
            return this;
        }
    }
    
    //check for Salesforce licensed features Einstien, Communities, etc.
    public class CheckLicensedFeatures extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            
            List<UserLicense> userLicenseTypes = [
                SELECT LicenseDefinitionKey, MasterLabel, UsedLicenses, TotalLicenses
                FROM UserLicense
                WHERE UsedLicenses > 0
                AND LicenseDefinitionKey LIKE :USER_LICENSE_KEYS
            ];
            
            List<PermissionSetLicense> featureLicenseTypes = [
                SELECT PermissionSetLicenseKey, MasterLabel, UsedLicenses, TotalLicenses
                FROM PermissionSetLicense
                WHERE UsedLicenses > 0
                AND PermissionSetLicenseKey LIKE :FEATURE_LICENSE_KEYS
            ];
            
            for (UserLicense licenseType : userLicenseTypes) {
                this.reasons.add(String.format(recommendTextMap.get('hasLicensedFeatureReason'), new List<Object>{
                    licenseType.MasterLabel,
                        licenseType.UsedLicenses,
                        licenseType.TotalLicenses
                        }));
                String description = recommendationDescriptionMap.get('hasLicensedFeatureReason');
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));  
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasLicensedFeatureReason');
                this.titles.add(title == null ? '' : title);
            }
            
            for (PermissionSetLicense licenseType : featureLicenseTypes) {
                this.reasons.add(String.format(recommendTextMap.get('hasLicensedFeatureReason'), new List<Object>{
                    licenseType.MasterLabel,
                        licenseType.UsedLicenses,
                        licenseType.TotalLicenses
                        }));
                String description = recommendationDescriptionMap.get('hasLicensedFeatureReason');
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));  
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasLicensedFeatureReason');
                this.titles.add(title == null ? '' : title);
            }
            
            if (!this.reasons.isEmpty()) {
                this.text = recommendTextMap.get('hasLicensedFeature');
            }
            
            return this;
        }
    }
    
    public class CheckSharingConfiguration extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId){
            
            Assessment__c assessment = AssessmentService.queryAssessment(assessmentId);
            MappingService.UpgradeMapping mapping = MappingService.getExistingMapping(assessment);
            
            Set<String> objectsToQuery = new Set<String>();
            Map<String,String> sourceToDestinationObject = new Map<String,String>();
            
            Boolean sourceMappingHasCustomObject = false;
            
            if (mapping != null && mapping.recommended != null) {
                for (MappingService.ObjectMapping objectMapping : mapping.recommended) {
                    //collect mapped object
                    if (objectMapping.mappingData != null) {
                        for (MappingService.MappingSelection mappingData : objectMapping.mappingData) {
                            if (String.isNotBlank(mappingData.source) && String.isNotBlank(mappingData.destination)) {
                                sourceToDestinationObject.put(mappingData.source, mappingData.destination);
                                objectsToQuery.add(mappingData.source);
                            }
                        }
                    }
                }
            }
            
            if(assessment.Is_B2C__c){
                Organization org = [SELECT Id, DefaultAccountAccess, DefaultContactAccess FROM Organization WHERE Id = :UserInfo.getOrganizationId()];
                if(org.DefaultContactAccess != TransitionRecommendation.OWD_CONTROLLED_BY_PARENT){
                    this.reasons.add(recommendTextMap.get('sharingSettingsCheckPersonAccountReason'));
                    String description = recommendationDescriptionMap.get('sharingSettingsCheckPersonAccountReason');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description)); 
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('sharingSettingsCheckPersonAccountReason');
                    this.titles.add(title == null ? '' : title); 
                }
            }
            
            if(assessment.Has_Apex_Sharing__c){
                this.complexity++;
                this.reasons.add(recommendTextMap.get(SHARING_SETTINGS_APEX_SHARE_REASON));
                String description = recommendationDescriptionMap.get(SHARING_SETTINGS_APEX_SHARE_REASON);
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));  
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get(SHARING_SETTINGS_APEX_SHARE_REASON);
                this.titles.add(title == null ? '' : title);
            }
            
            if(assessment.Has_Apex_Sharing_on_CDS_Object__c){
                this.complexity++;
                this.reasons.add(recommendTextMap.get(SHARING_SETTINGS_CDS_REASON));
                String description = recommendationDescriptionMap.get(SHARING_SETTINGS_CDS_REASON);
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));  
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get(SHARING_SETTINGS_CDS_REASON);
                this.titles.add(title == null ? '' : title);
            }
            
            List<EntityDefinition> entityDefinitions = TransitionAnalysis.getEntityDefinitions(objectsToQuery);
            Map<String, EntityDefinition> objectToEntityDefinition = new Map<String, EntityDefinition>();
            
            for(EntityDefinition entityDefinition : entityDefinitions){
                objectToEntityDefinition.put(entityDefinition.QualifiedApiName, entityDefinition);
            }
            
            for(String sourceObjectName : sourceToDestinationObject.keySet()){
                String destinationObjectName = sourceToDestinationObject.get(sourceObjectName);
                
                EntityDefinition sourceDefinition = objectToEntityDefinition.get(sourceObjectName);
                EntityDefinition destinationDefinition = objectToEntityDefinition.get(destinationObjectName);
                
                if(sourceDefinition == NULL){
                    //This is probably an FSC Object that is not yet installed in the org
                    continue;
                } else if(sourceDefinition == NULL && destinationDefinition == NULL){
                    //Source not mapped, and Destination not present
                    continue;
                } else if(
                    sourceDefinition != NULL
                    && destinationDefinition != NULL
                    && sourceDefinition.InternalSharingModel != destinationDefinition.InternalSharingModel
                    && sourceDefinition.Label != destinationDefinition.Label
                ){
                    
                    this.reasons.add(String.format(recommendTextMap.get('sharingSettingsCheckMismatchReason'), new List<Object>{
                        sourceDefinition.Label,
                            TransitionAnalysis.getSharingSettingLabel(sourceDefinition.InternalSharingModel),
                            destinationDefinition.Label,
                            TransitionAnalysis.getSharingSettingLabel(destinationDefinition.InternalSharingModel)
                            }));
                    String description = recommendationDescriptionMap.get('sharingSettingsCheckMismatchReason');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('sharingSettingsCheckMismatchReason');
                    this.titles.add(title == null ? '' : title);
                }
                
                if(sourceDefinition.QualifiedApiName.endsWith('__c')){
                    sourceMappingHasCustomObject = true;
                }
            }
            
            if(sourceMappingHasCustomObject){
                this.complexity++;
                this.reasons.add(recommendTextMap.get('sharingSettingsCustomObjectReplacesStand'));
                String description = recommendationDescriptionMap.get('sharingSettingsCustomObjectReplacesStand');
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('sharingSettingsCustomObjectReplacesStand');
                this.titles.add(title == null ? '' : title);
            }
            
            
            if (!this.reasons.isEmpty()) {
                this.text = recommendTextMap.get(SHARING_SETTINGS_RECOMMENDATION_TEXT);
            }
            
            return this;
        }
    }
    
    public class CheckClassicEmailTemplates extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            if([
                SELECT Id FROM EmailTemplate 
                WHERE NameSpacePrefix = NULL 
                AND IsActive =: true 
                AND UiType =: EMAIL_TYPE_CLASSIC
                AND (NOT DeveloperName LIKE '%SAMPLE')
            ].isEmpty() == false
              ) {
                  this.severity = SeverityLevel.WARNING;
                  this.text = recommendTextMap.get('classicEmailTemplatesPresentTitle');
                  this.reasons.add(recommendTextMap.get('classicEmailTemplatesConsiderations'));
                  String description = recommendationDescriptionMap.get('classicEmailTemplatesConsiderations');
                  this.descriptions.add(description == null ? '' : description);
                  this.hasDescription.add(String.isNotBlank(description));
                  String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('classicEmailTemplatesConsiderations');
                  this.titles.add(title == null ? '' : title);
              }
            
            return this;
        }
    }
    
    /**
* SCAN ORG DATA USAGE & LIMITS
**/
    
    //Check for 250M+ Account records or PK chunking needs AccountContactRelation
    public class CheckHighDataVolume extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            
            for (Schema.DescribeSObjectResult objectDescribe : Schema.describeSObjects(new List<String>(OBJECTS_CHECK_HIGH_VOLUME))) {
                if (Limits.getQueries() < Limits.getLimitQueries()) {
                    Integer recordCount = Database.countQuery('SELECT COUNT() FROM ' + objectDescribe.getName());
                    if (recordCount >= RECORD_COUNT_HIGH_DATA_VOLUME_WARN) {
                        this.severity = SeverityLevel.WARNING;
                        this.text = recommendTextMap.get('recordHighDataVolume');
                        Boolean isNull = false;
                        String description = '';
                        for(String s : recommendTextMap.keySet()){
                            if(recommendTextMap.get(s)=='' || recommendTextMap.get(s)==null){
                                isNull = true;
                            }
                		}
                        if(!isNull){
                        	this.reasons.add(String.format(recommendTextMap.get('recordHighDataVolumeReason'),  new List<Object>{String.valueOf(recordCount.format()), objectDescribe.getLabel()}));
                        	description = recommendationDescriptionMap.get('recordHighDataVolumeReason');
                        }
                        this.descriptions.add(description == null ? '' : description);
                        this.hasDescription.add(String.isNotBlank(description));
                        String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('recordHighDataVolumeReason');
                        this.titles.add(title == null ? '' : title);
                        
                        if (objectDescribe.getName() == 'Contact') {
                            reasons.add(recommendTextMap.get('recordHighDataVolumeReasonContact'));
                            description = recommendationDescriptionMap.get('recordHighDataVolumeReasonContact');
                            this.descriptions.add(description == null ? '' : description);
                            this.hasDescription.add(String.isNotBlank(description));
                            title = TransitionRecommendation.recommendationDescriptionTitleMap.get('recordHighDataVolumeReasonContact');
                            this.titles.add(title == null ? '' : title);
                            
                            reasons.add(recommendTextMap.get('recordHighDataVolumeReasonStorage'));
                            description = recommendationDescriptionMap.get('recordHighDataVolumeReasonStorage');
                            this.descriptions.add(description == null ? '' : description);
                            this.hasDescription.add(String.isNotBlank(description));
                            title = TransitionRecommendation.recommendationDescriptionTitleMap.get('recordHighDataVolumeReasonStorage');
                            this.titles.add(title == null ? '' : title);
                        }
                    }
                }
            }
            
            return this;
            
        }
    }
    
    
    public class CheckMemberModel extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            Boolean present = false;
            Boolean sectionPresent = false;
            if (TransitionReadinessUtility.assessmentMapping != null) {
                for (MappingService.ObjectMapping om : TransitionReadinessUtility.assessmentMapping.recommended) {
                    if (om.sectionName == 'Account Types - Member') {
                        sectionPresent = true;
                        for (MappingService.MappingSelection selection : om.mappingData) {
                            if (selection.source == 'Account' || selection.source == 'PersonAccount') {
                                System.debug('=Selected Member!');
                                present = true;
                            }
                        } 
                    }
                }
                if(sectionPresent && !present){
                    complexity++;
                    this.text = recommendTextMap.get('accountMemberModelTitle');
                    this.severity = SeverityLevel.WARNING;
                    this.reasons.add(recommendTextMap.get('accountMemberModel'));
                    String description = recommendationDescriptionMap.get('accountMemberModel');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('accountMemberModel');
                    this.titles.add(title == null ? '' : title);
                }
            }
            return this;
        }
    }
    
    public class CheckPatientModel extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            Boolean present = false;
            Boolean sectionPresent = false;
            if (TransitionReadinessUtility.assessmentMapping != null) {
                for (MappingService.ObjectMapping om : TransitionReadinessUtility.assessmentMapping.recommended) {
                    if (om.sectionName == 'Account Types - Patient') {
                        sectionPresent = true;
                        for (MappingService.MappingSelection selection : om.mappingData) {
                            if (selection.source == 'Account' || selection.source == 'PersonAccount') {
                                System.debug('=Selected Patient!');
                                present = true;
                            }
                        }  
                    }
                }
                if(sectionPresent && !present){
                    complexity++;
                    this.text = recommendTextMap.get('accountPatientModelTitle');
                    this.severity = SeverityLevel.WARNING;
                    this.reasons.add(recommendTextMap.get('accountPatientModel'));
                    
                    String description = recommendationDescriptionMap.get('accountPatientModel');
                    this.descriptions.add(description == null ? '' : description);
                    this.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('accountPatientModel');
                    this.titles.add(title == null ? '' : title);
                }
            }
            return this;
        }
    }
    
    public class CheckOrgAge extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            if ([SELECT CreatedDate FROM Organization].CreatedDate.year() < 2016) {
                complexity++;
                this.severity = SeverityLevel.WARNING;
                this.text = recommendTextMap.get('orgCreatedDateTitle');
                this.reasons.add(recommendTextMap.get('orgCreatedDate'));
                String description = recommendationDescriptionMap.get('orgCreatedDate');
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('orgCreatedDate');
                this.titles.add(title == null ? '' : title);
            }
            
            return this;
        }
    }
    public class CheckObjectLookupsContact extends TransitionRecommendation {
        public override TransitionRecommendation generate(Id assessmentId) {
            Set<String> childRelationships = new Set<String>();
            for (Schema.ChildRelationship cr : Contact.SObjectType.getDescribe().getChildRelationships()) {
                if (cr.getRelationshipName() != null && cr.getRelationshipName().endsWith('__r')) {
                    if(cr.getChildSObject().getDescribe().isCustom()){
                        childRelationships.add(cr.getRelationshipName());
                    } 
                }
            }
            
            if (TransitionReadinessUtility.assessmentMapping != null) {
                for (MappingService.ObjectMapping om : TransitionReadinessUtility.assessmentMapping.recommended) {
                    for (MappingService.MappingSelection selection : om.mappingData) {
                        if (selection.source != null && selection.source.endsWith('__c')) {
                            childRelationships.remove(selection.source);
                        }
                    }
                }
            }
            
            if (!childRelationships.isEmpty()) {
                complexity++;
                this.severity = SeverityLevel.WARNING;
                this.text = recommendTextMap.get('objectLookupsContactTitle');
                this.reasons.add(recommendTextMap.get('objectLookupsContact'));
                String description = recommendationDescriptionMap.get('objectLookupsContact');
                this.descriptions.add(description == null ? '' : description);
                this.hasDescription.add(String.isNotBlank(description));
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('objectLookupsContact');
                this.titles.add(title == null ? '' : title);
            }
            
            return this;
        }
    }
    
    //calculate potential storage overage after adding FSC junction objects and activity tracking
    
    //query record totals and usage dates detect stale objects
}