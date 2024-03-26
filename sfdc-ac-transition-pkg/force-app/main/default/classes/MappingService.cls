/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/***********************************************************************************
 * Class that controls content and actions shown in the mapping-related components
 * (namely, mappingSection, and mappingScreen)
 **********************************************************************************/

 public inherited sharing class MappingService {

    private static final Decimal REF_OBJECT_BATCH_SIZE = 50;
    private static final String RECORDTYPE_QUERY = 'SELECT DeveloperName, NamespacePrefix FROM RecordType WHERE SobjectType = \'{0}\'';
    public static String EMPTY_MAPPING_JSON = '{"recommended":[],"additional":[]}';
    public static String CUSTOM_OBJECT_SUFFIX = '__c';
    public static Map<String, Schema.DescribeSObjectResult> objectNameToSchemaMap;

    public static String FILENAME_MAPPINGJSON {get{return (String.isBlank(FILENAME_MAPPINGJSON)) ? Label.MappingJsonTitle : FILENAME_MAPPINGJSON;}set;}
    public static String FILENAME_MAPPINGDOC {get{return (String.isBlank(FILENAME_MAPPINGDOC)) ? Label.MappingDocTitle : FILENAME_MAPPINGDOC;}set;}
    public static String FILEEXTENSION_MAPPINGDOC {get{return (String.isBlank(FILEEXTENSION_MAPPINGDOC)) ? Label.MappingDocExtension : FILEEXTENSION_MAPPINGDOC;}set;}
    public static String FILEEXTENSION_MAPPINGJSON {get{return (String.isBlank(FILEEXTENSION_MAPPINGJSON)) ? Label.MappingJsonExtension : FILEEXTENSION_MAPPINGJSON;}set;}
    public static String INTROTAB_MAPPINGDOC {get{return (String.isBlank(INTROTAB_MAPPINGDOC)) ? Label.MappingDocIntroTabTitle : INTROTAB_MAPPINGDOC;}set;}
    public static String UNAMPPEDTAB_MAPPINGDOC {get{return (String.isBlank(UNAMPPEDTAB_MAPPINGDOC)) ? Label.MappingDocUnmappedTabTitle : UNAMPPEDTAB_MAPPINGDOC;}set;} 

    public static String VALUE_YES_MAPPINGDOC {get{return (String.isBlank(VALUE_YES_MAPPINGDOC)) ? Label.MappingDocValueYes : VALUE_YES_MAPPINGDOC;}set;}
    public static String VALUE_NO_MAPPINGDOC {get{return (String.isBlank(VALUE_NO_MAPPINGDOC)) ? Label.MappingDocValueNo : VALUE_NO_MAPPINGDOC;}set;}

    public static String VALUE_MAPPED_MAPPINGDOC {get{return (String.isBlank(VALUE_MAPPED_MAPPINGDOC)) ? Label.MappingDocColumnMappedYes : VALUE_MAPPED_MAPPINGDOC;}set;}
    public static String VALUE_UNMAPPED_MAPPINGDOC {get{return (String.isBlank(VALUE_UNMAPPED_MAPPINGDOC)) ? Label.MappingDocColumnMappedNo : VALUE_UNMAPPED_MAPPINGDOC;}set;}

    public static List<String> COLUMNS_MAPPINGDOC {
        get {
            if (COLUMNS_MAPPINGDOC == null) {
                return new List<String>{Label.MappingDocColumnMapped, Label.MappingDocColumnSection, Label.MappingDocColumnType, Label.MappingDocColumnSourceObject,
                Label.MappingDocColumnDestObject, '', Label.MappingDocColumnSource, Label.MappingDocColumnDataType,
                Label.MappingDocColumnRequired, Label.MappingDocColumnLength, Label.MappingDocColumnDecimalPlaces,
                Label.MappingDocColumnLookupFilters, '', Label.MappingDocColumnDest, Label.MappingDocColumnDataType,
                Label.MappingDocColumnRequired, Label.MappingDocColumnLength, Label.MappingDocColumnDecimalPlaces,
                Label.MappingDocColumnConflict};
            }
            return COLUMNS_MAPPINGDOC;
        }
        set;
    }

    public static final String IMPORT_MISSING_FILE_NAME = 'MappingImportMissingMetadata';
    public static Set<String> importMissingFields;
    public static Set<String> importMissingRTs;
    public static final Integer MAX_SHEET_NAME_SIZE = 23;

    //COLUMN INDICIES
    private static final Integer COLUMN_INDEX_MAPPED = 0;
    private static final Integer COLUMN_INDEX_SECTION = 1;
    private static final Integer COLUMN_INDEX_TYPE = 2;
    private static final Integer COLUMN_INDEX_SOURCE_OBJECT = 3;
    private static final Integer COLUMN_INDEX_DEST_OBJECT = 4;
    private static final Integer COLUMN_INDEX_SOURCE = 6;
    private static final Integer COLUMN_INDEX_SOURCE_DATATYPE = 7;
    private static final Integer COLUMN_INDEX_SOURCE_REQUIRED = 8;
    private static final Integer COLUMN_INDEX_SOURCE_LENGTH = 9;
    private static final Integer COLUMN_INDEX_SOURCE_DECIMALS = 10;
    private static final Integer COLUMN_INDEX_SOURCE_FILTERS = 11;
    private static final Integer COLUMN_INDEX_DEST = 13;
    private static final Integer COLUMN_INDEX_DEST_DATATYPE = 14;
    private static final Integer COLUMN_INDEX_DEST_REQUIRED = 15;
    private static final Integer COLUMN_INDEX_DEST_LENGTH = 16;
    private static final Integer COLUMN_INDEX_DEST_DECIMALS = 17;
    private static final Integer COLUMN_INDEX_CONFLICT = 18;

    public static List<String> COLUMNS_UNMAPPED_MAPPINGDOC {
        get {
            if (COLUMNS_UNMAPPED_MAPPINGDOC == null) {
                return new List<String>{Label.MappingDocColumnMapped, Label.MappingDocColumnType, Label.MappingDocColumnSourceObject, Label.MappingDocColumnSource, 
                    Label.MappingDocColumnDataType};
            }
            return COLUMNS_UNMAPPED_MAPPINGDOC;
        }
        set;
    }

    private static final String FIELD_NAME_ID = 'id';

    //UNMAPPED INDICIES
    private static final Integer COLUMN_UNAMPPED = 0;
    private static final Integer COLUMN_UNMAPPED_TYPE = 1;
    private static final Integer COLUMN_UNMAPPED_SOURCE_OBJECT = 2;
    private static final Integer COLUMN_UNMAPPED_SOURCE = 3;
    private static final Integer COLUMN_UNMAPPED_DATATYPE = 4;

    //UNMAPPED OBJECTS
    public static List<String> COLUMNS_UNMAPPED_OBJECTS_MAPPINGDOC {
        get {
            if (COLUMNS_UNMAPPED_OBJECTS_MAPPINGDOC == null) {
                return new List<String>{Label.MappingDocUnmappedColumnObjectName, Label.MappingDocUnmappedColumnApiName, Label.MappingDocColumnType, Label.MappingDocColumnSource, Label.MappingDocColumnDataType};
            }
            return COLUMNS_UNMAPPED_OBJECTS_MAPPINGDOC;
        }
        set;
    }

    private static final Integer COLUMN_UOBJECT_NAME = 0;
    private static final Integer COLUMN_UOBJECT_APINAME = 1;
    private static final Integer COLUMN_UOBJECT_TYPE = 2;
    private static final Integer COLUMN_UFIELD_NAME = 3;
    private static final Integer COLUMN_UFIELD_DATATYPE = 4;


    public static String SECTION_ADDITIONAL {get{return (String.isBlank(SECTION_ADDITIONAL)) ? Label.MappingDocSectionAdditional : SECTION_ADDITIONAL;}set;}
    public static String ROWVALUE_FIELD {get{return (String.isBlank(ROWVALUE_FIELD)) ? Label.MappingDocTypeField : ROWVALUE_FIELD;}set;}
    public static String ROWVALUE_RECORDTYPE {get{return (String.isBlank(ROWVALUE_RECORDTYPE)) ? Label.MappingDocTypeRT : ROWVALUE_RECORDTYPE;}set;}
    public static String ROWVALUE_CHILD {get{return (String.isBlank(ROWVALUE_CHILD)) ? Label.MappingDocTypeChild : ROWVALUE_CHILD;}set;}

    public static Map<String, List<List<String>>> UNAMPPED_MAP;

    //Mapping Doc Conflict Errors
    public static String MAPPINGDOC_ERROR_DATATYPE_MISMATCH {get{return (String.isBlank(MAPPINGDOC_ERROR_DATATYPE_MISMATCH)) ? Label.MappingDocErrorDataTypeMismatch : MAPPINGDOC_ERROR_DATATYPE_MISMATCH;}set;}

    @TestVisible
    static List<String> objectMappingList {
        get {
            if(objectMappingList == null) {
                String query = 'SELECT Object_API_Name__c FROM SFDC_Industry_Mapping_Object__mdt WHERE Enabled__c = true ORDER BY Index__c';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Mapping_Object__mdt> objectMeta = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);

                objectMappingList = new List<String>(Utilities.pluckStrings('Object_API_Name__c', objectMeta));
                objectMappingList.sort();
            }
            return objectMappingList;
        }
        set;
    }

    @TestVisible
    static Map<String, SFDC_Industry_Mapping_Object__mdt> fscDescMap {
        get {
            if(fscDescMap == null) {
                String query = 'SELECT Object_API_Name__c, Description_Label__c, Hidden_Record_Types__c FROM SFDC_Industry_Mapping_Object__mdt WHERE Enabled__c = true';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Mapping_Object__mdt> mapObjects = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);

                fscDescMap = new Map<String, SFDC_Industry_Mapping_Object__mdt>();
                for (SFDC_Industry_Mapping_Object__mdt def : mapObjects) {
                    fscDescMap.put(def.Object_API_Name__c, def);
                }
            }
            return fscDescMap;
        }
        set;
    }

    /***********************************************************************************
     * Retrieves a MappingSection (including section name, and corresponding objects 
     * that should be mapped within that section) for use within the assessment.
     * 
     * @param sectionId - The id of the section metadata to retrieve details for
     * @param hideDetails - If true, does not retrieve field and record type data
     * for the relevant section objects, and only returns the object data
     **********************************************************************************/
    @AuraEnabled
    public static MappingSection getMappingForSection(Id sectionId, Boolean hideDetails){
        //try {
        //Get Section Info
        if(sectionId != null){
            String query = 'SELECT Id, DeveloperName, MasterLabel, Description__c FROM SFDC_Industry_Mapping_Section__mdt WHERE Id = \''+ sectionId + '\'';
            String query2 = 'SELECT Object_API_Name__c FROM SFDC_Industry_Mapping_Object__mdt WHERE Mapping_Section__c = \'' + sectionId + '\' ORDER BY Object_API_Name__c';

            //Query Custom Metadata Type
            List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
            List<SFDC_Industry_Mapping_Section__mdt> sectionInfo = (List<SFDC_Industry_Mapping_Section__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Section__mdt>.class);

            if(sectionInfo.size()>0){
                //Get new mapping
                metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query2});
                List<SFDC_Industry_Mapping_Object__mdt> sectionObjects = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);

                List<String> objectNames = new List<String>();
                for (SFDC_Industry_Mapping_Object__mdt objectMeta : sectionObjects) {
                    objectNames.add(objectMeta.Object_API_Name__c);
                }

                MappingSection section = new MappingSection();
                section.sectionTitle = sectionInfo[0].MasterLabel;
                section.sectionValue = sectionInfo[0].DeveloperName;
                section.sectionDescription = sectionInfo[0].Description__c;

                //If hideDetails is false, don't retrieve FSC Schema, just set the names
                ObjectMapping tempMapping;
                // if(hideDetails){
                //     section.sectionMappings = new List<ObjectMapping>();
                //     for (String oName : objectNames) {
                //         tempMapping = new ObjectMapping();
                //         tempMapping.destinationObjectLabel = oName;
                //         tempMapping.destinationObject = oName;
                //         section.sectionMappings.add(tempMapping);
                //     }
                // }else{
                //     section.sectionMappings = buildObjectMappingList(objectNames);
                // }
                section.sectionMappings = buildObjectMappingList(objectNames);
                if(hideDetails){
                    for (ObjectMapping oRow : section.sectionMappings) {
                        oRow.recordTypes = new List<RecordTypes>();
                        oRow.fieldMapping = new List<FieldMapping>();
                    }
                }
                
                return section;
            }
        }
        return null;
    }

    /***********************************************************************************
     * Deletes all mappings from a particular section (used when revising questions 
     * within the assessment)
     * 
     * @param assessmentId - Id of the current assessment
     * @param answerValues - A list containing all sections to delete
     **********************************************************************************/
    @AuraEnabled
    public static void deleteMappingSection(Id assessmentId, List<String> answerValues){
        Set<String> answerValuesSet = new Set<String>(answerValues);
        String mappingJson = getRecommendedJSON(assessmentId);
        if(!String.isBlank(mappingJson)){
            UpgradeMapping mappingDef = (UpgradeMapping) JSON.deserialize(mappingJson, UpgradeMapping.class);
            for (Integer i = mappingDef.recommended.size()-1; i >= 0; i--) {
                if(answerValuesSet.contains(mappingDef.recommended[i].sectionName)){
                    mappingDef.recommended.remove(i);
                }
            }
            AssessmentService.updateAssessment(new Assessment__c(Id = assessmentId, MappingDataJSON__c = JSON.serialize(mappingDef)));  
        }    
    }

    /***********************************************************************************
     * Retrieves the current saved Mapping data for a specific assessment.
     * 
     * @param assessmentId - The id of the assessment to read from
     **********************************************************************************/
    @AuraEnabled
    public static String getRecommendedJSON(Id assessmentId){
        if(assessmentId!=null){
            Assessment__c requestedAssessment = AssessmentService.queryAssessment(assessmentId, new Set<String>{'MappingDataJson__c'});
            return requestedAssessment.MappingDataJson__c;
        }
        return null;
    }

    /***********************************************************************************
     * Saves JSON mapping data into the specified assessment.
     * 
     * @param recordId - The id of the assessment to save to
     * @param filename - [Deprecated] The name of the File attachment
     * @param filetype - [Deprecated] The file extension to use when saving
     * @param filedata - The JSON representation of mapping info, as a String
     **********************************************************************************/
    @AuraEnabled
    public static Boolean saveMapping(Id recordId, String filename, String filetype, String filedata, Boolean isEmpty){
        Database.SaveResult assessmentSaveResult = AssessmentService.updateAssessment(new Assessment__c(Id = recordId, HasMappingData__c = !isEmpty));
        FileUtility.writeFileData(recordId, FILENAME_MAPPINGJSON, FILEEXTENSION_MAPPINGJSON, filedata);
        return assessmentSaveResult != null ? assessmentSaveResult.isSuccess() : false;
    }

    /***********************************************************************************
     * Gets a map containing the default record types for the given list of
     * sections
     * 
     * @param sectionNames - The list of sections to retrieve records for
     **********************************************************************************/
    @AuraEnabled
    public static Map<String,DefaultRecordType> getDefaultRecordTypes(List<String> sectionNames){
        Map<String, DefaultRecordType> defaultList = new Map<String, DefaultRecordType>();

        if(sectionNames!=null && !sectionNames.isEmpty()){
            String query = 'SELECT API_Name__c, Additional_Information__c, Controlling_Question_Value__c, Related_Object__r.Object_API_Name__c FROM SFDC_Industry_Default_Record_Type__mdt WHERE Controlling_Question_Value__c IN {0}';
            String inClause = '( ';
            for (String sectionName : sectionNames) {
                if(inClause == '( '){
                    inClause += '\''+ sectionName +'\'';
                }else{
                    inClause += ',\''+ sectionName +'\'';
                }
                
            }
            inClause += ')';
            query = query.replace('{0}', inClause);

            List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
            List<SFDC_Industry_Default_Record_Type__mdt> defaultRecordTypes = (List<SFDC_Industry_Default_Record_Type__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Default_Record_Type__mdt>.class);

            for (SFDC_Industry_Default_Record_Type__mdt defaultRt : defaultRecordTypes) {
                defaultRt.Additional_Information__c = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + defaultRt.Additional_Information__c);
                defaultList.put(defaultRt.Controlling_Question_Value__c+defaultRt.Related_Object__r.Object_API_Name__c, 
                new DefaultRecordType(defaultRt.Controlling_Question_Value__c+defaultRt.Related_Object__r.Object_API_Name__c, defaultRt.API_Name__c, defaultRt.Additional_Information__c));
            }       
        }
        
        return defaultList;    
    }

    /***********************************************************************************
     * Given a collection of fields (from both "Recommended" and "Additional" sections 
     * of the Mapping screen), retrieves all the necessary metadata information to 
     * then populate the destiniation field with. Used for "cloning" fields.
     **********************************************************************************/
    @AuraEnabled
    public static Map<String, Object> getFieldMetadata(Map<String, String> sectionedFields, Map<String, String> additionalFields){
        System.debug('==Sectioned: ' + sectionedFields);
        System.debug('==Additional: ' + additionalFields);
        Set<String> allFieldNames = new Set<String>();
        for (String field : sectionedFields.keySet()) {
            allFieldNames.add(field);
        }
        for (String field : additionalFields.keySet()) {
            allFieldNames.add(field);
        }
        Map<String, Object> fieldMetadataMap = ExternalUtilities.executeMetadataRead(DependencyHelper.TYPE_CUSTOM_FIELD, new List<String>(allFieldNames)).objectDescribeMap;
        System.debug('==Field Info: ' + fieldMetadataMap);

        return fieldMetadataMap;
    }

    /***********************************************************************************
     * Retrieves the object schema for the current org
     **********************************************************************************/
    @AuraEnabled
    public static List<String> getOrgDefinition(){
        return SchemaService.getObjectsForOrg();
    }

    /***********************************************************************************
     * Retrieves the object schema for the Destination org
     **********************************************************************************/
    @AuraEnabled
    public static List<String> getDestinationDefinition(){
         //Query Custom Metadata Type
         String query = 'SELECT Object_API_Name__c FROM SFDC_Industry_Mapping_Object__mdt';
         List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
         List<SFDC_Industry_Mapping_Object__mdt> destinationObjList = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);
         List<String> destObjList = new List<String>();
         For(SFDC_Industry_Mapping_Object__mdt o : destinationObjList){
            destObjList.add(o.object_API_Name__c);
         }
         return destObjList;
    }

    /***********************************************************************************
     * Retrieves specific field and record type information for the specified
     * SObject
     * 
     * @param apiName - The API Name of the SObject to retrieve details for
     **********************************************************************************/
    @AuraEnabled
    public static ObjectDef getInfoForSObject(String apiName){
        List<RecordType> recordTypes = new List<RecordType>();
        System.debug('apiName======>' + apiName);
        Map<String, String> rtToPrefixName = new Map<String, String>();
        if(Schema.SObjectType.RecordType.isAccessible() || Test.isRunningTest()){
            String rtQuery = RECORDTYPE_QUERY.replace('{0}', String.escapeSingleQuotes(apiName));
            System.debug('rtQuery======>' + rtQuery);
            recordTypes = Database.query(rtQuery);
            System.debug('recordTypes======>' + recordTypes);
        }
        if (!Test.isRunningTest()) {
            recordTypes = (List<RecordType>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, recordTypes, false));
            System.debug('recordTypes1======>' + recordTypes);
        }
        for (RecordType rt : recordTypes) {
            System.debug('rt======>' + rt);
            rtToPrefixName.put(rt.DeveloperName, rt.NamespacePrefix);
        }
        SchemaService.SchemaModel schemaModel = SchemaService.getSchemaModel(apiName);
        System.debug('schemaModel======>' +schemaModel);
        if(schemaModel!=null){
            schemaModel.populateRecordTypeCounts(rtToPrefixName);
            ObjectDef definition = new ObjectDef(schemaModel);
            return definition;
        }
        else{
            ObjectDef definition = null;
            return definition;
        }
        
    }

    /***********************************************************************************
     * Given an Assessment record, retrieves and parses its respective mapping.
     * 
     * @param assessmentRecord - An Assessment__c record that contains mapping data
     * to be extracted and parsed
     **********************************************************************************/
    public static UpgradeMapping getExistingMapping (Assessment__c assessmentRecord){
        try{
            if(assessmentRecord!=null){
                String existingJSON = getMappingJSON(assessmentRecord.Id);
                if(!String.isBlank(existingJSON)){
                    return (UpgradeMapping) System.JSON.deserialize(
                        existingJSON,
                        UpgradeMapping.class
                    );
                }     
            }
        } catch(System.JSONException e){
            SystemLogger.log(LoggingLevel.ERROR, e, assessmentRecord.Id);
            throw new AuraHandledException(e.getMessage());
        }
        return null;
    }

    public static Set<String> getMappedObjectNames(Assessment__c assessmentRecord) {
        Set<String> sourceObjects = new Set<String>();
        UpgradeMapping mapping = getExistingMapping(assessmentRecord);
        for (MappingService.ObjectMapping recommend : mapping.recommended) {
            for (MappingService.MappingSelection selection : recommend.mappingData) {
                sourceObjects.add(selection.source);
            }
        }
        return sourceObjects;
    }

    /***********************************************************************************
     * For use within the final "mapping review" screen of the assessment. Retrieves
     * and parses the MappingDataJson__c value for the specified assessment record.
     * 
     * @param assessmentId - The id of the assessment to read from
     * @param populateSourceDef - Whether or not to also grab source schema info
     **********************************************************************************/
    @AuraEnabled
    public static UpgradeMapping getObjectMappingForAssessment(Id assessmentId, Boolean populateSourceDef){
        //try {
            Assessment__c requestedAssessment = AssessmentService.queryAssessment(assessmentId);
			System.debug('1');
            //UpgradeMapping serializedMapping = (UpgradeMapping) JSON.deserialize(requestedAssessment.MappingDataJson__c, UpgradeMapping.class);
            UpgradeMapping serializedMapping = getExistingMapping(requestedAssessment);

            //Grab relevant data to add to mappings
            Set<String> fscDefs = new Set<String>();
            
            if(serializedMapping!=null){
                //Set Source Schema
                System.debug('2');
                for (ObjectMapping sections : serializedMapping.recommended) {
                    System.debug('3');
                    for (MappingSelection recMapping : sections.mappingData) {
                        System.debug('4');
                        if(!String.isBlank(recMapping.source)){
                            System.debug('5');
                            if(populateSourceDef){
                                System.debug('6');
                                recMapping.sourceDef = getInfoForSObject(recMapping.source);
                            }
                        }
                        if(!String.isBlank(recMapping.destination)){
                            System.debug('7');
                            fscDefs.add(recMapping.destination);
                        }
                    }
                }

                for (MappingSelection addMapping : serializedMapping.additional) {
                    System.debug('8');
                    if(!String.isBlank(addMapping.source)){
                        System.debug('9');
                        if(populateSourceDef){
                            System.debug('10');
                            addMapping.sourceDef = getInfoForSObject(addMapping.source);
                        }
                    }
                    if(!String.isBlank(addMapping.destination)){
                        System.debug('11');
                        fscDefs.add(addMapping.destination);
                    }
                }

                System.debug('DEFS: '+fscDefs);

                //Set FSC Schema
                ExternalUtilities.ExternalSchema fscSchema = ExternalUtilities.requestFSCObjectSchema(new List<String>(fscDefs));
                System.debug('Schema: '+fscSchema);
                if(fscSchema != null) {
                    System.debug('12');
                    for (ObjectMapping sections : serializedMapping.recommended) {
                        System.debug('13');
                        for(MappingSelection recMapping : sections.mappingData) {
                            System.debug('14');
                            Map<String, Object> requestedSchema = (Map<String, Object>)fscSchema.get(recMapping.destination);
                            if(requestedSchema != null) {
                                recMapping.destinationDef = new ObjectMapping(requestedSchema);
                            }
                        }
                    }

                    serializedMapping.recommended = removeHiddenValues(serializedMapping.recommended);
                    System.debug('15');
                    for(MappingSelection addMapping : serializedMapping.additional) {
                        System.debug('16');
                        Map<String, Object> requestedSchema = (Map<String, Object>)fscSchema.get(addMapping.destination);
                        if(requestedSchema != null) {
                            System.debug('17');
                            addMapping.destinationDef = new ObjectMapping(requestedSchema);
                        }
                    }
                }
            }else{
                //If empty (all questions skipped, just produce a blank UpgradeMapping)
                System.debug('18');
                serializedMapping = new UpgradeMapping();
                serializedMapping.recommended = new List<ObjectMapping>();
                serializedMapping.additional = new List<MappingSelection>();
            }
            // System.debug(JSON.serializePretty(serializedMapping));
            return serializedMapping;
    }

    /***********************************************************************************
     * Given an Api Name, retrieves an object's definition from the user org
     * 
     * @param apiName - The name of the field to retrieve details for
     **********************************************************************************/
    @AuraEnabled
    public static ObjectDef getSourceDef (String apiName){
        ObjectDef sourceDef = getInfoForSObject(apiName);
        return sourceDef;
    }

    /***********************************************************************************
     * Retrieves the object schema for the FSC reference org
     **********************************************************************************/
    @AuraEnabled
    public static List<ObjectMapping> getFSCSchema(Integer offSet){
        Integer offsetValue = ((offSet-1) * REF_OBJECT_BATCH_SIZE).intValue();

        String query = 'SELECT Object_API_Name__c FROM SFDC_Industry_Mapping_Object__mdt WHERE Enabled__c = true ORDER BY Index__c LIMIT ' + (REF_OBJECT_BATCH_SIZE.intValue()) + ' OFFSET ' + offsetValue;
        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        system.debug('metaRecords::'+metaRecords);
        List<SFDC_Industry_Mapping_Object__mdt> helpMetadata = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);
		system.debug('helpMetadata::'+helpMetadata);
        objectMappingList = new List<String>(Utilities.pluckStrings('Object_API_Name__c',helpMetadata));
        objectMappingList.sort();
        List<ObjectMapping> fscSchema = buildObjectMappingList(objectMappingList);

        return removeHiddenValues(fscSchema);
    }

    @AuraEnabled(cacheable=true)
    public static Integer getSchemaBatchCount(){
        String query = 'SELECT Count() FROM SFDC_Industry_Mapping_Object__mdt Where Enabled__c = true';

        //Query Custom Metadata Type
        Decimal count = (Decimal) ExternalUtilities.getCustomMetadataCount(query);

        Decimal div = count/REF_OBJECT_BATCH_SIZE;
        return div.round(System.RoundingMode.UP).intValue();
    }

    private static List<ObjectMapping> removeHiddenValues(List<ObjectMapping> mapping){
        //Get Mapping Object Metadata to check for hidden rt's/fields
        Map<String, Set<String>> objectNameToHiddenRtMap = new Map<String, Set<String>>();

        String query = 'SELECT Id, Object_API_Name__c, Hidden_Record_Types__c From SFDC_Industry_Mapping_Object__mdt';

        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        List<SFDC_Industry_Mapping_Object__mdt> objectMeta = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);

        for (SFDC_Industry_Mapping_Object__mdt objectMap : objectMeta) {
            if(!String.isBlank(objectMap.Hidden_Record_Types__c)){
                objectNameToHiddenRtMap.put(objectMap.Object_API_Name__c, new Set<String>(objectMap.Hidden_Record_Types__c.split(',')));
            }
        }

        for (ObjectMapping objectMap : mapping) {
            if(objectNameToHiddenRtMap.containsKey(objectMap.sourceObject)){
                for (Integer i = objectMap.recordTypes.size()-1; i >=0; i--) {
                    if(objectNameToHiddenRtMap.get(objectMap.sourceObject).contains(objectMap.recordTypes[i].source)){
                        objectMap.recordTypes.remove(i);
                    }
                }
            }
        }
        return mapping;
    }

    /***********************************************************************************
     * Constructs a wrapper object representing the object data for the list of 
     * objects specified (containing field and record type data as well).
     * 
     * @param objectList - A list of Strings representing the API Names for the objects
     * to retrieve data for
     **********************************************************************************/
    public static List<ObjectMapping> buildObjectMappingList(List<String> objectList) {
        List<ObjectMapping> objectMapping = new List<ObjectMapping>();

        ExternalUtilities.ExternalSchema schemaMap = ExternalUtilities.requestFSCObjectSchema(objectList);
        if(schemaMap != null) {
            for(String requestedObject : objectList) {
                Map<String, Object> requestedSchema = (Map<String, Object>)schemaMap.get(requestedObject);
                if(requestedSchema != null) {
                    objectMapping.add(new ObjectMapping(requestedSchema));
                }
            }
        }
        return objectMapping;
    }

    /***********************************************************************************
     * Retrieves and organizes the components (objects, fields, record types, etc.) 
     * that are involved in a particular mapping.
     * 
     * 2 versions: one accepts the id of an assessment and one accepts an 
     * assessment record.
     * 
     * @param assessmentId - The id of the assessment to read mapping data from
     * or
     * @param assessment - The assessment to read mapping data from. This should 
     * only be used if the "MappingDataJson__c" field has been retrieved
     **********************************************************************************/
    public static MappedComponents parseMappedComponents(Id assessmentId){
        //load saved object mapping
        Assessment__c assessment = AssessmentService.queryAssessment(assessmentId);
        //parse
        return parseMappedComponents(assessment);
    }

    public static MappedComponents parseMappedComponents(Assessment__c assessment){
        MappedComponents result = new MappedComponents();
        UpgradeMapping mapping = getExistingMapping(assessment);

        Map<String, Set<String>> overallDestinations = new Map<String, Set<String>>();

        //prepare object mapping for matching and filters
        if(mapping != null){
            //Run through the Recommended list
            if (mapping.recommended != null) {
                for (ObjectMapping objectMapping : mapping.recommended) {
                    Set<String> tempDest;
                    //collect mapped object
                    if (objectMapping.mappingData != null) {
                        result.mappedSections.add(objectMapping.sectionName);
                        for (MappingSelection mappingData : objectMapping.mappingData) {
                            //map object info
                            if (String.isNotBlank(mappingData.source) && String.isNotBlank(mappingData.destination)) {
                                result.mappedObjects.add(mappingData.source);
                                result.sourceToDestinationObject.put(mappingData.source, mappingData.destination);
                                if(!overallDestinations.containsKey(mappingData.source)){
                                    overallDestinations.put(mappingData.source, new Set<String>{mappingData.destination});
                                }else{
                                    tempDest = overallDestinations.get(mappingData.source);
                                    tempDest.add(mappingData.destination);
                                    overallDestinations.put(mappingData.source, tempDest);
                                }
                            }
                            //collect mapped record types
                            if (mappingData.recordTypeMapping != null) {
                                for (RecordTypes recordTypeMapping : mappingData.recordTypeMapping) {
                                    if (String.isNotBlank(recordTypeMapping.source) && String.isNotBlank(recordTypeMapping.destination)) {
                                        //PersonAccount special handling
                                        String deploymentObjectName = mappingData.destination;
                                        if (objectMapping.sectionName.contains('B2C') && mappingData.destination == DependencyHelper.TYPE_ACCOUNT) {
                                            deploymentObjectName = DependencyHelper.TYPE_PERSON_ACCOUNT;
                                        }
                                        recordTypeMapping.sourceObject = mappingData.source;
                                        result.recordTypeMappings.add(recordTypeMapping);
                                        result.sourceToDestinationRecordType.put(mappingData.source+'.'+recordTypeMapping.source, deploymentObjectName+'.'+recordTypeMapping.destination);
                                    }
                                }
                            }
                            //collect mapped fields
                            if (mappingData.fieldMapping != null) {
                                for (FieldMapping fieldMapping : mappingData.fieldMapping) {
                                    if (String.isNotBlank(fieldMapping.source) && String.isNotBlank(fieldMapping.destination)) {
                                        fieldMapping.sourceObject = mappingData.source;
                                        result.fieldMappings.add(fieldMapping);
                                        result.mappedFields.add(mappingData.source + '.' + fieldMapping.source);
                                        String destFieldApiName = String.isNotBlank(fieldMapping.newMeta?.apiName) ? fieldMapping.newMeta.apiName+'__c' : fieldMapping.destination;
                                        result.sourceToDestinationField.put(mappingData.source+'.'+fieldMapping.source, mappingData.destination+'.'+destFieldApiName);
                                    }
                                }
                            }
                            //collect mapped child relationships
                            if (mappingData.childRelationships != null) {
                                for (ChildRelationship childRelation : mappingData.childRelationships) {
                                    if (childRelation.newMeta != null) {
                                        childRelation.source = mappingData.source;
                                        childRelation.sourceObject = childRelation.newMeta.apiName.substringBefore('.');
                                        childRelation.newMeta.apiName = childRelation.newMeta.apiName.substringAfter('.');
                                        childRelation.newMeta.connectedObject = mappingData.destination;
                                        childRelation.destination = mappingData.source; //same object changing lookup target
                                        result.childRelationships.add(childRelation);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            //Run through the Additional list
            if(mapping.additional != null){
                for (MappingSelection mappingData : mapping.additional) {
                    Set<String> tempDest;
                    //map object info
                    if (String.isNotBlank(mappingData.source) && String.isNotBlank(mappingData.destination)) {
                        result.mappedObjects.add(mappingData.source);
                        result.sourceToDestinationObject.put(mappingData.source, mappingData.destination);
                        if(!overallDestinations.containsKey(mappingData.source)){
                            overallDestinations.put(mappingData.source, new Set<String>{mappingData.destination});
                        }else{
                            tempDest = overallDestinations.get(mappingData.source);
                            tempDest.add(mappingData.destination);
                            overallDestinations.put(mappingData.source, tempDest);
                        }
                    }
                    //collect mapped record types
                    if (mappingData.recordTypeMapping != null) {
                        for (RecordTypes recordTypeMapping : mappingData.recordTypeMapping) {
                            if (String.isNotBlank(recordTypeMapping.source) && String.isNotBlank(recordTypeMapping.destination)) {
                                recordTypeMapping.sourceObject = mappingData.source;
                                result.recordTypeMappings.add(recordTypeMapping);
                                result.sourceToDestinationRecordType.put(mappingData.source+'.'+recordTypeMapping.source, mappingData.destination+'.'+recordTypeMapping.destination);
                            }
                        }
                    }
                    //collect mapped fields
                    if (mappingData.fieldMapping != null) {
                        for (FieldMapping fieldMapping : mappingData.fieldMapping) {
                            if (String.isNotBlank(fieldMapping.source) && String.isNotBlank(fieldMapping.destination)) {
                                fieldMapping.sourceObject = mappingData.source;
                                result.fieldMappings.add(fieldMapping);
                                result.mappedFields.add(mappingData.source + '.' + fieldMapping.source);
                                String destFieldApiName = String.isNotBlank(fieldMapping.newMeta?.apiName) ? fieldMapping.newMeta.apiName+'__c' : fieldMapping.destination;
                                result.sourceToDestinationField.put(mappingData.source+'.'+fieldMapping.source, mappingData.destination+'.'+destFieldApiName);
                            }
                        }
                    }
                    //collect mapped child relationships
                    if (mappingData.childRelationships != null) {
                        for (ChildRelationship childRelation : mappingData.childRelationships) {
                            if (childRelation.newMeta != null) {
                                childRelation.source = mappingData.source;
                                childRelation.sourceObject = childRelation.newMeta.apiName.substringBefore('.');
                                childRelation.newMeta.apiName = childRelation.newMeta.apiName.substringAfter('.');
                                childRelation.newMeta.connectedObject = mappingData.destination;
                                childRelation.destination = mappingData.source; //same object changing lookup target
                                result.childRelationships.add(childRelation);
                            }
                        }
                    }
                }
            }
            result.overallSourceToDestinationObject = new Map<String, String>();
            for (String key : overallDestinations.keySet()) {
                result.overallSourceToDestinationObject.put(key, overallDestinations.get(key).toString());
            }
        }

        return result;
    }

    /***********************************************************************************
     * Calls out to the external Heroku mapping file service to generate an 
     * xlsx document for a given mapping file, and return the Id of the content to 
     * download
     * 
     * @param recordId - The id of the assessment to save to
     * @param forceRefresh - If true, makes a callout to Heroku regardless of whether
     * or not there is an existing xlsx document for this assessment
     **********************************************************************************/
    @AuraEnabled
    public static String generateMappingFile(Id recordId, Boolean forceRefresh){
        String documentId;
        //Check if file already exists (can just query that rather than generating a new doc)
        ContentVersion fileVersion;
        if(!forceRefresh){
            documentId = FileUtility.getContentDocumentIdByName(recordId, FILENAME_MAPPINGDOC);
        }

        //Call out to ExternalUtilities function, with the given info.
        if(forceRefresh || documentId==null){
            Assessment__c assessment = AssessmentService.queryAssessment(recordId);
            UNAMPPED_MAP = new Map<String, List<List<String>>>();
            //TOOD: Move child relationship retrieval somewhere, and make it queueable to add on to existing pages
            ExternalUtilities.MappingDocumentBody docBody = convertMappingBody(assessment);
            
            if(docBody.Content.Sheets.size()>0){
                ExternalUtilities.MappingDocResponse res = ExternalUtilities.requestMappingXLSXDocument(docBody);

                if(res.xlsxData==null){
                    return null;
                }

                //Insert file
                documentId = FileUtility.writeFileData(recordId, FILENAME_MAPPINGDOC, FILEEXTENSION_MAPPINGDOC, res.xlsxData);
            }           
        }
        return documentId;
    }

    /***********************************************************************************
     * Helper function that takes a "recommend|additional" mapping configuration, and
     * converts it into spreadsheet-like format.
     * 
     * @param assessment - The assesment to grab and convert the mapping from
     **********************************************************************************/
    private static ExternalUtilities.MappingDocumentBody convertMappingBody(Assessment__c assessment){
        
        //Map out mappings from both sections
        List<ExternalUtilities.MappingDocumentSheet> sheets = new List<ExternalUtilities.MappingDocumentSheet>();
        Map<String, ExternalUtilities.MappingDocumentSheet> objectNameToConfigMap = new Map<String, ExternalUtilities.MappingDocumentSheet>();
        UpgradeMapping mappingObject = getExistingMapping(assessment);

        ExternalUtilities.MappingDocumentSheet currentSheet;
        List<ExternalUtilities.MappingDocumentColumn> columnList;
        List<Integer> columnWidths;

        //Create first sheet (intro)
        ExternalUtilities.MappingDocumentSheet introSheet = new ExternalUtilities.MappingDocumentSheet(INTROTAB_MAPPINGDOC);
        introSheet.DataRows = new List<List<String>>();
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'MappingDocIntroTitle')});
        introSheet.DataRows.add(new List<String>{''});
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'UIIntroTableHeaderName') + ': '+ assessment.Name});
        if(assessment.Description__c!=null){
            introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'UIIntroTableHeaderDescription') + ': '+ assessment.Description__c});
        }
        Date createdDate = Date.newInstance(assessment.CreatedDate.year(), assessment.CreatedDate.month(), assessment.CreatedDate.day());
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'UIIntroTableHeaderDate') + ': '+ createdDate});
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'UIIntroTableHeaderCreatedBy') + ': '+ assessment.CreatedBy.Name});
        introSheet.DataRows.add(new List<String>{''});
        AssessmentResultsController.AssessmentResultsView resultsView = AssessmentResultsController.getAssessmentResults(assessment.Id);
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'AssessmentReportHeaderOrgId') + ' '+ resultsView.orgId});
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'AssessmentReportHeaderOrgType') + ' '+ resultsView.orgEdition});
        introSheet.DataRows.add(new List<String>{ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + 'AssessmentReportHeaderVersion') + ' '+ resultsView.assessmentVersion});
        introSheet.Columns = new List<ExternalUtilities.MappingDocumentColumn>();
        introSheet.Columns.add(new ExternalUtilities.MappingDocumentColumn('',90));

        sheets.add(introSheet);

        //Create object sheets
        objectNameToSchemaMap = new Map<String, Schema.DescribeSObjectResult>();

        for (ObjectMapping section : mappingObject.recommended) {
            for (MappingSelection sectionRow : section.mappingData) {
                objectNameToConfigMap = generateSheet(section.sectionName, sectionRow, objectNameToConfigMap, assessment.Id);
            }
        }

        for (MappingSelection additionalRow : mappingObject.additional) {
            objectNameToConfigMap = generateSheet(SECTION_ADDITIONAL, additionalRow, objectNameToConfigMap, assessment.Id);
        }

        //Create second sheet (unmapped objects)
        ExternalUtilities.MappingDocumentSheet unmappedSheet = new ExternalUtilities.MappingDocumentSheet(UNAMPPEDTAB_MAPPINGDOC);
        unmappedSheet.DataRows = new List<List<String>>();
        //TODO: Also get Label
        Map<String, Schema.SObjectType> schema = SchemaService.GLOBAL_DESCRIBE;
        for (String objectName : schema.keySet()) {
            DescribeSObjectResult objectDescribe = schema.get(objectName).getDescribe();
            if(objectName.endsWith(CUSTOM_OBJECT_SUFFIX) || !SchemaService.isExcludedObject(objectDescribe.getName())){
                //Add object to list (and first check if we have partial exclusion)
                if(UNAMPPED_MAP.containsKey(objectName)){
                    //Add excluded fields
                    unmappedSheet.DataRows.addAll(UNAMPPED_MAP.get(objectName));
                }else{
                    //Add "All"
                    unmappedSheet.DataRows.add(new List<String>{objectDescribe.getLabel(), objectDescribe.getName(), '', Label.MappingDocValueAll, ''});
                }   
            }   
        }

        List<ExternalUtilities.MappingDocumentColumn> uColumnList = new List<ExternalUtilities.MappingDocumentColumn>();
        for (Integer i = 0; i < COLUMNS_UNMAPPED_OBJECTS_MAPPINGDOC.size(); i++) {
            uColumnList.add(new ExternalUtilities.MappingDocumentColumn(COLUMNS_UNMAPPED_OBJECTS_MAPPINGDOC[i], 30));
        }
        unmappedSheet.Columns = uColumnList;

        sheets.add(unmappedSheet);
        sheets.addAll(objectNameToConfigMap.values());

        //Truncate and number sheets
        Integer sheetCount = 1;
        String sheetName;

        for (ExternalUtilities.MappingDocumentSheet sheet : sheets) {
            //sheet.Name = sheet.Name.replace('FinServ__', '');
            sheetName = sheetCount+') ';
            sheetName += sheet.Name?.abbreviate(MAX_SHEET_NAME_SIZE);
            sheet.Name = sheetName;
            sheetCount++;
        }

        return new ExternalUtilities.MappingDocumentBody(new ExternalUtilities.MappingDocumentContent(sheets), FILEEXTENSION_MAPPINGDOC.toUpperCase());
    }

    /***********************************************************************************
    * Helper function that iterates through a MappingSelection and returns a 
    * MappingDocumentSheet
    * 
    * @param sectionName - If present, the current section to use
    * @param selection - The current selection to run through
    * @param objectNameToConfigMap - The current map containing all sheets for 
    * this doc
    **********************************************************************************/
    private static Map<String, ExternalUtilities.MappingDocumentSheet> generateSheet(String sectionName, MappingSelection selection, Map<String, ExternalUtilities.MappingDocumentSheet> objectNameToConfigMap, Id assessmentId){
        ExternalUtilities.MappingDocumentSheet currentSheet;
        List<ExternalUtilities.MappingDocumentColumn> columnList = new List<ExternalUtilities.MappingDocumentColumn>();

        //Add initial rows

        List<Integer> columnWidths= new List<Integer>{VALUE_UNMAPPED_MAPPINGDOC.length(), sectionName.length(), ROWVALUE_RECORDTYPE.length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_OBJECT].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST_OBJECT].length(), 15,
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE].length(), 15, 
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_DATATYPE].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_REQUIRED].length()+1, 
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_LENGTH].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_DECIMALS].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_SOURCE_FILTERS].length(), 15,
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST].length(), 
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST_DATATYPE].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST_REQUIRED].length()+1, 
            COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST_LENGTH].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_DEST_DECIMALS].length(), COLUMNS_MAPPINGDOC[COLUMN_INDEX_CONFLICT].length()}; 
        
        for (String column : COLUMNS_MAPPINGDOC) {
            columnWidths.add(column.length());
        }

        currentSheet = (objectNameToConfigMap.containsKey(selection.destination)) ? objectNameToConfigMap.get(selection.destination) : new ExternalUtilities.MappingDocumentSheet(selection.destination);
        if(objectNameToConfigMap.containsKey(selection.destination)){
            columnList = currentSheet.Columns;
            columnWidths = new List<Integer>(); 
            
            for (ExternalUtilities.MappingDocumentColumn column : columnList) {
                columnWidths.add(column.Width);
            }
        }

        //Add source field attributes
        Schema.DescribeSObjectResult sourceSchema;
        Map<String,Schema.SObjectField> sourceFields;
        if(!String.isBlank(selection.source)){
            if(!objectNameToSchemaMap.containsKey(selection.source)){
                Schema.DescribeSObjectResult describeResult = Schema.describeSObjects(new List<String>{selection.source})[0];
                objectNameToSchemaMap.put(selection.source, describeResult);
            }

            sourceSchema = objectNameToSchemaMap.get(selection.source);
            sourceFields = sourceSchema.fields.getMap();
        }
        
        List<String> sheetRow;
        if(selection.fieldMapping!=null){
            for (FieldMapping fieldRow : selection.fieldMapping) {

                Schema.DescribeFieldResult sourceField;
                
                if(sourceFields!=null){
                    sourceField = sourceFields.get(fieldRow.source).getDescribe();
                }

                //Retrieve fieldRow data to allow for dynamic value retrieval
                if(fieldRow.source!=null && fieldRow.destination!=null){
                    //Add initial field data
                    sheetRow = new List<String>{VALUE_MAPPED_MAPPINGDOC, sectionName, ROWVALUE_FIELD, selection.source, selection.destination, '', fieldRow.source};

                    //Modify Data Type label (e.g. from "string" to "Text")
                    String dataType = ''+sourceField.getType();
                    if(dataType == 'String'){
                        dataType = System.Label.DataTypeText;
                    }else if(dataType == 'Double'){
                        dataType = System.Label.DataTypeNumber;
                    }else if(dataType == 'Reference'){
                        dataType = (sourceField.getRelationshipOrder() != null ? System.Label.DataTypeMasterDetail : System.Label.DataTypeLookup);
                    }else if(dataType == 'Boolean'){
                        dataType = System.Label.DataTypeCheckbox;
                    }else{
                        dataType = dataType.toLowerCase().capitalize();
                    }

                    //Add source fields
                    if(sourceField!=null){
                        sheetRow.addAll(new List<String>{(''+dataType), ''+!sourceField.isNillable(), ''+sourceField.getLength(), ''+sourceField.getScale()});
                    }

                    //If Lookup present, show
                    if(sourceField.getFilteredLookupInfo()!=null){
                        sheetRow.add(VALUE_YES_MAPPINGDOC);
                    }else{
                        sheetRow.add(VALUE_NO_MAPPINGDOC);
                    }

                    sheetRow.addAll(new List<String>{'', fieldRow.destination});

                    //If this is a new field, add those values to the row
                    if(fieldRow.newMeta!=null){
                        sheetRow.addAll(new List<String>{fieldRow.newMeta.dataType, ''+fieldRow.newMeta.required, fieldRow.newMeta.length, fieldRow.newMeta.decimalPlaces});

                        //Check for conflicts
                        if(!fieldRow.newMeta.dataType.contains(dataType)){
                            sheetRow.add(MAPPINGDOC_ERROR_DATATYPE_MISMATCH);
                            if(MAPPINGDOC_ERROR_DATATYPE_MISMATCH.length() > columnWidths[COLUMN_INDEX_CONFLICT]){
                                columnWidths[COLUMN_INDEX_CONFLICT] = MAPPINGDOC_ERROR_DATATYPE_MISMATCH.length();
                            }
                        }else{
                            sheetRow.add('');
                        }
                    }else if(fieldRow.currentMeta!=null){
                        String currDataType = ''+fieldRow.currentMeta.dataType;
                        if(currDataType == 'String'){
                            currDataType = System.Label.DataTypeText;
                        }else if(currDataType == 'Double'){
                            currDataType = System.Label.DataTypeNumber;
                        }else if(currDataType == 'Reference'){
                            currDataType = fieldRow.currentMeta.referenceType;
                        }else if(currDataType == 'Boolean'){
                            currDataType = System.Label.DataTypeCheckbox;
                        }else{
                            currDataType = currDataType.toLowerCase().capitalize();
                        }
                        sheetRow.addAll(new List<String>{currDataType, ''+fieldRow.currentMeta.required, fieldRow.currentMeta.length, fieldRow.currentMeta.decimalPlaces});

                        //Check for conflicts
                        if(!currDataType.contains(dataType)){
                            sheetRow.add(MAPPINGDOC_ERROR_DATATYPE_MISMATCH);
                            if(MAPPINGDOC_ERROR_DATATYPE_MISMATCH.length() > columnWidths[COLUMN_INDEX_CONFLICT]){
                                columnWidths[COLUMN_INDEX_CONFLICT] = MAPPINGDOC_ERROR_DATATYPE_MISMATCH.length();
                            }
                        }
                    }

                    //Add row to sheet
                    currentSheet.DataRows.add(sheetRow);

                    //Potentially set column widths
                    if(selection.source.length() > columnWidths[COLUMN_INDEX_SOURCE_OBJECT]){
                        columnWidths[COLUMN_INDEX_SOURCE_OBJECT] = selection.source.length();
                    }
                    if(selection.destination.length() > columnWidths[COLUMN_INDEX_DEST_OBJECT]){
                        columnWidths[COLUMN_INDEX_DEST_OBJECT] = selection.destination.length();
                    }
                    if(fieldRow.source.length() > columnWidths[COLUMN_INDEX_SOURCE]){
                        columnWidths[COLUMN_INDEX_SOURCE] = fieldRow.source.length();
                    }
                    if(fieldRow.destination.length() > columnWidths[COLUMN_INDEX_DEST]){
                        columnWidths[COLUMN_INDEX_DEST] = fieldRow.destination.length();
                    }
                }
            }
        }
        
        if(selection.recordTypeMapping!=null){
            for (RecordTypes rtRow : selection.recordTypeMapping) {
                if(rtRow.source!=null && rtRow.destination!=null){
                    currentSheet.DataRows.add(new List<String>{VALUE_MAPPED_MAPPINGDOC, sectionName, ROWVALUE_RECORDTYPE, selection.source, selection.destination, '', rtRow.source, '', '', '', '', '', '', rtRow.destination});

                    //Potentially set column widths
                    if(selection.source.length() > columnWidths[COLUMN_INDEX_SOURCE_OBJECT]){
                        columnWidths[COLUMN_INDEX_SOURCE_OBJECT] = selection.source.length();
                    }
                    if(selection.destination.length() > columnWidths[COLUMN_INDEX_DEST_OBJECT]){
                        columnWidths[COLUMN_INDEX_DEST_OBJECT] = selection.destination.length();
                    }
                    if(rtRow.source.length() > columnWidths[COLUMN_INDEX_SOURCE]){
                        columnWidths[COLUMN_INDEX_SOURCE] = rtRow.source.length();
                    }
                    if(rtRow.destination.length() > columnWidths[COLUMN_INDEX_DEST]){
                        columnWidths[COLUMN_INDEX_DEST] = rtRow.destination.length();
                    }
                }
            }
        }

        if(selection.childRelationships!=null){
            for (ChildRelationship childRow : selection.childRelationships) {
                currentSheet.DataRows.add(new List<String>{VALUE_MAPPED_MAPPINGDOC, sectionName, ROWVALUE_CHILD, selection.source, selection.destination, '', (childRow.label + '(' + childRow.value + ')'), childRow.newMeta.dataType, '', '', '', '', '', ''});
            }
        }
        
        columnList = new List<ExternalUtilities.MappingDocumentColumn>();
        for (Integer i = 0; i < COLUMNS_MAPPINGDOC.size(); i++) {
            columnList.add(new ExternalUtilities.MappingDocumentColumn(COLUMNS_MAPPINGDOC[i], columnWidths[i]));
        }
        currentSheet.Columns = columnList;

        if(!String.isBlank(selection.source)){
            currentSheet.DataRows.addAll(getUnmappedMetaForObject(assessmentId, selection.source).get(selection.source));
        }
        
        //Add sheet to map
        if(currentSheet.DataRows.size()>0){
            objectNameToConfigMap.put(selection.destination, currentSheet);
        }

        return objectNameToConfigMap;
    }

    private static Map<String, List<List<String>>> getUnmappedMetaForObject(Id assessmentId, String objectApiName){
        List<List<String>> dataRows = new List<List<String>>();
        List<List<String>> unmappedTabDataRows = new List<List<String>>();

        Assessment__c currentAssessment = AssessmentService.queryAssessment(assessmentId);

        UpgradeMapping mappingWrapper = (UpgradeMapping)JSON.deserialize(getMappingJSON(assessmentId), UpgradeMapping.class);

        //Get Schema for Object
        DescribeSObjectResult objectDescribe = Schema.describeSObjects(new String[]{objectApiName})[0];

        //Grab children
        Map<String, SchemaService.FieldModel> childDefs = SchemaService.getChildRelations(objectDescribe);

        //Get all sections pertaining to this object
        List<MappingSelection> rowsForObject = new List<MappingSelection>();
        for (ObjectMapping section : mappingWrapper.recommended) {
            for (MappingSelection mappingData : section.mappingData) {
                if(mappingData.source.equals(objectApiName)){
                    rowsForObject.add(mappingData);
                }
            }
        }

        //Get all for additional section
        for (MappingSelection additionalRow : mappingWrapper.additional) {
            if(additionalRow.source.equals(objectApiName)){
                rowsForObject.add(additionalRow);
            }
        }

        //Gather all fields + record types for object
        Set<String> rtNames = new Set<String>();
        Set<String> fieldNames = new Set<String>();
        Set<String> childNames = new Set<String>();
        for (MappingSelection row : rowsForObject) {
            for (RecordTypes rtMapping : row.recordTypeMapping) {
                rtNames.add(rtMapping.source.toLowerCase());
            }
            for (FieldMapping fieldMapping : row.fieldMapping) {
                fieldNames.add(fieldMapping.source.toLowerCase());
            }
            if(row.childRelationshipDualboxValues!=null){
                for (String childName : row.childRelationshipDualboxValues) {
                    childNames.add(childName);
                }
            }
        }

        //Add RT Rows
        for (String rtApiName : objectDescribe.getRecordTypeInfosByDeveloperName().keySet()) {
            if(!rtNames.contains(rtApiName.toLowerCase())){
                //Add Row
                dataRows.add(new List<String>{VALUE_UNMAPPED_MAPPINGDOC, ROWVALUE_RECORDTYPE, objectApiName, rtApiName, ''});
                unmappedTabDataRows.add(new List<String>{objectDescribe.getLabel(), objectApiName, ROWVALUE_RECORDTYPE, rtApiName, ''});
            }
        }

        //Add Field Rows
        Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();
        for (String fieldApiName : fieldMap.keySet()) {
            if(fieldApiName!= FIELD_NAME_ID && !SchemaService.FIELDS_TO_EXCLUDE.contains(fieldApiName) && !fieldNames.contains(fieldApiName.toLowerCase())){
                //Add Row
                Schema.DescribeFieldResult fieldResult = fieldMap.get(fieldApiName).getDescribe();
                //TODO: Put in a common method
                String dataType = ''+fieldResult.getType();
                if(dataType == 'String'){
                    dataType = System.Label.DataTypeText;
                }else if(dataType == 'Double'){
                    dataType = System.Label.DataTypeNumber;
                }else if(dataType == 'Reference'){
                    dataType = (fieldResult.getRelationshipOrder() != null ? System.Label.DataTypeMasterDetail : System.Label.DataTypeLookup);
                }else if(dataType == 'Boolean'){
                    dataType = System.Label.DataTypeCheckbox;
                }else{
                    dataType = dataType.toLowerCase().capitalize();
                }
                dataRows.add(new List<String>{VALUE_UNMAPPED_MAPPINGDOC, '', ROWVALUE_FIELD, objectApiName, '', '', fieldResult.getName(), dataType});
                unmappedTabDataRows.add(new List<String>{objectDescribe.getLabel(), objectDescribe.getName(), ROWVALUE_FIELD, fieldResult.getName(), dataType});
            }
        }

        //Add Child Rows
        for (String fieldApiName : childDefs.keySet()) {
            if(!childNames.contains(fieldApiName)){
                SchemaService.FieldModel child = childDefs.get(fieldApiName);
                dataRows.add(new List<String>{VALUE_UNMAPPED_MAPPINGDOC, '', ROWVALUE_CHILD, objectApiName, '', '', child.label, child.type});
                unmappedTabDataRows.add(new List<String>{objectDescribe.getLabel(), objectDescribe.getName(), ROWVALUE_CHILD, child.label, child.type});
            }
        }

        UNAMPPED_MAP.put(objectApiName.toLowerCase(), unmappedTabDataRows);

        //If we have rows, add column header and return
        if(dataRows.size()>0){
            return new Map<String, List<List<String>>>{objectApiName=>dataRows};
        }
        return null;
    }

    @TestVisible
    private static Set<String> getUnmappedObjectsForAssessment(Id assessmentId){
        Set<String> objectNameList = new Set<String>();

        Assessment__c currentAssessment = AssessmentService.queryAssessment(assessmentId);
        UpgradeMapping mappingWrapper = (UpgradeMapping)JSON.deserialize(currentAssessment.MappingDataJson__c, UpgradeMapping.class);

        //Recommended List
        for (ObjectMapping section : mappingWrapper.recommended) {
            for (MappingSelection mappingData : section.mappingData) {
                //Check if at least one thing mapped
                if(mappingData.fieldMapping.size()==0 && mappingData.recordTypeMapping.size()==0){
                    objectNameList.add(mappingData.source);
                }
            }
        }

        //Additional List
        for (MappingSelection additionalRow : mappingWrapper.additional) {
            if(additionalRow.fieldMapping.size()==0 && additionalRow.recordTypeMapping.size()==0){
                objectNameList.add(additionalRow.source);
            }
        }

        return objectNameList;
    }

    /***********************************************************************************
    * If present, retreives the Mapping JSON file for the given assessment.
    * 
    * @param assessment - The assesment to grab the file Id for.
    **********************************************************************************/
    @AuraEnabled
    public static String getMappingJSON(Id recordId){
        return FileUtility.readFileDataString(recordId, FILENAME_MAPPINGJSON);
    }

    /***********************************************************************************
    * If present, retreives the Mapping XLSX document Id for the given assessment.
    * 
    * @param assessment - The assesment to grab the file Id for.
    **********************************************************************************/
    @AuraEnabled
    public static String getMappingFileLink(Id recordId){
        return FileUtility.getContentDocumentIdByName(recordId, FILENAME_MAPPINGDOC);
    }

    /***********************************************************************************
     * Given an imported mapping JSON, verifies each object definition 
     * to ensure that the resulting mapping is usuable in the current org.
     * 
     * @param mapping - An existing mapping JSON to verify
     **********************************************************************************/
    public static UpgradeMapping verifyMappings(Id assessmentId, UpgradeMapping mapping){
        Map<String, Set<String>> objectToFieldListMap = new Map<String, Set<String>>();
        Map<String, Set<String>> objectToRecordTypeMap = new Map<String, Set<String>>();
        Set<String> missingSObjects = new Set<String>();
        importMissingFields = new Set<String>();
        importMissingRTs = new Set<String>();

        //Get Object Definitions
        Set<String> sourceObjectNames = new Set<String>();
        Map<String, SObjectDef> verifyDescribeMap = new Map<String, SObjectDef>();

        //Rec
        for (ObjectMapping recommended : mapping.recommended) {
            for (MappingSelection mappingData : recommended.mappingData) {
                if(!String.isBlank(mappingData.source)){
                    sourceObjectNames.add(mappingData.source);
                }
            }
        }

        //Add
        for (MappingSelection mappingData : mapping.additional) {
            if(!String.isBlank(mappingData.source)){
                sourceObjectNames.add(mappingData.source);
            }    
        }

        //For each source name, check to ensure SObject exists in this org
        //NOTE: Using Type.forName() seems to provide a bigger speed boost than describeSObjects (and global describe). Also allows us to easily check existence before attempting to grab the Object Describe
        //Relevant topic: https://salesforce.stackexchange.com/questions/218982/why-is-schema-describesobjectstypes-slower-than-schema-getglobaldescribe

        List<Schema.DescribeSObjectResult> descResult = new List<Schema.DescribeSObjectResult>();

        for (String sourceObjectName : sourceObjectNames) {
            if(Type.forName(sourceObjectName) != null){
                descResult.add(((SObject)Type.forName(sourceObjectName).newInstance()).getSObjectType().getDescribe());
            }else{
                missingSObjects.add(sourceObjectName);
            }
        }

        for (Schema.DescribeSObjectResult result : descResult) {
            verifyDescribeMap.put(result.getName(), new SObjectDef(result));
        }

        System.debug('Describe List: '+verifyDescribeMap.keySet());

        //Iterate through mapping and verify mappings
        //Rec
        for (ObjectMapping recommended : mapping.recommended) {
            for (Integer i = 0; i < recommended.mappingData.size(); i++) {
                recommended.mappingData[i] = SchemaService.verifyMappings(recommended.mappingData[i], verifyDescribeMap.get(recommended.mappingData[i].source));
                // if(recommended.mappingData[i]==null){
                //     recommended.mappingData.remove(i);
                //     i--;
                // }
            }
        }

        //Add
        for (Integer i = 0; i < mapping.additional.size(); i++) {
            mapping.additional[i] = SchemaService.verifyMappings(mapping.additional[i], verifyDescribeMap.get(mapping.additional[i].source));
            // if(mapping.additional[i]==null){
            //     mapping.additional.remove(i);
            //     i--;
            // }
        }

        //Check if we're missing anything. If so, create HTML file of missing metadata
        String missingHTML = '';
        System.debug('==OBJ: '+missingSObjects);
        if(missingSObjects.size() > 0){
            missingHTML += '<b>'+Label.MappingSObjectTitle+'</b>';
            missingHTML += '<ul>';
            for (String missingSObject : missingSObjects) {
                missingHTML += '<li>' + missingSObject + '</li>';
            }
            missingHTML += '</ul><br/>';
        }

        System.debug('==Fields: '+importMissingFields);
        if(importMissingFields.size() > 0){
            missingHTML += '<b>'+Label.MappingFieldTitle+'</b>';
            missingHTML += '<ul>';
            for (String missingField : importMissingFields) {
                missingHTML += '<li>' + missingField + '</li>';
            }
            missingHTML += '</ul><br/>';
        }

        System.debug('==RTs: '+importMissingRTs);
        if(importMissingRTs.size() > 0){
            missingHTML += '<b>'+Label.MappingRTTitle+'</b>';
            missingHTML += '<ul>';
            for (String missingRT : importMissingRTs) {
                missingHTML += '<li>' + missingRT + '</li>';
            }
            missingHTML += '</ul><br/>';
        }

        if(!String.isBlank(missingHTML)){
            FileUtility.writeFileData(assessmentId, MappingService.IMPORT_MISSING_FILE_NAME, 'html', missingHTML);
        }

        return mapping;
    }

    public class SObjectDef {
        public Set<String> fieldList;

        public Set<String> rtList;

        public SObjectDef(Schema.DescribeSObjectResult objectDescribeResult){
            this.fieldList = objectDescribeResult.fields.getMap().keySet();
            this.rtList = objectDescribeResult.getRecordTypeInfosByDeveloperName().keySet();
        }
    }

    /***********************************************************************************
     * Wrappers for Mapping data
     **********************************************************************************/
    public class UpgradeMapping {
        @AuraEnabled
        public List<ObjectMapping> recommended;

        @AuraEnabled
        public List<MappingSelection> additional;

        public UpgradeMapping() {}
    }

    public class ObjectMapping implements Comparable {
        @AuraEnabled
        public String screenId;
        @AuraEnabled
        public String sectionName;
        @AuraEnabled
        public String sourceObject;
        @AuraEnabled
        public String sourceObjectLabel;
        @AuraEnabled
        public String sourceObjectDesc;
        @AuraEnabled
        public String destinationObject;
        @AuraEnabled
        public String destinationObjectLabel;
        @AuraEnabled
        public String destinationObjectDesc;
        @AuraEnabled
        public List<RecordTypes> recordTypes;
        @AuraEnabled
        public List<FieldMapping> fieldMapping;
        @AuraEnabled
        public List<ChildRelationship> childRelationships;
        @AuraEnabled
        public List<String> childRelationshipDualboxValues;
        @AuraEnabled
        public List<FieldSetMapping> fieldSets;
        @AuraEnabled
        public List<MappingSelection> mappingData;

        public ObjectMapping() {}

        public ObjectMapping(Map<String, Object> schema) {
            SFDC_Industry_Mapping_Object__mdt objectMeta = fscDescMap.get((String)schema.get('name'));
            Set<String> hiddenRts = new Set<String>();
            System.debug('objectMeta==> ' + objectMeta);
            if(objectMeta!=null){
                if(objectMeta.Hidden_Record_Types__c!=null){
                    if(!String.isBlank(objectMeta.Hidden_Record_Types__c)){
                        hiddenRts = new Set<String>(objectMeta.Hidden_Record_Types__c.split(','));
                    }
                }
            }            
            this.sourceObject = (String)schema.get('name');
            String namespace = (this.sourceObject.contains('__')) ? this.sourceObject.split('__')[0] : '';
            this.sourceObjectLabel = (String)schema.get('label') + ' (' + (String)schema.get('name') + ')';
            if(objectMeta!=null){
            	this.sourceObjectDesc =  ToolingService.customLabelMap.get(Utilities.namespaceUnderscore+objectMeta.Description_Label__c);
            }
            this.recordTypes = new List<RecordTypes>();
            this.fieldMapping = new List<FieldMapping>();
            this.fieldSets = new List<FieldSetMapping>();
            this.childRelationships = new List<ChildRelationship>();
            this.childRelationshipDualboxValues = new List<String>();
            //this.mappingSelection = new List<MappingSelection>();

            List<Object> recordTypeInfos = (List<Object>)schema.get('recordTypeInfos');
            RecordTypes newRt = new RecordTypes();
            //TODO: Move to label
            newRt.label = '+ '+Label.NewMetaTitleRecordType;
            newRt.value = 'new';
            this.recordTypes.add(newRt);
            Map<String, Object> recordTypeInfoMap;
            if(recordTypeInfos != null) {
                for(Object recordTypeInfo : recordTypeInfos) {
                    try{
                        recordTypeInfoMap = (Map<String, Object>)recordTypeInfo;
                        if(!hiddenRts.contains((String)recordTypeInfoMap.get('developerName'))){
                            this.recordTypes.add(new RecordTypes(recordTypeInfoMap, namespace));
                        }
                    }catch(Exception e){
                        SystemLogger.log(LoggingLevel.ERROR, e);
                    }
                }
            }

            this.recordTypes.sort();

            List<Object> fields = (List<Object>)schema.get('fields');
            FieldMapping newField = new FieldMapping();

            newField.label = '+ '+Label.NewMetaTitleField;
            newField.value = 'new';
            
            this.fieldMapping.add(newField);

            FieldMapping cloneField = new FieldMapping();

            cloneField.label = Label.CloneMetaTitleField;
            cloneField.value = 'clone';
            
            this.fieldMapping.add(cloneField);

            if(fields != null) {
                for(Object field : fields) {
                    try{
                        Map<String, Object> fieldInfo = (Map<String, Object>) field;
                        if(!SchemaService.FIELDS_TO_EXCLUDE.contains(((String)fieldInfo.get('name')).toLowerCase())){
                            this.fieldMapping.add(new FieldMapping(fieldInfo));
                        }
                    }catch(Exception e){
                        SystemLogger.log(LoggingLevel.ERROR, e);
                    }
                }
            }

            this.fieldMapping.sort();
        }

        public Integer compareTo(Object compareTo) {
            ObjectMapping compareToObj = (ObjectMapping)compareTo;
            if (sectionName == compareToObj.sectionName) return 0;
            if (sectionName > compareToObj.sectionName) return 1;
            return -1; 
        }
    }

    public virtual class MappingItem {
        @AuraEnabled
        public String source;
        @AuraEnabled
        public String sourceLabel;
        @AuraEnabled
        public String destination;
        @AuraEnabled
        public String destinationLabel;
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String value;

        public MappingItem(){
            this.label = sourceLabel;
            this.value = source;
        }
    }

    public class FieldMapping extends MappingItem implements Comparable{
        @AuraEnabled
        public String truncate;
        @AuraEnabled
        public String type;
        @AuraEnabled
        public String userGenerated;
        @AuraEnabled
        public NewFieldMeta newMeta;
        @AuraEnabled
        public NewFieldMeta currentMeta;

        public String sourceObject;

        public FieldMapping() {}

        public FieldMapping(Map<String, Object> fieldInfo) {
            this.source = (String)fieldInfo.get('name');
            String dataType = (String)fieldInfo.get('type');
            this.type = dataType;
            if(this.type == 'String'){
                this.type = System.Label.DataTypeText;
            }else if(this.type == 'Double'){
                this.type = System.Label.DataTypeNumber;
            }else if(this.type == 'Reference'){
                this.type = (fieldInfo.get('relationshipOrder') != null ? System.Label.DataTypeMasterDetail : System.Label.DataTypeLookup);
            }else if(this.type == 'Boolean'){
                this.type = System.Label.DataTypeCheckbox;
            }
            this.sourceLabel = (String)fieldInfo.get('label') + ' (' +this.source + ') ' + '('+this.type.capitalize()+')';
            this.label = this.sourceLabel;
            this.value = this.source;

            //Set Current Meta fields (as they exist)
            this.currentMeta = new NewFieldMeta();
            // this.currentMeta.dataType = (String)fieldInfo.get('type');
            this.currentMeta.dataType = dataType;
            this.currentMeta.length = (fieldInfo.containsKey('length')) ? (String)String.valueOf(fieldInfo.get('length')) : '';
            this.currentMeta.decimalPlaces = (fieldInfo.containsKey('scale')) ? (String)String.valueOf(fieldInfo.get('scale')) : '';
            this.currentMeta.unique = (fieldInfo.containsKey('unique')) ? (Boolean)fieldInfo.get('unique') : false;
            this.currentMeta.required = (fieldInfo.containsKey('nillable')) ? !(Boolean)fieldInfo.get('nillable') : false;
            this.currentMeta.childRelationshipName = (fieldInfo.containsKey('relationshipName')) ? (String)fieldInfo.get('relationshipName') : '';
            this.currentMeta.connectedObject = (fieldInfo.containsKey('referenceTo')) ? (String)fieldInfo.get('referenceTo').toString() : '';
            this.currentMeta.defaultValue = (fieldInfo.containsKey('defaultValueFormula')) ? (String)fieldInfo.get('defaultValueFormula') : '';
            this.currentMeta.referenceType = (fieldInfo.get('relationshipOrder') != null ? System.Label.DataTypeMasterDetail : System.Label.DataTypeLookup);
        }

        public Integer compareTo(Object compareTo) {
            FieldMapping compareToConfig = (FieldMapping) compareTo;
            if (sourceLabel == compareToConfig.sourceLabel) return 0;
            if (sourceLabel > compareToConfig.sourceLabel) return 1;
            return -1;
        }
    }

    public class FieldSetMapping extends MappingItem {

    }

    public class RecordTypes extends MappingItem implements Comparable{

        @AuraEnabled
        public String recordTypeId;
        @AuraEnabled
        public Boolean available;
        @AuraEnabled
        public Boolean defaultRecordTypeMapping;
        @AuraEnabled
        public Boolean master;
        @AuraEnabled
        public String userGenerated;
        @AuraEnabled
        public NewRecordTypeMeta newMeta;
        @AuraEnabled
        public NewFieldMeta currentMeta;

        //public Map<String,String> newMeta;
        public String sourceObject;

        public RecordTypes() {}

        public RecordTypes(Map<String, Object> recordTypeInfo, String namespace) {
            this.source = (!String.isBlank(namespace)) ? namespace + '__' + (String)recordTypeInfo.get('developerName') : (String)recordTypeInfo.get('developerName');
            this.sourceLabel = (String)recordTypeInfo.get('name') + ' (' + this.source +')';
            this.recordTypeId = (String)recordTypeInfo.get('recordTypeId');
            this.available = (Boolean)recordTypeInfo.get('available');
            this.defaultRecordTypeMapping = (Boolean)recordTypeInfo.get('defaultRecordTypeMapping');
            this.master = (Boolean)recordTypeInfo.get('master');
            this.label = this.sourceLabel;
            this.value = this.source;
        }

        public Integer compareTo(Object compareTo) {
            RecordTypes compareToConfig = (RecordTypes) compareTo;
            if (sourceLabel == compareToConfig.sourceLabel) return 0;
            if (sourceLabel > compareToConfig.sourceLabel) return 1;
            return -1;
        }
    }

    public class ChildRelationship extends MappingItem {
        @AuraEnabled
        public NewFieldMeta newMeta;

        public String sourceObject;

        public ChildRelationship() {}
    }

    public class MappingSelection {

        @AuraEnabled
        public Boolean showDetails {get;set;}

        @AuraEnabled
        public String source {get;set;}

        @AuraEnabled
        public String destinationLabel {get;set;}

        @AuraEnabled
        public String assessmentDescription {get;set;}

        @AuraEnabled
        public String destination {get;set;}

        @AuraEnabled
        public ObjectDef sourceDef {get;set;}

        @AuraEnabled
        public ObjectMapping destinationDef {get;set;}

        @AuraEnabled
        public String destinationObjectMetaName {get;set;}

        @AuraEnabled
        public List<RecordTypes> recordTypeMapping {get;set;}

        @AuraEnabled
        public List<FieldMapping> fieldMapping {get;set;}

        @AuraEnabled
        public List<ChildRelationship> childRelationships {get;set;}

        @AuraEnabled
        public List<String> childRelationshipDualboxValues;

        public MappingSelection() {}
    }

    //BB Todo: Enhance to be more universal
    public class ObjectDef {
        //API Name
        @AuraEnabled
        public String value {get;set;}

        //Object Label
        @AuraEnabled
        public String label {get;set;}

        @AuraEnabled
        public List<PicklistUtility.ComboboxValue> recordTypes {get;set;}

        @AuraEnabled
        public List<PicklistUtility.ComboboxValue> fields {get;set;}

        @AuraEnabled
        public Map<String, SchemaService.FieldModel> childRelationshipDefs {get;set;}

        @AuraEnabled
        public List<SchemaService.FieldModel> childRelationshipList {get;set;}

        @AuraEnabled
        public List<PicklistUtility.ComboboxValue> fieldSets {get;set;}

        public ObjectDef(SchemaService.SchemaModel schemaModel){
            this.value = schemaModel.value;
            this.label = schemaModel.label;
            this.recordTypes = PicklistUtility.getComboboxValues(schemaModel.recordTypes);
            this.fields = PicklistUtility.getComboboxValues(schemaModel.fields);
            this.fieldSets = PicklistUtility.getComboboxValues(schemaModel.fieldSets);
            this.childRelationshipDefs = schemaModel.childRelationships;
            this.childRelationshipList = (this.childRelationshipDefs.size()>0) ? this.childRelationshipDefs.values() : new List<SchemaService.FieldModel>();
        }
    }

    public class MappingSection {
        @AuraEnabled
        public String sectionTitle {get;set;}
        @AuraEnabled
        public String sectionValue {get;set;}
        @AuraEnabled
        public String sectionDescription {get;set;}
        @AuraEnabled
        public List<ObjectMapping> sectionMappings {get;set;}
    }

    public virtual class NewMeta {
        @AuraEnabled
        public String label {get;set;}
        @AuraEnabled
        public String apiName {get;set;}
        @AuraEnabled
        public String description {get;set;}
        @AuraEnabled 
        public String conflict {get;set;}

        public NewMeta() {}

        public NewMeta(String label, String apiName, String description, String conflict){
            this.label = label;
            this.apiName = apiName;
            this.description = description;
            this.conflict = conflict;
        }

        public Map<String, Object> mapify(){
            return (Map<String,Object>) JSON.deserializeUntyped(JSON.serialize(this));
        }
    }

    public class NewRecordTypeMeta extends NewMeta {
        @AuraEnabled
        public Boolean active {get;set;}

        public NewRecordTypeMeta() {}

        public NewRecordTypeMeta(String label, String apiName, String description, String conflict, Boolean active){
            super(label, apiName, description, conflict);
            this.active = active;
        }
    }

    public class NewFieldMeta extends NewMeta {
        @AuraEnabled
        public String dataType {get;set;}
        @AuraEnabled
        public String helpText {get;set;}
        @AuraEnabled
        public String length {get;set;}
        @AuraEnabled
        public String decimalPlaces {get;set;}
        @AuraEnabled
        public Boolean required {get;set;}
        @AuraEnabled
        public Boolean unique {get;set;}
        @AuraEnabled
        public String defaultValue {get;set;}
        @AuraEnabled
        public String connectedObject {get;set;}
        @AuraEnabled
        public String childRelationshipName {get;set;}
        @AuraEnabled
        public String referenceType {get;set;}

        public NewFieldMeta() {}

        public NewFieldMeta(String label, String apiName, String description, String conflict, String dataType, String helpText, String length, String decimals, Boolean required){
            super(label, apiName, description, conflict);
            this.dataType = dataType;
            this.helpText = helpText;
            this.length = length;
            this.decimalPlaces = decimals;
            this.required = required;
        }
    }

    /***********************************************************************************
     * Wrapper for Default Record Type Data
     **********************************************************************************/
    public class DefaultRecordType {
        @AuraEnabled
        public String key {get;set;}
        @AuraEnabled
        public String apiName {get;set;}
        @AuraEnabled
        public String additionalInfo {get;set;}

        public DefaultRecordType(String key, String apiName, String additionalInfo){
            this.key = key;
            this.apiName = apiName;
            this.additionalInfo = additionalInfo;
        }
    }

    /***********************************************************************************
     * Wrapper for scanning/automation using mapping data
     **********************************************************************************/
    public class MappedComponents {
        public Map<String, String> overallSourceToDestinationObject {get;set;}
        public Map<String,String> sourceToDestinationObject {get;set;}
        public Map<String,String> sourceToDestinationField {get;set;}
        public Map<String,String> sourceToDestinationRecordType {get;set;}
        public Map<String,List<String>> objectToRecordTypes {get;set;}
        public Set<String> mappedObjects {get;set;}
        public Set<String> mappedFields {get;set;}
        public Set<String> mappedSections {get;set;}
        public List<FieldMapping> fieldMappings {get;set;}
        public List<RecordTypes> recordTypeMappings {get;set;}
        public List<ChildRelationship> childRelationships {get;set;}

        public MappedComponents() {
            this.sourceToDestinationObject = new Map<String, String>();
            this.sourceToDestinationField = new Map<String, String>();
            this.sourceToDestinationRecordType = new Map<String, String>();
            this.objectToRecordTypes = new Map<String,List<String>>();
            this.mappedObjects = new Set<String>();
            this.mappedFields = new Set<String>();
            this.mappedSections = new Set<String>();
            this.fieldMappings = new List<FieldMapping>();
            this.recordTypeMappings = new List<RecordTypes>();
            this.childRelationships = new List<ChildRelationship>();
        }
    }

}