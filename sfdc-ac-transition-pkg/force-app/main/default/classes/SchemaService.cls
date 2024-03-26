/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class SchemaService {
    //describe global only once when accessed
    public static Map<String, Schema.SObjectType> GLOBAL_DESCRIBE {
        get {
            if (GLOBAL_DESCRIBE == null) {
                GLOBAL_DESCRIBE = Schema.getGlobalDescribe();
            }
            return GLOBAL_DESCRIBE;
        }
        private set;
    }
    public static List<Blacklist_Source_Entry__mdt> blacklistSourceEntries {
        get {
            if (blacklistSourceEntries == null) {
                String query = 'SELECT MasterLabel, Is_Namespace__c FROM Blacklist_Source_Entry__mdt LIMIT 1000';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                blacklistSourceEntries = (List<Blacklist_Source_Entry__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<Blacklist_Source_Entry__mdt>.class);
            }
            return blacklistSourceEntries;
        }
        private set;
    }
    private static Map<String, Schema.DescribeSObjectResult> objectApiNameToDescribeResult = new Map<String, Schema.DescribeSObjectResult>();

    private static final String MDT_SUFFIX = 'mdt';
    public static final String PLATFORM_EVENT_SUFFIX = '__e';
    public static final String CUSTOM_OBJECT_SUFFIX = '__c';

    //Must filter on Standard Objects
    public static final Set<String> PREFIXES_TO_EXCLUDE = new Set<String>{
        'Action',
        'AI',
        'Aggregate',
        'Apex',
        'Api',
        'App',
        'Apple',
        // 'Assessment',
        'AssessmentIndicator',
        'AssessmentTask',
        'Async',
        'Aura',
        'Auth',
        'Authorization',
        'Background',
        'Brand',
        'Branding',
        'Bulk',
        'Business',
        'Category',
        'Collab',
        'Comm',
        'Content',
        'Cors',
        'Credential',
        'Cron',
        'Csp',
        'Custom',
        'Dashboard',
        'Datacloud',
        'Data',
        'Duplicate',
        'Email',
        'Entity',
        'Expression',
        'External',
        'Field',
        'File',
        'Flow',
        'Formula',
        'Lightning',
        'List',
        'Login',
        'ML',
        'Macro',
        'Mailmerge',
        'Matching',
        'Oauth',
        'Org',
        'Permission',
        'Platform',
        'Process',
        'Record',
        'Redirect',
        'Relationship',
        'Report',
        'Ui',
        'User',
        'Wave',
        'Web',
        'Work',
        'Visualforce'
    };

    //Must filter on Standard Objects
    public static final Set<String> SUFFIXES_TO_EXCLUDE = new Set<String>{
        'Share',
        'History',
        'Tag',
        'Feed',
        'Event' //Captures "ChangeEvent" too
    };

    /*
        Lowercase because we're filtering from describe fieldmap keys
     */
    @TestVisible
    public static final Set<String> FIELDS_TO_EXCLUDE = new Set<String>{
        'isdeleted',
        'lastvieweddate',
        'lastreferenceddate',
        'systemmodstamp',
        'id',
        'recordtypeid'
    };

    private static String getPackageNamespace(){
        String packageNamespace = Utilities.namespaceUnderscore;
        
        if(String.isBlank(packageNamespace)){
            //This will never get filtered on, and that's OK. Just need a value that won't have the possibility of being filtered.
            return 'UPGRADE_TOOL';
        }

        return packageNamespace;
    }

    @TestVisible
    static List<SFDC_Industry_Mapping_List_Core_Object__mdt> mappingOrderList {
        get {
            if(mappingOrderList == null) {
                String query = 'SELECT Object_API_Name__c, Sort_Order__c FROM SFDC_Industry_Mapping_List_Core_Object__mdt ORDER BY Sort_Order__c ASC LIMIT 1000';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                mappingOrderList = (List<SFDC_Industry_Mapping_List_Core_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_List_Core_Object__mdt>.class);
            }
            return mappingOrderList;
        }
        set;
    }

    public static Schema.DescribeSObjectResult getDescribeResult(String sObjectApiName){
        if( !objectApiNameToDescribeResult.containsKey(sObjectApiName) ){
            try{
                Schema.DescribeSObjectResult sObjectDescribeResult = GLOBAL_DESCRIBE.get(sObjectApiName).getDescribe();
                objectApiNameToDescribeResult.put(sObjectApiName, sObjectDescribeResult);
            } catch(System.NullPointerException e){
                SystemLogger.log(LoggingLevel.ERROR, e);
                throw new AuraHandledException('The requested SObject does not exist in this organization: ' + sObjectApiName);
            }
        }

        return objectApiNameToDescribeResult.get( sObjectApiName );
    }

    public static Schema.SObjectType getSObjectType(String sObjectApiName){
        return GLOBAL_DESCRIBE.get(sObjectApiName);
    }

    public static List<Schema.PicklistEntry> getPicklistValues(String sObjectApiName, String fieldApiName){
        Schema.DescribeFieldResult fieldDescribe = getDescribeResult(sObjectApiName).fields.getMap().get(fieldApiName).getDescribe();
        return fieldDescribe.getPicklistValues();
    }

    public static Map<String, Schema.SObjectField> getFieldMap( String sObjectApiName ) {
        return getDescribeResult( sObjectApiName ).fields.getMap();
    }

    public static Map<String, Schema.FieldSet> getFieldSetMap( String sObjectApiName ) {
        return getDescribeResult( sObjectApiName ).fieldSets.getMap();
    }

    public static Map<String, Schema.RecordTypeInfo> getRecordTypeMap(String sObjectApiName){
        return getDescribeResult(sObjectApiName).getRecordTypeInfosByDeveloperName();
    }

    @AuraEnabled
    public static SchemaModel getSchemaModel(String sObjectApiName){

        Schema.DescribeSObjectResult objectDescribeResult = getDescribeResult(sObjectApiName);

        //Want to only exclude STANDARD objects
        if( isExcludedObject(objectDescribeResult) ){
            return null;
        }

        SchemaModel schemaModel = new SchemaModel(objectDescribeResult);

        for ( String fieldApiName : getFieldMap( sObjectApiName ).keySet() ) {
            if ( !FIELDS_TO_EXCLUDE.contains( fieldApiName ) ){
                Schema.SObjectField sObjectField = getFieldMap(sObjectApiName).get(fieldApiName);
                FieldModel fieldModel = new FieldModel(sObjectField);
                schemaModel.fields.add(fieldModel);
            }
        }

        for(Schema.FieldSet fieldSet : getFieldSetMap(sObjectApiName).values() ){
            FieldSetModel fieldSetModel = new FieldSetModel(fieldSet);
            schemaModel.fieldSets.add(fieldSetModel);
        }

        for(Schema.RecordTypeInfo recordTypeInfo : getRecordTypeMap(sObjectApiName).values()){
            RecordTypeModel recordTypeModel = new RecordTypeModel(recordTypeInfo);
            schemaModel.recordTypes.add(recordTypeModel);
        }

        schemaModel.childRelationships = getChildRelations(objectDescribeResult);

        return schemaModel;

    }

    @AuraEnabled
    public static List<String> getObjectsForOrg(){
        List<String> sObjectList = new List<String>();
        List<String> customObjectList = new List<String>();
        List<String> packageObjectList = new List<String>();
        List<String> standardObjectList = new List<String>();
        Set<String> coreObjects = new Set<String>();
        Set<String> blacklistedObjects = new Set<String>();
        Set<String> blacklistedNamespaces = new Set<String>();
        TransitionAppSettings settings = new TransitionAppSettings();

        if (settings.exclusionListActive) {
            for (Blacklist_Source_Entry__mdt blacklistSourceEntry : blacklistSourceEntries) {
                if (blacklistSourceEntry.Is_Namespace__c) {
                    blacklistedNamespaces.add(blacklistSourceEntry.MasterLabel);
                } else {
                    blacklistedObjects.add(blacklistSourceEntry.MasterLabel);
                }
            }
        }

        if(mappingOrderList.size()>0){
            sObjectList.add('='+System.Label.UIListboxCatCommon);
        }
        for(SFDC_Industry_Mapping_List_Core_Object__mdt coreObject : mappingOrderList) {
            Schema.SObjectType objectSchema = GLOBAL_DESCRIBE.get(coreObject.Object_API_Name__c);
            if(objectSchema != null) {
                sObjectList.add(coreObject.Object_API_Name__c);
                coreObjects.add(coreObject.Object_API_Name__c);
            }
        }
        if(mappingOrderList.size()>0){
            sObjectList.add('='+System.Label.UIListboxCatOther);
        }           
        
        for(Schema.SObjectType fieldDescribe : GLOBAL_DESCRIBE.values()) {
            String objectApiName = fieldDescribe.getDescribe().getName();
            //if(coreObjects.contains(objectApiName) == true || isExcludedObject(objectApiName) == true) continue;

            if(fieldDescribe.getDescribe().isCustom() == true) {
                if(objectApiName.countMatches('__') > 1) {
                    if (settings.exclusionListActive) {
                        Boolean exclude = false;

                        for (String namespace : blacklistedNamespaces) {
                            if (objectApiName.startsWith(namespace)) {
                                exclude = true;
                            }
                        }

                        if (!exclude) {
                            packageObjectList.add(objectApiName);
                        }
                    } else {
                        packageObjectList.add(objectApiName);
                    }
                } 
                else if (!settings.exclusionListActive || !blacklistedObjects.contains(objectApiName)) {
                    customObjectList.add(objectApiName);
                }
            } 
            else if (!settings.exclusionListActive || !blacklistedObjects.contains(objectApiName)) {
                standardObjectList.add(objectApiName);
            }
        }

        standardObjectList.addAll(customObjectList);
        packageObjectList.sort();
        standardObjectList.sort();
        sObjectList.addAll(packageObjectList);
        sObjectList.addAll(standardObjectList);

        return sObjectList;
    }

    @AuraEnabled
    public static Map<String, SchemaModel> getFullSchemaModelMap(){
        Map<String, SchemaModel> schemaModelMap = new Map<String, SchemaModel>();

        for(String sObjectApiName : GLOBAL_DESCRIBE.keySet()){
            SchemaModel schemaModel = getSchemaModel( sObjectApiName );
            if( schemaModel != null){
                schemaModelMap.put(schemaModel.value, schemaModel);
            }
        }

        return schemaModelMap;
    }

    public static Boolean isObjectAvailable(String objectName) {
        Boolean hasObject = false;
        try {
            hasObject = !Schema.describeSObjects(new List<String>{objectName}).isEmpty();
        } catch (System.NoAccessException e) {
            //object not accessible
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return hasObject;
    }

    //Retrieves child relatonship info, given an sobject
    //TODO: Potentially just pass in object def (we should already have it)
    public static Map<String, FieldModel> getChildRelations(Schema.DescribeSObjectResult parentDescribe) {
        Map<String, FieldModel> children = new Map<String, FieldModel>();
        FieldModel currentChild;
        for (Schema.ChildRelationship childRelation : parentDescribe.getChildRelationships()) {
            if (childRelation.getField().getDescribe().isCustom()) {
                currentChild = new FieldModel();
                Schema.DescribeFieldResult fieldDescribe = childRelation.getField().getDescribe();
                currentChild.objectApiName = childRelation.getChildSObject().getDescribe().getName();
                currentChild.value = currentChild.objectApiName+'.'+fieldDescribe.getName();
                currentChild.label = fieldDescribe.getLabel() + ' ('+currentChild.objectApiName+'.'+fieldDescribe.getName()+')';
                currentChild.type = (fieldDescribe.getRelationshipOrder() != null ? 'Master-Detail' : 'Lookup');
                currentChild.relationshipName = childRelation.getRelationshipName();
                children.put(currentChild.value, currentChild);
            }
        }
        return children;
    }

    //This version does not check for `isAccessible`
    public static Boolean isExcludedObject(String sObjectApiName){

        //Requires that sObjectApiName be the CamelCase version.
        List<String> objectNameParts = sObjectApiName.splitByCharacterTypeCamelCase();

        Integer lastIndex = objectNameParts.size() - 1;

        //Automatically exclude objects from package and Custom Metadata Types
        if( sObjectApiName.startsWith(getPackageNamespace()) || objectNameParts.get(lastIndex) == MDT_SUFFIX || sObjectApiName.endsWith(PLATFORM_EVENT_SUFFIX)){
            return true;
        }

        //Don't want to exclude "Event" object or similar instances
        Boolean notCustom = !sObjectApiName.endsWith(CUSTOM_OBJECT_SUFFIX);
        Boolean isExcludedBySuffix = ( notCustom && SUFFIXES_TO_EXCLUDE.contains(objectNameParts.get(lastIndex)) && lastIndex > 0);
        Boolean isExcludedByPrefix = ( notCustom && PREFIXES_TO_EXCLUDE.contains(objectNameParts.get(0)) && objectNameParts.size() > 1);

        return (isExcludedBySuffix || isExcludedByPrefix);
    }

    private static Boolean isExcludedObject(Schema.DescribeSObjectResult objectDescribeResult){

        String sObjectApiName = objectDescribeResult.getName();

        //Requires that sObjectApiName be the CamelCase version.
        List<String> objectNameParts = sObjectApiName.splitByCharacterTypeCamelCase();

        Integer lastIndex = objectNameParts.size() - 1;

        //Automatically exclude objects from package and Custom Metadata Types
        if( sObjectApiName.startsWith(getPackageNamespace()) || objectNameParts.get(lastIndex) == MDT_SUFFIX){
            return false;
        }

        //Don't want to exclude "Event" object or similar instances
        Boolean notCustomOrAccessible = (!objectDescribeResult.isAccessible() || !objectDescribeResult.isCustom());
        Boolean isExcludedBySuffix = ( notCustomOrAccessible && SUFFIXES_TO_EXCLUDE.contains(objectNameParts.get(lastIndex)) && lastIndex > 0);
        Boolean isExcludedByPrefix = ( notCustomOrAccessible && PREFIXES_TO_EXCLUDE.contains(objectNameParts.get(0)) && objectNameParts.size() > 1);

        return (isExcludedBySuffix || isExcludedByPrefix);
    }

    public static Integer getOrgObjectCount() {
        Integer totalObjects = 0;
        if (!SchemaService.GLOBAL_DESCRIBE.isEmpty()) {
            totalObjects = SchemaService.GLOBAL_DESCRIBE.keySet().size();
        }
        return totalObjects;
    }

    public static Integer getOrgFieldCount() {
        Integer totalFields = 0;
        for (String theObject : SchemaService.GLOBAL_DESCRIBE.keySet()) {
            Integer objectFieldCount = SchemaService.getFieldMap(theObject).size();
            totalFields += objectFieldCount;
        }
        return totalFields;
    }

    public static Integer getRelatedObjectsNotMappedCount(Set<String> mappedObjects) {
        Set<String> relatedObjectsNotMapped = new Set<String>();
        Set<Schema.SObjectType> relatedObjects = new Set<Schema.SObjectType>();

        for (String mappedObject : mappedObjects) {
            Map<String, Schema.SObjectField> fieldMap = getFieldMap(mappedObject);
            for (String field : fieldMap.keySet()) {
                if (fieldMap.get(field) != null && fieldMap.get(field).getDescribe().getType() == DisplayType.REFERENCE) {
                    List <Schema.SObjectType> references = fieldMap.get(field).getDescribe().getReferenceTo();
                    relatedObjects.addAll(references);
                }
            }
        }

        for (Schema.SObjectType relatedObject : relatedObjects) {
            String referenceName = relatedObject.getDescribe().getName();
            if (!mappedObjects.contains(referenceName)) {
                relatedObjectsNotMapped.add(referenceName);
            }
        }

        for (String notMapped : relatedObjectsNotMapped) {
            System.debug(notMapped);
        }
        return relatedObjectsNotMapped.size();
    }

    /* FSCTA-1628 - Import Mappings */
    public static MappingService.MappingSelection verifyMappings(MappingService.MappingSelection mappingData, MappingService.SObjectDef objectDescribe) {
        Boolean clearOut = false;
        if(objectDescribe == null){
            mappingData.showDetails = false;
            clearOut = true;
        }

        if(mappingData != null){
            if(mappingData.fieldMapping != null){
                for (Integer i = 0; i < mappingData.fieldMapping.size(); i++) {
                    if(clearOut || !objectDescribe.fieldList.contains((mappingData.fieldMapping[i].source).toLowerCase())){
                        // mappingData.fieldMapping.remove(i);
                        // i--;
                        if(!String.isBlank(mappingData.fieldMapping[i].source)){
                            MappingService.importMissingFields.add(mappingData.source + '.' + mappingData.fieldMapping[i].source);
                        }
                        mappingData.fieldMapping[i].source = '';
                    }
                }
            }
            
            if(mappingData.recordTypeMapping != null){
                for (Integer i = 0; i < mappingData.recordTypeMapping.size(); i++) {
                    if(clearOut || !objectDescribe.rtList.contains(mappingData.recordTypeMapping[i].source)){
                        // mappingData.recordTypeMapping.remove(i);
                        // i--;
                        if(!String.isBlank(mappingData.recordTypeMapping[i].source)){
                            MappingService.importMissingRTs.add(mappingData.source + '.' + mappingData.recordTypeMapping[i].source);
                        }
                        mappingData.recordTypeMapping[i].source = '';
                    }
                }
            }
        }

        //Wait to clear source until we finish using object name for missing fields/RT's list.
        if(objectDescribe == null){
            mappingData.source = '';
        }
        
        return mappingData;
    }

    /* Inner Classes */

    public virtual class SchemaItem {
        @AuraEnabled
        public String label;

        @AuraEnabled
        public String value;
    }

    public class SchemaModel extends SchemaItem {

        @AuraEnabled
        public List<FieldModel> fields;

        @AuraEnabled
        public List<FieldSetModel> fieldSets;

        @AuraEnabled
        public List<RecordTypeModel> recordTypes;

        @AuraEnabled
        public Map<String, FieldModel> childRelationships;

        public SchemaModel(){
            this.fields = new List<FieldModel>();
            this.fieldSets = new List<FieldSetModel>();
            this.recordTypes = new List<RecordTypeModel>();
            this.childRelationships = new Map<String, FieldModel>();
        }

        public SchemaModel(Schema.DescribeSObjectResult objectDescribeResult) {
            this.fields = new List<FieldModel>();
            this.fieldSets = new List<FieldSetModel>();
            this.recordTypes = new List<RecordTypeModel>();
            this.childRelationships = new Map<String, FieldModel>();

            this.value = objectDescribeResult.getName();

            this.label = String.format('{0} ({1})', new List<String>{
                objectDescribeResult.getLabel(),
                this.value
            });
        }

        public void populateRecordTypeCounts(Map<String, String> namespaceMap){
            //Added try block to function (edge case where an error will occur if only inactive Record Types exist on the object)
            try{
                Map<String, Integer> recordTypeIdToCount = SchemaAnalytics.getRecordCountByRecordType(this.value);

                for(RecordTypeModel recordTypeModel : this.recordTypes){
                    if(recordTypeIdToCount.containsKey(recordTypeModel.recordTypeId)){
                        recordTypeModel.recordCount = recordTypeIdToCount.get(recordTypeModel.recordTypeId);
                    }
                    if(namespaceMap.size()>0 && namespaceMap.containsKey(recordTypeModel.value)){
                        if(namespaceMap.get(recordTypeModel.value)!=null){
                            recordTypeModel.value = namespaceMap.get(recordTypeModel.value) + '__' + recordTypeModel.value;
                            recordTypeModel.label = recordTypeModel.label.substring(0, recordTypeModel.label.indexOf('(')) + '(' + recordTypeModel.value + ')';
                        }    
                    }
                }
            }catch(QueryException e){
                SystemLogger.log(LoggingLevel.ERROR, e);
            }
        }
    }

    public class FieldModel extends SchemaItem {

        @AuraEnabled
        public String type;

        @AuraEnabled
        public Integer length;

        //Optional, used for child relatinship list
        @AuraEnabled
        public String objectApiName;

        @AuraEnabled
        public String relationshipName;

        public FieldModel(Schema.SObjectField sObjectField){
            Schema.DescribeFieldResult fieldDescribe = sObjectField.getDescribe();

            this.type = String.valueOf(fieldDescribe.getType());
            //Depending on type, change to Admin-friendly language
            if(this.type == 'String'){
                this.type = System.Label.DataTypeText;
            }else if(this.type == 'Double'){
                this.type = System.Label.DataTypeNumber;
            }else if(this.type == 'Reference'){
                this.type = (fieldDescribe.getRelationshipOrder() != null ? System.Label.DataTypeMasterDetail : System.Label.DataTypeLookup);
            }else if(this.type == 'Boolean'){
                this.type = System.Label.DataTypeCheckbox;
            }

            this.length = fieldDescribe.getLength();
            this.value = fieldDescribe.getName();

            this.label = String.format( '{0} ({1})', new List<String> {
                fieldDescribe.getLabel(),
                this.value
            } );
        }

        public FieldModel(){}
    }

    public class FieldSetModel extends SchemaItem {
        public FieldSetModel( Schema.FieldSet fieldSet ) {

            this.value = fieldSet.getName();

            this.label = String.format( '{0} ({1})', new List<String> {
                    fieldSet.getLabel(),
                    this.value
            } );
        }
    }

    public class RecordTypeModel extends SchemaItem {

        @AuraEnabled
        public Id recordTypeId;

        @AuraEnabled
        public Boolean isActive;

        @AuraEnabled
        public Integer recordCount;

        public RecordTypeModel(Schema.RecordTypeInfo recordTypeInfo){

            this.value = recordTypeInfo.getDeveloperName();
            this.recordTypeId = recordTypeInfo.getRecordTypeId();
            this.isActive = recordTypeInfo.isActive();
            this.recordCount = 0;

            this.label = String.format( '{0} ({1})', new List<String> {
                    recordTypeInfo.getName(),
                    this.value
            } );
        }
    }

    /* public virtual class SharingCriteriaBase {

        @AuraEnabled
        public String fullName;
    }

    public class SharingCriteria extends SharingCriteriaBase {

        @AuraEnabled
        public List<SharingCriteriaRule> sharingCriteriaRules;

        @AuraEnabled
        public List<SharingCriteriaRule> sharingOwnerRules;
    } */

    public class SharingCriteriaRule {

        @AuraEnabled
        public String fullName;

        @AuraEnabled
        public String label;
    }
}