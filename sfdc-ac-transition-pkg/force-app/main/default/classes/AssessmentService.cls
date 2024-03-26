/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public with sharing class AssessmentService {
    @TestVisible
    static final Map<String, Schema.SObjectField> ASSESSMENT_FIELD_SCHEMA = Schema.SObjectType.Assessment__c.fields.getMap();
    static final Set<String> REQUIRED_ASSESSMENT_FIELDS = new Set<String>{
        Utilities.namespaceUnderscore + 'Current_Question_Id__c',
        Utilities.namespaceUnderscore + 'Current_Question_Number__c'
    };
    static final String ASSESSMENT_QUESTION_TEMPLATE = '{0} {1}';
    static final String HAS_PERSON_ACCOUNTS_ASSESSMENT_VALUE = 'People (B2C)';
    static final String NO_PERSON_ACCOUNTS_ASSESSMENT_VALUE = 'Businesses (B2B)';
    static final String HAS_PERSON_ACCOUNTS_ASSESSMENT_FIELD =  Utilities.namespaceUnderscore + 'Customer_Representation__c';
    static final String HAS_PERSON_ACCOUNTS_REPORT_FIELD = Utilities.namespaceUnderscore + 'Is_B2C__c';
    static final String HAS_BUSINESS_ACCOUNTS_REPORT_FIELD = Utilities.namespaceUnderscore + 'Is_B2B__c';
    static final String STARTING_QUESTION_API_NAME = 'Starting_Question';
    static final String COMPARISON_TYPE_CONTAINS = 'Contains';
    static final String STATUS_MAPPING = 'Mapping';
    @TestVisible
    static final String STATUS_ASSESSMENT = 'Questionnaire';
    static final String STATUS_NEW = 'New';
    static final String STATUS_REVIEW = 'Review';
    static final String STATUS_SCANNING = 'Scanning';
    static final String SAMPLE_TOOLING_QUERY = 'SELECT Id FROM ExternalString WHERE NamespacePrefix = \''+Utilities.namespace+'\' LIMIT 1';

    static final String EXPORTED_MAPPING_FILE_NAME = 'MappingExportJSON';
    static final String DOWNLOAD_URL_PREFIX = Label.MappingExportDownloadUrlPrefix;

    @TestVisible
    static Map<Id, SFDC_Industry__mdt> industryMap {
        get {
            if(industryMap == null) {
                String query = 'SELECT Id, DeveloperName, MasterLabel, Package_Id__c, Package_Namespace__c, Package_Version__c, Product_Name__c FROM SFDC_Industry__mdt ORDER BY MasterLabel ASC LIMIT 10';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry__mdt> industryMeta = (List<SFDC_Industry__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry__mdt>.class);
                industryMap = new Map<Id, SFDC_Industry__mdt>();
                for (SFDC_Industry__mdt record : industryMeta) {
                    industryMap.put(record.Id, record);
                }
            }
            return industryMap;
        }
        set;
    }

    @TestVisible
    static Map<String, List<SFDC_Industry_Vertical__mdt>> industryVerticalMap {
        get {
            if(industryVerticalMap == null) {
                String query = 'SELECT DeveloperName, MasterLabel, Industry__r.DeveloperName, Industry__c, Display_Label__c, Icon_Name__c, Description_Label__c, Field__c, Value__c, Sort_Order__c FROM SFDC_Industry_Vertical__mdt ORDER BY Sort_Order__c ASC LIMIT 100';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Vertical__mdt> industryMeta = (List<SFDC_Industry_Vertical__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Vertical__mdt>.class);
                
                industryVerticalMap = Utilities.groupByStrings('Industry__r.DeveloperName', industryMeta);
            }
            return industryVerticalMap;
        }
        set;
    }

    @TestVisible
    static List<SFDC_Industry_Assessment_Question__mdt> industryAssessmentQuestionList {
        get {
            if(industryAssessmentQuestionList == null) {
                String query = 'SELECT Id, DeveloperName, MasterLabel, Answer_Field_API_Name__c, Question_Required__c, Question_Label_Name__c, Question_Help_Text__c FROM SFDC_Industry_Assessment_Question__mdt LIMIT 200';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Assessment_Question__mdt> questionMeta = (List<SFDC_Industry_Assessment_Question__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Question__mdt>.class);

                industryAssessmentQuestionList = questionMeta;
            }
            return industryAssessmentQuestionList;
        }
        set;
    }

    @TestVisible
    static Map<Id, SFDC_Industry_Assessment_Question__mdt> industryAssessmentQuestionMap {
        get {
            if(industryAssessmentQuestionMap == null) {
                industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt>(industryAssessmentQuestionList);
            }
            return industryAssessmentQuestionMap;
        }
        set;
    }


    @TestVisible
    static List<SFDC_Industry_Assessment_Question_Branch__mdt> industryAssessmentQuestionBranchList {
        get {
            if(industryAssessmentQuestionBranchList == null) {
                String query = 'SELECT Controlling_Question__c, Following_Question__c, Controlling_Question_Value__c, Is_Default_Outcome__c, External_Render_Flags__c FROM SFDC_Industry_Assessment_Question_Branch__mdt ORDER BY Is_Default_Outcome__c ASC NULLS FIRST LIMIT 100';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Assessment_Question_Branch__mdt> branchMeta = (List<SFDC_Industry_Assessment_Question_Branch__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Question_Branch__mdt>.class);

                industryAssessmentQuestionBranchList = branchMeta;
            }
            return industryAssessmentQuestionBranchList;
        }
        set;
    }

    @TestVisible
    static Map<Id, List<SFDC_Industry_Assessment_Question_Branch__mdt>> industryAssessmentControllingQuestionBranchMap {
        get {
            if(industryAssessmentControllingQuestionBranchMap == null) {
                industryAssessmentControllingQuestionBranchMap = Utilities.groupByIds(
                    'Controlling_Question__c',
                    industryAssessmentQuestionBranchList
                );
            }
            return industryAssessmentControllingQuestionBranchMap;
        }
        set;
    }

    @TestVisible
    static Map<Id, List<SFDC_Industry_Assessment_Question_Branch__mdt>> industryAssessmentFollowingQuestionBranchMap {
        get {
            if(industryAssessmentFollowingQuestionBranchMap == null) {
                industryAssessmentFollowingQuestionBranchMap = Utilities.groupByIds(
                    'Following_Question__c',
                    industryAssessmentQuestionBranchList
                );
            }
            return industryAssessmentFollowingQuestionBranchMap;
        }
        set;
    }

    @TestVisible
    static Map<Id, List<SFDC_Industry_Assessment_Exclude__mdt>> industryAssessmentQuestionExcludeMap {
        get {
            if(industryAssessmentQuestionExcludeMap == null) {
                String query = 'SELECT SFDC_Industry_Assessment_Question__c, Controlling_Field__c, Controlling_Value__c, Exclude_Value__c FROM SFDC_Industry_Assessment_Exclude__mdt LIMIT 200';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Assessment_Exclude__mdt> excludeMeta = (List<SFDC_Industry_Assessment_Exclude__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Exclude__mdt>.class);

                industryAssessmentQuestionExcludeMap = Utilities.groupByIds('SFDC_Industry_Assessment_Question__c', excludeMeta);
            }
            return industryAssessmentQuestionExcludeMap;
        }
        set;
    }

    @AuraEnabled
    public static String checkConnectedAppStatus(){
        String queryStatus = ExternalUtilities.executeToolingQuery(SAMPLE_TOOLING_QUERY);
        if(queryStatus==null){
            return Label.ConnectedAppError;
        }
        return '';
    }

    @AuraEnabled
    public static String checkPackageVersionStatus(){
        //Call /hasLatestPackageVersion
        return ExternalUtilities.checkForPackageVersionUpdates();
    }

    @AuraEnabled(cacheable=true)
    public static Boolean isInSandbox(){
        Organization org = [SELECT IsSandbox FROM Organization LIMIT 1];

        return org.IsSandbox;
    }

    // reactive property to show that the Assessment has encountered a CPU limit warning exception
    @AuraEnabled
    public static Boolean getAssessmentCpuWarning(Id assessmentId){
        if(assessmentId != null) {
            Assessment__c currentAssessment = queryAssessment(assessmentId);
            return currentAssessment.Timeout_Warning_Indicator__c;
        }
        else { return false; }
    }

    @AuraEnabled(cacheable=true)
    public static List<VerticalInfo> getOrgVerticals(String industryName){
        List<VerticalInfo> orgVerticals = new List<VerticalInfo>();
        for(SFDC_Industry_Vertical__mdt currentVertical : industryVerticalMap.get(industryName)) {
            orgVerticals.add(new VerticalInfo(currentVertical));
        }

        return orgVerticals;
    }

    @AuraEnabled(cacheable=true)
    public static List<AssessmentInfo> getOrgAssessments(){
        List<AssessmentInfo> orgAssessments = new List<AssessmentInfo>();
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Name, Status__c, CreatedDate, Description__c, CreatedById, LastModifiedById, 
            CreatedBy.Name, LastModifiedBy.Name, Timeout_Warning_Indicator__c
            FROM Assessment__c
            ORDER BY CreatedDate ASC, Name ASC
        ], true);
        //unpopulate stripped fields force null prevent error
        Utilities.nullStrippedFields(decision);
        //build results
        for(Assessment__c currentAssessment : (List<Assessment__c>)decision.getRecords()) {
            orgAssessments.add(new AssessmentInfo(currentAssessment));
        }
        return orgAssessments;
    }

    @AuraEnabled
    public static String getCurrentAssessmentQuestion(Id assessmentId) {
        Assessment__c currentAssessment = queryAssessment(assessmentId);
        return (currentAssessment.Status__c.equals(STATUS_MAPPING)) ? 'MAP' : currentAssessment.Current_Question_Id__c;
    }

    @AuraEnabled
    public static void backToQuestionnaire(Id assessmentId) {
        Assessment__c currentAssessment = queryAssessment(assessmentId);
        currentAssessment.Status__c = STATUS_ASSESSMENT;
        updateAssessment(currentAssessment);
    }

    @AuraEnabled
    public static Id updateAssessmentRecords(Id assessmentId, Boolean isChecked, String objName) {
        System.debug(assessmentId);
        System.debug(isChecked);
        System.debug(objName);
        if(String.isNotBlank(assessmentId) && String.isNotBlank(objName)){
            Assessment__c currentAssessment = queryAssessment(assessmentId);
            if(objName.containsIgnoreCase('Vehicle')){
                if(isChecked){
                    currentAssessment.Vehicle_Selected__c = true;
                }
                else{
                    currentAssessment.Vehicle_Selected__c = false;
                }
            }
            else if(objName.containsIgnoreCase('Warranties')){
                if(isChecked){
                    currentAssessment.Warranties_Selected__c = true;
                }
                else{
                    currentAssessment.Warranties_Selected__c = false;
                }
            }
            updateAssessment(currentAssessment);
            return currentAssessment.id;
        }
        return null;
    }

    @AuraEnabled
    public static Id getStartingQuestion(List<VerticalInfo> verticalList) {
        if(verticalList == null || verticalList.isEmpty()) return null;

        // AssessmentQuestion startingQuestion = new AssessmentQuestion(industryAssessmentQuestionMap.get([
        //     SELECT Following_Question__c
        //     FROM SFDC_Industry_Assessment_Question_Branch__mdt
        //     WHERE Industry__c =: verticalList[0].IndustryId
        //         AND Controlling_Question__c = null
        // ].Following_Question__c), 1);

        Map<String, List<String>> selectedVerticalInfoMap = new Map<String, List<String>>();
        for(VerticalInfo vertical : verticalList) {
            if(vertical.VerticalSelected == true) {
                List<String> currentValues = selectedVerticalInfoMap.get(vertical.Field);
                if(currentValues == null) {
                    selectedVerticalInfoMap.put(vertical.Field, new List<String>{vertical.Value});
                }
                else {
                    currentValues.add(vertical.value);
                }
            }
        }

        Assessment__c newAssessment = new Assessment__c(
            Current_Question_Number__c = 1,
            Current_Question_Id__c = '0',
            Status__c = STATUS_ASSESSMENT
        );
        for(String key : selectedVerticalInfoMap.keySet()) {
            newAssessment.put(key,  String.join(selectedVerticalInfoMap.get(key), ';'));
            for(String v : selectedVerticalInfoMap.get(key)){
                if(v.equalsIgnoreCase('AC Fleet Owners')){
                    newAssessment.put('Fleet_Subverticle_Selected__c',true);
                }
                if(v.equalsIgnoreCase('AC Captive Finance Companies')){
                    newAssessment.put('Captive_Subverticle_Selected__c',true);
                }
                if(v.equalsIgnoreCase('AC Dealers')){
                    newAssessment.put('Dealer_Subverticle_Selected__c',true);
                }
            }   
        }

        Database.SaveResult dmlResult = insertAssessment(newAssessment);
        GetOrgFieldCountQueueable.createAsyncRequest(dmlResult.getId());
        return dmlResult.getId();
    }

    @AuraEnabled
    public static AssessmentQuestion saveQuestion(String currentQuestionJson){
        AssessmentQuestion nextQuestion;
        AssessmentQuestion currentQuestion = (AssessmentQuestion)JSON.deserialize(currentQuestionJson, AssessmentQuestion.class);

        // Assessment__c currentAssessment = new Assessment__c(
        //     Id = currentQuestion.AssessmentId,
        //     Status__c = STATUS_ASSESSMENT
        // );

        Assessment__c currentAssessment = queryAssessment(currentQuestion.AssessmentId);
        //currentAssessment.Status__c = STATUS_ASSESSMENT;

        try{
            if(currentQuestion.IsCheckBox == true) {
                currentAssessment.put(currentQuestion.AnswerFieldAPIName, currentQuestion.SelectedCheckbox);
            }
            else {
                currentAssessment.put(currentQuestion.AnswerFieldAPIName, currentQuestion.SelectedAnswer);
                if(currentQuestion.AnswerFieldAPIName == HAS_PERSON_ACCOUNTS_ASSESSMENT_FIELD) {
                    currentAssessment.put(
                        HAS_PERSON_ACCOUNTS_REPORT_FIELD,
                        !String.isBlank(currentQuestion.SelectedAnswer) && currentQuestion.SelectedAnswer != NO_PERSON_ACCOUNTS_ASSESSMENT_VALUE
                    );
                    currentAssessment.put(
                        HAS_BUSINESS_ACCOUNTS_REPORT_FIELD,
                        !String.isBlank(currentQuestion.SelectedAnswer) && currentQuestion.SelectedAnswer != HAS_PERSON_ACCOUNTS_ASSESSMENT_VALUE
                    );
                }
            }


            List<SFDC_Industry_Assessment_Question_Branch__mdt> branchOutcomes = industryAssessmentControllingQuestionBranchMap.get(currentQuestion.QuestionId);
            //No remaining branches assessment is complete
            if(branchOutcomes == null) {
                //currentAssessment.Status__c = STATUS_MAPPING;
            }
            else {
                // SFDC_Industry_Assessment_Question_Branch__mdt selectedOutcome;
                // for(SFDC_Industry_Assessment_Question_Branch__mdt outcome : branchOutcomes) {
                //     if((outcome.Is_Default_Outcome__c == true) ||
                //         (currentQuestion.IsCheckBox == true && currentQuestion.SelectedCheckbox != null && currentQuestion.SelectedCheckbox == Boolean.valueOf(outcome.Controlling_Question_Value__c)) ||
                //         (currentQuestion.IsPicklist == true && String.isBlank(currentQuestion.SelectedAnswer) == false && currentQuestion.SelectedAnswer == outcome.Controlling_Question_Value__c) ||
                //         (currentQuestion.IsMultiSelect == true && String.isBlank(currentQuestion.SelectedAnswer) == false && currentQuestion.SelectedAnswer.contains(outcome.Controlling_Question_Value__c))
                //     ) {
                //         selectedOutcome = outcome;
                //         break;
                //     }
                // }

                // Integer originalNumber = currentQuestion.QuestionNumber;
                // //Based on the current selection there is no related branch that requires another question assessment is complete
                // if(selectedOutcome == null) {
                //     //currentAssessment.Status__c = STATUS_MAPPING;
                // }
                // //continue to next question
                // else {
                //     currentAssessment.Current_Question_Number__c = currentQuestion.QuestionNumber + 1;
                //     //currentAssessment.Current_Question_Id__c = selectedOutcome.Following_Question__c;
                //     nextQuestion = new AssessmentQuestion(selectedOutcome, currentAssessment);
                //     currentAssessment.Current_Question_Number__c = originalNumber;
                // }
            }

            updateAssessment(currentAssessment);
        }
        catch (Exception caughtException) {
            SystemLogger.log(LoggingLevel.ERROR, caughtException, currentQuestion.AssessmentId);
            throw new AuraHandledException(caughtException.getMessage());
        }

        return nextQuestion;
    }

    @AuraEnabled
    public static AssessmentQuestion getPreviousQuestion(String currentQuestionJson){
        // AssessmentQuestion currentQuestion = (AssessmentQuestion)JSON.deserialize(currentQuestionJson, AssessmentQuestion.class);

        // List<SFDC_Industry_Assessment_Question_Branch__mdt> branchOutcomes = industryAssessmentFollowingQuestionBranchMap.get(currentQuestion.QuestionId);

        // Assessment__c currentAssessment = queryAssessment(currentQuestion.AssessmentId);
        // SFDC_Industry_Assessment_Question__mdt previousQuestion;
        // for(SFDC_Industry_Assessment_Question_Branch__mdt outcome : branchOutcomes) {
        //     SFDC_Industry_Assessment_Question__mdt possiblePreviousQuestion = industryAssessmentQuestionMap.get(outcome.Controlling_Question__c);
        //     if(possiblePreviousQuestion != null) {
        //         Schema.DisplayType fieldType = ASSESSMENT_FIELD_SCHEMA.get(Utilities.namespaceUnderscore+possiblePreviousQuestion.Answer_Field_API_Name__c).getDescribe().getType();
        //         Object previousQuestionAnswer = currentAssessment.get(Utilities.namespaceUnderscore+possiblePreviousQuestion.Answer_Field_API_Name__c);
        //         if(outcome.Is_Default_Outcome__c == true || (previousQuestionAnswer != null && ((fieldType == Schema.DisplayType.BOOLEAN && (Boolean)previousQuestionAnswer == Boolean.valueOf(outcome.Controlling_Question_Value__c)) || (previousQuestionAnswer != null && fieldType == Schema.DisplayType.MULTIPICKLIST && new Set<String>(((String)previousQuestionAnswer).split(';')).contains(outcome.Controlling_Question_Value__c)) || (previousQuestionAnswer != null && fieldType == Schema.DisplayType.PICKLIST && (String)previousQuestionAnswer== outcome.Controlling_Question_Value__c)))) {
        //             previousQuestion = possiblePreviousQuestion;
        //             break;
        //         }
        //     }
        // }


        // //Integer originalNumber = currentQuestion.QuestionNumber;
        // currentAssessment.Current_Question_Number__c = currentQuestion.QuestionNumber - 1;
        // //currentAssessment.Current_Question_Id__c = previousQuestion.Id;

        // AssessmentQuestion pastQuestion = new AssessmentQuestion(previousQuestion, currentAssessment);
        // //currentAssessment.Current_Question_Number__c = originalNumber;

        // updateAssessment(currentAssessment);

        return null;
    }

    @AuraEnabled
    public static Boolean setStatus(String assessmentId, String questionId, String index, String mappingIndex, String numberChange) {

        Assessment__c currentAssessment = [SELECT Id, Current_Question_Id__c, Current_Question_Number__c, Status__c
        FROM Assessment__c WHERE Id = :assessmentId];
        if(questionId == 'MAP'){
            currentAssessment.Status__c = STATUS_MAPPING;
        }else{
            String qId = (!String.isBlank(mappingIndex)) ? questionId + '|' + mappingIndex : questionId;
            currentAssessment.Current_Question_Id__c = qId;
            //Set question number if neeeded
            if(numberChange=='next'){
                currentAssessment.Current_Question_Number__c = currentAssessment.Current_Question_Number__c + 1;
            }
            //currentAssessment.Current_Question_Number__c = Integer.valueOf(index);
            currentAssessment.Status__c = STATUS_ASSESSMENT;
        }

        updateAssessment(currentAssessment);

        return true;
    }

    @AuraEnabled
    public static Id getMappingSection(String currentQuestionJson){
        Id mappingSectionId;
        AssessmentQuestion currentQuestion;
        try{
            currentQuestion = (AssessmentQuestion)JSON.deserialize(currentQuestionJson, AssessmentQuestion.class);
        } catch(Exception caughtException) {
            throw new AuraHandledException(caughtException.getMessage());
        }
        if (currentQuestion != null) {
            //Query mapping metadata
            String query = 'SELECT Id, Triggering_Answer__c FROM SFDC_Industry_Mapping_Section__mdt WHERE Controlling_Question__c = \'' + currentQuestion.QuestionId +'\'';

            //Query Custom Metadata Type
            List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
            List<SFDC_Industry_Mapping_Section__mdt> mappingSections = (List<SFDC_Industry_Mapping_Section__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Section__mdt>.class);

            if(!mappingSections.isEmpty()){
                if(!String.isBlank(mappingSections[0].Triggering_Answer__c)){
                    if(currentQuestionJson.contains(ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + mappingSections[0].Triggering_Answer__c))){
                        mappingSectionId = mappingSections[0].Id;
                    }
                }else{
                    mappingSectionId = mappingSections[0].Id;
                }
            }
        }
        return mappingSectionId;
    }

    /**
     * Insert  Assessment__c with Object and FLS security checks
     */
    public static Database.SaveResult insertAssessment(Assessment__c assessment) {
        Database.SaveResult result;
        try {
            // Strip fields that are not creatable and perform object create access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{assessment}, true);
            result = Database.insert(Test.isRunningTest() ? new List<SObject>{assessment} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object create access
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    /**
     * Update Assessment__c with Object and FLS security checks
     */
    public static Database.SaveResult updateAssessment(Assessment__c assessment) {
        Database.SaveResult result;
        try {
            // Strip fields that are not updateable and perform object update access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<SObject>{assessment}, true);
            result = Database.update(Test.isRunningTest() ? new List<SObject>{assessment} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object update access
            SystemLogger.log(LoggingLevel.ERROR, e, assessment.Id);
        }
        return result;
    }

    public static List<Database.SaveResult> updateAssessments(List<Assessment__c> assessments) {
        List<Database.SaveResult> result;
        try {
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, (List<sObject>)assessments, true);
            result = Database.update(Test.isRunningTest() ? (List<sObject>)assessments : decision.getRecords());
        } catch (System.NoAccessException e) {
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    /**
     * Clones a single Assessment__c record
     */
    @AuraEnabled
    public static Id cloneAssessment(Id assessmentId){
        Id clonedId;
        if(assessmentId != null){
            try{
                Assessment__c clone = createCloneAssessment(assessmentId);

                Database.SaveResult createResult = insertAssessment(clone);
                if(createResult?.isSuccess()){
                    clonedId = createResult.getId();
                }
                //Copy Mapping File
                String sourceJSON = MappingService.getMappingJSON(assessmentId);
                if(!String.isBlank(sourceJSON)){
                    FileUtility.writeFileData(clonedId, MappingService.FILENAME_MAPPINGJSON, MappingService.FILEEXTENSION_MAPPINGJSON, sourceJSON);
                }
                GetOrgFieldCountQueueable.createAsyncRequest(clonedId);
            }catch (Exception caughtException) {
                SystemLogger.log(LoggingLevel.ERROR, caughtException, assessmentId);
                throw new AuraHandledException(caughtException.getMessage());
            }
        }
        return clonedId;
    }

    /**
     * Due to being needed the field values for export/import (FSCTA-1628) as well, abstract code below as an independent function.
     */
    private static Assessment__c createCloneAssessment(Id assessmentId){
        // Assessment__c source = (Assessment__c)Security.stripInaccessible(AccessType.READABLE, [
        //     SELECT Id, MappingDataJson__c, Customer_Representation__c, Description__c, External_Data_In_Salesforce__c,
        //         Financial_Accounts_Leveraged__c, Has_Branch_Management__c, HasMappingData__c,
        //         Is_B2C__c, Relationship_Groupings__c, Selected_Products__c 
        //     FROM Assessment__c 
        //     WHERE Id = :assessmentId
        // ], true).getRecords()[0];
        Assessment__c source = queryAssessment(assessmentId);
        Assessment__c clone = source.clone();
        clone.Status__c = STATUS_ASSESSMENT;
        clone.Current_Question_Number__c = 1;
        clone.Current_Question_Id__c = '0';
        clone.AnalysisDataJSON__c = '';
        clone.Sub_Status__c = '';
        clone.Report_Date__c = null;
        clone.AnalysisDataJSON__c = '';
        clone.DeployedPackageJSON__c = '';
        clone.DeploymentDataJSON__c = '';
        clone.ErrorDeployPackagesJSON__c = '';
        clone.ErrorInstallPackagesJSON__c = '';
        clone.PendingDeployPackagesJSON__c = '';
        clone.PendingInstallPackagesJSON__c = '';
        clone.Apex_Sharing_Scan_Complete__c = false;
        clone.Bulk_Scan_Complete__c = false;
        clone.PDF_Generation_Complete__c = false;
        clone.Last_Package_Created_Date__c = null;

        return clone;
    }

    /**
     * Exports data for a single Assessment__c record
     */
    @AuraEnabled
    public static String exportAssessment(Id assessmentId){
        //Get the proper MappingJSON file and, if applicable, concat relevant question responses to export file
        Assessment__c clone = createCloneAssessment(assessmentId);

        //Serialize field values into JSON object
        String fieldJSON = '{';
        Map<String, Schema.SObjectField> fMap = Assessment__c.sObjectType.getDescribe().Fields.getMap();
        
        if (fMap != null){
            for (Schema.SObjectField ft : fMap.values()){ // loop through all field tokens (ft)
                Schema.DescribeFieldResult fd = ft.getDescribe(); // describe each field (fd)
                if (fd.isUpdateable()&&!fd.isUnique()){ // field is creatable
                    if(fd.getLocalName() != 'OwnerId' ){ // exclude ownerid
                        if(fd.getType() == DisplayType.String || fd.getType() == DisplayType.TextArea || fd.getType() == DisplayType.Picklist || fd.getType() == DisplayType.MultiPicklist){
                            String fieldValue = (''+clone.get(fd.getName()) == 'null') ? '' : ''+clone.get(fd.getName()); 
                            if(fieldJSON == '{'){
                                fieldJSON += ( '"' + fd.getName() + '": "' + fieldValue + '"');
                            }else{
                                fieldJSON += ( ', "' + fd.getName() + '": "' + fieldValue + '"');
                            }
                        }else{
                            if(fieldJSON == '{'){
                                fieldJSON += ( '"' + fd.getName() + '": ' + clone.get(fd.getName()) + '');
                            }else{
                                fieldJSON += ( ', "' + fd.getName() + '": ' + clone.get(fd.getName()) + '');
                            }
                        }
                         
                    }  
                }
            }
        }
        fieldJSON += '}';


        //Get existing mapping file (if it exists)
        String sourceJSON = MappingService.getMappingJSON(assessmentId);

        //Combine mapping + field data into export file
        String exportJSON = '{ "mapping":' + sourceJSON + ', "data":' + fieldJSON + ' }';
        String docId = '';
        if(!String.isBlank(sourceJSON)){
            docId = DOWNLOAD_URL_PREFIX + FileUtility.writeFileData(assessmentId, EXPORTED_MAPPING_FILE_NAME, MappingService.FILEEXTENSION_MAPPINGJSON, exportJSON);
        }else{
            docId = 'noMapping';
        }
        return docId;
    }

    /**
     * From a file import, creates a new assessment w/ pre-populated fields + mapping data
     */
    @AuraEnabled
    public static String createAssessmentFromFile(String fileData){
        System.debug('START');
        //Parse into mapping and map w/ field data
        MappingImportFileDef parsedFile = (MappingImportFileDef) JSON.deserialize(fileData, MappingImportFileDef.class);

        //Insert assessment
        Database.SaveResult dmlResult = insertAssessment(parsedFile.data);
        GetOrgFieldCountQueueable.createAsyncRequest(dmlResult.getId());

        //Iterate + Verify Mappings
        parsedFile.mapping = MappingService.verifyMappings(dmlResult.getId(), parsedFile.mapping);

        //Create Mapping File
        MappingService.saveMapping(dmlResult.getId(), MappingService.FILENAME_MAPPINGJSON, MappingService.FILEEXTENSION_MAPPINGJSON, JSON.serialize(parsedFile.mapping), false);

        return dmlResult.getId();
    }

    /**
     * Retrieves the "missing metadata" list for any objects, fields or record types that got cleared out when verifying mappings
     */
    @AuraEnabled
    public static Id getMissingMetadataFile(Id assessmentId){
        return FileUtility.getContentDocumentIdByName(assessmentId, MappingService.IMPORT_MISSING_FILE_NAME);
    }

    /**
     * Query Assessment Record by ID
     * select all accessible fields
     */
    public static Assessment__c queryAssessment(Id assessmentId) {
        Assessment__c assessment;
        if (assessmentId != null) {
            //determine all accessible fields to query
            Set<String> fieldNames = new Set<String>();
            for(Schema.SObjectField field : ASSESSMENT_FIELD_SCHEMA.values()) {
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                if(fieldDescribe.isAccessible() || Test.isRunningTest()) {
                    fieldNames.add(fieldDescribe.getName());
                }
                //Add CreatedBy Name
                fieldNames.add('CreatedBy.Name');
            }
            //query
            assessment = queryAssessment(assessmentId, fieldNames, false);
        }
        return assessment;
    }

    /**
     * Query Assessment Record by ID
     * select specific fields
     */
    public static Assessment__c queryAssessment(Id assessmentId, Set<String> fieldApiNames) {
        return queryAssessment(assessmentId, fieldApiNames, true);
    }

    /**
     * Query Assessment Record by ID
     * Select specific fields
     * Strip inaccessible fields if field access check already not performed
     */
    private static Assessment__c queryAssessment(Id assessmentId, Set<String> fieldApiNames, Boolean stripInaccessible) {
        Assessment__c assessment;

        if (assessmentId != null && fieldApiNames != null && (Schema.SObjectType.Assessment__c.isAccessible() || Test.isRunningTest())) {
            String dynamicQuery = 'SELECT {0} FROM ' + Utilities.namespaceUnderscore + 'Assessment__c WHERE Id = :assessmentId';
            List<Assessment__c> assessmentList = Database.query(String.format(dynamicQuery, new List<String>{
                String.join(new List<String>(fieldApiNames), ', ')
            }));

            if (stripInaccessible && !Test.isRunningTest()) {
                assessmentList = (List<Assessment__c>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, assessmentList, false));
            }

            if (!assessmentList.isEmpty()) {
                assessment = assessmentList[0];
            }
        }

        return assessment;
    }
    
     @AuraEnabled
    public static Boolean getVehicleRecord(string assessmentId){
        Assessment__c currentAssessment = queryAssessment(assessmentId);
        if(currentAssessment.Vehicle_Selected__c){
            return true;
        }
        else{
            return false;
        }
    }

    @AuraEnabled
    public static void updateAssessmentDescription(List<Id> assessmentIds, List<String> descriptions) {
        if(assessmentIds == null || assessmentIds.isEmpty() || descriptions == null || descriptions.isEmpty()) return;

        List<Assessment__c> assessmentsToUpdate = new List<Assessment__c>();
        for(Integer i = 0; i < assessmentIds.size(); i++) {
            assessmentsToUpdate.add(new Assessment__c(
                Id =  assessmentIds[i],
                Description__c = descriptions[i]
            ));
        }
        updateAssessments(assessmentsToUpdate);
    }

    @TestVisible
    static Set<String> evaluateExcludes(SFDC_Industry_Assessment_Question__mdt question, Assessment__c currentAssessment) {

        List<SFDC_Industry_Assessment_Exclude__mdt> excludeList = industryAssessmentQuestionExcludeMap.get(question.Id);
        if(excludeList == null) return new Set<String>();

        Set<String> excludeValues = new Set<String>();
        for(SFDC_Industry_Assessment_Exclude__mdt exclude : excludeList) {
            String namespacedControllingField = Utilities.namespaceUnderscore + exclude.Controlling_Field__c;
            String dataType = ASSESSMENT_FIELD_SCHEMA.get(namespacedControllingField).getDescribe().getType().name();

            if(currentAssessment.get(namespacedControllingField) != null && (
                (dataType == Schema.DisplayType.PICKLIST.name() && currentAssessment.get(namespacedControllingField) == exclude.Controlling_Value__c) ||
                (dataType == Schema.DisplayType.MULTIPICKLIST.name() && new Set<String>(((String)currentAssessment.get(namespacedControllingField)).split(';')) == new Set<String>(exclude.Controlling_Value__c.split(';'))) ||
                (dataType == Schema.DisplayType.BOOLEAN.name() && currentAssessment.get(namespacedControllingField) == Boolean.valueOf(exclude.Controlling_Value__c))
            )) {
                excludeValues.add(exclude.Exclude_Value__c);
            }
        }
        
        return excludeValues;
    }

    @AuraEnabled
    public static void deleteAssessment(Id assessmentId) {
        if(Schema.SObjectType.Assessment__c.isDeletable() == false || assessmentId == null) return;

        delete new Assessment__c(Id = assessmentId);
    }
    
    @AuraEnabled
    public static void deleteAssessments(List<Id> assessmentIds) {
        if(Schema.SObjectType.Assessment__c.isDeletable() == false || assessmentIds == null || assessmentIds.isEmpty() == true) return;

        List<Assessment__c> assessmentsToDelete = new List<Assessment__c>();
        for(Id assessmentId : assessmentIds) {
            assessmentsToDelete.add(new Assessment__c(Id = assessmentId));
        }
        delete assessmentsToDelete;
    }

    public class VerticalInfo {
        @AuraEnabled
        public Id VerticalId {get;set;}
        @AuraEnabled
        public Id IndustryId {get;set;}
        @AuraEnabled
        public String Name {get;set;}
        @AuraEnabled
        public String Icon {get;set;}
        @AuraEnabled
        public String Description {get;set;}
        @AuraEnabled
        public String Field {get;set;}
        @AuraEnabled
        public String Value {get;set;}
        @AuraEnabled
        public Boolean VerticalSelected{get;set;}

        public VerticalInfo() {}

        public VerticalInfo(SFDC_Industry_Vertical__mdt vertical) {
            this.VerticalId = vertical.Id;
            this.IndustryId = vertical.Industry__c;
            this.Name = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + vertical.Display_Label__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + vertical.Display_Label__c);
            this.Icon = vertical.Icon_Name__c;
            this.Description = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + vertical.Description_Label__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + vertical.Description_Label__c);
            this.Field = vertical.Field__c;
            this.Value = vertical.Value__c;
            this.VerticalSelected = false;
        }
    }


    public class AssessmentInfo {
        @AuraEnabled
        public Id AssessmentId {get;set;}
        @AuraEnabled
        public String Name {get;set;}
        @AuraEnabled
        public String Status {get;set;}
        @AuraEnabled
        public Datetime CreatedDate {get;set;}
        @AuraEnabled
        public String Description {get;set;}
        @AuraEnabled
        public Boolean InProgress {get;set;}
        @AuraEnabled
        public Boolean AssessmentCpuWarning {get;set;}
        @AuraEnabled
        public Boolean Editable {get;set;}
        @AuraEnabled
        public String CreatedByLink {get;set;}
        @AuraEnabled
        public String CreatedByName {get;set;}
        @AuraEnabled
        public String LastModifiedByLink {get;set;}
        @AuraEnabled
        public String LastModifiedByName {get;set;}

        public AssessmentInfo() {}

        public AssessmentInfo(Assessment__c assessment) {
            this.AssessmentId = assessment.Id;
            this.Name = assessment.Name;
            this.Status = assessment.Status__c;
            this.CreatedDate = assessment.CreatedDate;
            this.Description = assessment.Description__c;
            this.InProgress = assessment.Status__c != STATUS_REVIEW && assessment.Status__c != STATUS_SCANNING;
            this.AssessmentCpuWarning = assessment.Timeout_Warning_Indicator__c;
            this.Editable = false;
            this.CreatedByLink = '/'+assessment.CreatedById;
            this.CreatedByName = assessment.CreatedBy.Name;
            this.LastModifiedByLink = '/'+assessment.LastModifiedById;
            this.LastModifiedByName = assessment.LastModifiedBy.Name;
        }
    }

    public class AssessmentQuestion {
        @AuraEnabled
        public String AssessmentId {get;set;}

        @AuraEnabled
        public String QuestionId {get;set;}

        @AuraEnabled
        public String CurrentMappingIndex {get;set;}

        @AuraEnabled
        public Integer QuestionNumber {get; set;}

        @AuraEnabled
        public String QuestionText {get; set;}

        @AuraEnabled
        public String AnswerFieldAPIName {get; set;}

        @AuraEnabled
        public String AnswerDataType {get; set;}

        @AuraEnabled
        public List<Schema.PicklistEntry> AnswerValues {get; set;}

        @AuraEnabled
        public String SelectedAnswer {get; set;}

        @AuraEnabled
        public List<String> SelectedAnswers {get; set;}

        @AuraEnabled
        public Boolean SelectedCheckbox {get; set;}

        @AuraEnabled
        public Boolean AnsweredQuestion {get; set;}

        @AuraEnabled
        public Boolean IsPicklist {get; set;}

        @AuraEnabled
        public Boolean IsMultiSelect {get; set;}

        @AuraEnabled
        public Boolean IsCheckBox {get; set;}

        @AuraEnabled
        public Boolean IsRequired {get; set;}

        @AuraEnabled
        public Boolean HasError {get; set;}

        @AuraEnabled
        public String ErrorMessage {get; set;}

        @AuraEnabled
        public Set<String> ExcludeOptions {get; set;}

        public AssessmentQuestion(SFDC_Industry_Assessment_Question__mdt questionTemplate, Integer questionNumber) {
            this.QuestionId = questionTemplate.Id;
            this.QuestionNumber = questionNumber;
            this.AnswerFieldAPIName =  Utilities.namespaceUnderscore + questionTemplate.Answer_Field_API_Name__c;
            this.AnswerDataType = ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getType().name();
            this.SelectedAnswers = new List<String>();
            this.ExcludeOptions = new Set<String>();
            this.IsRequired = questionTemplate.Question_Required__c;
            this.QuestionText = String.format(
                ASSESSMENT_QUESTION_TEMPLATE,
                new List<Object>{
                    this.QuestionNumber,
                    ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c)
            });

            if(this.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                this.SelectedAnswer = (String)ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getDefaultValue() == null ? '' : (String)ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getDefaultValue();
                this.IsPicklist = true;
            }
            else if(this.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                this.SelectedAnswer = (String)ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getDefaultValue() == null ? '' : (String)ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getDefaultValue();
                this.IsMultiSelect = true;
            }
            else if(this.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                this.SelectedCheckbox = (Boolean)ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getDefaultValue();
                this.IsCheckBox = true;

            }

            if(questionTemplate.Answer_Field_API_Name__c == HAS_PERSON_ACCOUNTS_ASSESSMENT_FIELD && Schema.sObjectType.Account.fields.getMap().containsKey('isPersonAccount') == true) {
                this.SelectedAnswer = HAS_PERSON_ACCOUNTS_ASSESSMENT_VALUE;
            }
        }

        public AssessmentQuestion(SFDC_Industry_Assessment_Question__mdt questionTemplate, Assessment__c currentAssessment) {
            this.AssessmentId = currentAssessment.Id;
            this.QuestionId = questionTemplate.Id;
            this.CurrentMappingIndex = (currentAssessment.Current_Question_Id__c != null && currentAssessment.Current_Question_Id__c.contains('|'))
            ? currentAssessment.Current_Question_Id__c.split('\\|')[1] : '';
            this.QuestionNumber = (Integer)currentAssessment.Current_Question_Number__c;
            this.AnswerFieldAPIName =  Utilities.namespaceUnderscore + questionTemplate.Answer_Field_API_Name__c;
            this.AnswerDataType = ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getType().name();
            this.SelectedAnswers = new List<String>();
            this.ExcludeOptions = new Set<String>();
            this.IsRequired = questionTemplate.Question_Required__c;
            this.QuestionText = String.format(
                ASSESSMENT_QUESTION_TEMPLATE,
                new List<Object>{
                    this.QuestionNumber,
                    ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c)
            });

            if(this.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                this.SelectedAnswer = (String)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedAnswer != null;
                this.IsPicklist = true;
                this.ExcludeOptions = evaluateExcludes(questionTemplate, currentAssessment);
            }
            else if(this.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                this.SelectedAnswer = (String)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedAnswer != null;
                this.SelectedAnswers = this.SelectedAnswer == null ? new List<String>() : this.SelectedAnswer.split(';');
                this.IsMultiSelect = true;
                this.ExcludeOptions = evaluateExcludes(questionTemplate, currentAssessment);
            }
            else if(this.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                this.SelectedCheckbox = (Boolean)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedCheckbox != null;
                this.IsCheckBox = true;
            }
        }

        public AssessmentQuestion(SFDC_Industry_Assessment_Question_Branch__mdt questionBranch, Assessment__c currentAssessment) {
            SFDC_Industry_Assessment_Question__mdt questionTemplate = industryAssessmentQuestionMap.get(questionBranch.Following_Question__c);
            this.AssessmentId = currentAssessment.Id;
            this.QuestionId = questionTemplate.Id;
            this.QuestionNumber = (Integer)currentAssessment.Current_Question_Number__c;
            this.AnswerFieldAPIName =  Utilities.namespaceUnderscore + questionTemplate.Answer_Field_API_Name__c;
            this.AnswerDataType = ASSESSMENT_FIELD_SCHEMA.get(this.AnswerFieldAPIName).getDescribe().getType().name();
            this.SelectedAnswers = new List<String>();
            this.ExcludeOptions = new Set<String>();
            this.IsRequired = questionTemplate.Question_Required__c;
            this.QuestionText = String.format(
                ASSESSMENT_QUESTION_TEMPLATE,
                new List<Object>{
                    this.QuestionNumber,
                    ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionTemplate.Question_Label_Name__c)
            });

            if(this.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                this.SelectedAnswer = (String)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedAnswer != null;
                this.IsPicklist = true;
                this.ExcludeOptions = evaluateExcludes(questionTemplate, currentAssessment);
            }
            else if(this.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                this.SelectedAnswer = (String)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedAnswer != null;
                this.SelectedAnswers = this.SelectedAnswer == null ? new List<String>() : this.SelectedAnswer.split(';');
                this.IsMultiSelect = true;
                this.ExcludeOptions = evaluateExcludes(questionTemplate, currentAssessment);
            }
            else if(this.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                this.SelectedCheckbox = (Boolean)currentAssessment.get(this.AnswerFieldAPIName);
                this.AnsweredQuestion = this.SelectedCheckbox != null;
                this.IsCheckBox = true;
            }
        }

        public AssessmentQuestion() {}
    }

    public class MappingImportFileDef {
        public MappingService.UpgradeMapping mapping;
        public Assessment__c data;
    }
}