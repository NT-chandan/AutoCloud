/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class AssessmentServiceTest {
    static Integer RECORD_COUNT = Limits.getLimitQueries() + 1;
    static final Id INVALID_ID = Schema.SObjectType.Assessment__c.getKeyPrefix() + '4x000002xEIYAA2';
    static final Id DUMMY_METADATA_ID = Schema.SObjectType.SFDC_Industry_Assessment_Question__mdt.getKeyPrefix() + '4x000000lrM8AAI';
    static final Id CONTROLLING_QUESTION_ID = Schema.SObjectType.SFDC_Industry_Assessment_Question__mdt.getKeyPrefix() + '4x000000lvLDAAY';
    static final String EXPECTED_VALUE = 'New';
    static final String TEST_LABEL = 'testLabel';
    static final String TEST_MESSAGE = 'Test message';
    static final String FIELD_BOOLEAN = 'Bulk_Scan_Complete__c';
    static final String FIELD_PICKLIST = 'Status__c';
    static final String FIELD_MULTISELECT = 'Selected_Products__c';
    static final String VALUE_BOOLEAN = 'TRUE';
    static final String VALUE_PICKLIST = 'New';
    static final String VALUE_MULTISELECT = 'AC OEMs';

    //static final String CONTROLLING_API_NAME = 'Status__c';
    //static final String API_NAME = 'Status__c';

    private static final String RES_SECTION = '[[]]';

    @IsTest
    static void industryMap_MetadataPopulated(){
        
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_INDUSTRY_MAP,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
        
        Test.startTest();
            Map<Id, SFDC_Industry__mdt> industryMap = AssessmentService.industryMap;
        Test.stopTest();

        System.assertNotEquals(null, industryMap, 'industryMap should not be null');
        System.assertNotEquals(new Set<Id>(), industryMap.keySet(), 'SFDC_Industry__mdt should have values populated');
    }

    @IsTest
    static void industryVerticalMap_MetadataPopulated(){

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_INDUSTRY_VERTICAL_MAP,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
        
        Test.startTest();
            Map<String, List<SFDC_Industry_Vertical__mdt>> industryVerticalMap = AssessmentService.industryVerticalMap;
        Test.stopTest();

        System.assertNotEquals(null, industryVerticalMap, 'industryVerticalMap should not be null');
        System.assertNotEquals(
            new Set<String>(), 
            industryVerticalMap.keySet(), 
            'SFDC_Industry_Vertical__mdt should have values populated'
        );
    }

    @IsTest
    static void industryAssessmentQuestionList_MetadataPopulated(){

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_QUESTION_LIST,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
    
        Test.startTest();
            List<SFDC_Industry_Assessment_Question__mdt> questionList = AssessmentService.industryAssessmentQuestionList;
        Test.stopTest();

        System.assertNotEquals(null, questionList, 'industryAssessmentQuestionList should not be null');
        System.assertNotEquals(
            0, 
            questionList.size(),
            'SFDC_Industry_Assessment_Question__mdt should have values populated'
        );
    }

    @IsTest
    static void industryAssessmentQuestionMap_MetadataPopulated(){
        
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_QUESTION_LIST,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
        
        Test.startTest();
            Map<Id, SFDC_Industry_Assessment_Question__mdt> industryAssessmentQuestionMap = AssessmentService.industryAssessmentQuestionMap;
        Test.stopTest();

        System.assertNotEquals(null, industryAssessmentQuestionMap, 'industryAssessmentQuestionMap should not be null');
        System.assertNotEquals(
            new Set<Id>(), 
            industryAssessmentQuestionMap.keySet(),
            'SFDC_Industry_Assessment_Question__mdt should have values populated'
        );
    }

    @IsTest
    static void industryAssessmentQuestionBranchList_MetadataPopulated(){

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_BRANCH_LIST,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
    
        Test.startTest();
            List<SFDC_Industry_Assessment_Question_Branch__mdt> branchList = AssessmentService.industryAssessmentQuestionBranchList;
        Test.stopTest();

        System.assertNotEquals(null, branchList, 'industryAssessmentQuestionBranchList should not be null');
        // System.assertNotEquals(
        //     0, 
        //     branchList.size(),
        //     'SFDC_Industry_Assessment_Question_Branch__mdt should have values populated'
        // );
    }

    @IsTest
    static void industryAssessmentControllingQuestionBranchMap_MetadataPopulated(){

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_BRANCH_LIST,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
    
        Test.startTest();
            Map<Id, List<SFDC_Industry_Assessment_Question_Branch__mdt>> branchMap = AssessmentService.industryAssessmentControllingQuestionBranchMap;
        Test.stopTest();

        System.assertNotEquals(null, branchMap, 'industryAssessmentControllingQuestionBranchMap should not be null');
        // System.assertNotEquals(
        //     new Set<Id>(), 
        //     branchMap.keySet(),
        //     'SFDC_Industry_Assessment_Question_Branch__mdt should have values populated'
        // );
    }

    @IsTest
    static void industryAssessmentFollowingQuestionBranchMap_MetadataPopulated(){

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_BRANCH_LIST,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
    
        Test.startTest();
            Map<Id, List<SFDC_Industry_Assessment_Question_Branch__mdt>> branchMap = AssessmentService.industryAssessmentFollowingQuestionBranchMap;
        Test.stopTest();

        System.assertNotEquals(null, branchMap, 'industryAssessmentFollowingQuestionBranchMap should not be null');
        // System.assertNotEquals(
        //     new Set<Id>(), 
        //     branchMap.keySet(),
        //     'SFDC_Industry_Assessment_Question_Branch__mdt should have values populated'
        // );
    }
    
    @IsTest
    static void getOrgVerticals_VerticalsReturned(){
        ToolingService.customLabelMap = new Map<String, String>{
            TEST_LABEL => TEST_MESSAGE
        };
        //List<String> industryList = new List<String>(AssessmentService.industryVerticalMap.keySet());
        List<List<Object>> metaRecords = new List<List<Object>>();
        List<Object> listOfLists = (List<Object>) JSON.deserializeUntyped(MockCalloutDefinitions.RES_INDUSTRY_VERTICAL_MAP);

        for (Object topList : listOfLists) {
            metaRecords.add((List<Object>) topList);
        }

        List<SFDC_Industry_Vertical__mdt> industryMeta = (List<SFDC_Industry_Vertical__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Vertical__mdt>.class);
        
        Map<String, List<SFDC_Industry_Vertical__mdt>> industryVerticalMap = Utilities.groupByStrings('Industry__r.DeveloperName', industryMeta);

        List<String> industryList = new List<String>(industryVerticalMap.keySet());

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_INDUSTRY_VERTICAL_MAP,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);
        
        Test.startTest();
            List<AssessmentService.VerticalInfo> verticalList = AssessmentService.getOrgVerticals(industryList[0]);
        Test.stopTest();

        System.assertEquals(
            AssessmentService.industryVerticalMap.get(industryList[0]).size(),
            verticalList.size(), 
            'All verticals should be returned for the requested industry'
        );
        
    }

    @IsTest
    static void getOrgAssessments_RecordsReturned(){
        List<Assessment__c> setupAssessments = new List<Assessment__c>();
        for(Integer i = 0; i < RECORD_COUNT; i++) {
            setupAssessments.add(new Assessment__c());
        }
        insert setupAssessments;

        Test.startTest();
            List<AssessmentService.AssessmentInfo> returnedAssessments = AssessmentService.getOrgAssessments();
        Test.stopTest();

        System.assertEquals(
            RECORD_COUNT, 
            returnedAssessments.size(), 
            'All created Assessments should be returned'
        );
    }

    @IsTest
    static void getCurrentAssessmentQuestion_QuestionReturned(){
        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_QUESTION_LIST, '{}' }));

        ToolingService.customLabelMap = new Map<String, String>{
            TEST_LABEL => TEST_MESSAGE
        };
        Assessment__c setupAssessment = new Assessment__c(
            Current_Question_Id__c = AssessmentService.industryAssessmentQuestionList[0].Id
        );
        insert setupAssessment;


        Test.startTest();
            String result = AssessmentService.getCurrentAssessmentQuestion(setupAssessment.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'An AssessmentQuestion should be returned');
        // System.assertEquals(
        //     AssessmentService.industryAssessmentQuestionList[0].Id, 
        //     result.QuestionId,
        //     'The returned question should contain info related to the current question'
        // );
    }

    @IsTest
    static void getStartingQuestion_StartingQuestionReturned(){
        ToolingService.customLabelMap = new Map<String, String>{
            TEST_LABEL => TEST_MESSAGE
        };

        List<SFDC_Industry_Vertical__mdt> verticalList = [
            SELECT DeveloperName, MasterLabel, Industry__r.DeveloperName, Industry__c, Display_Label__c,
                Icon_Name__c, Description_Label__c, Field__c, Value__c
            FROM SFDC_Industry_Vertical__mdt
        ];

        List<AssessmentService.VerticalInfo> setupVerticals = new List<AssessmentService.VerticalInfo>();
        for(SFDC_Industry_Vertical__mdt vertical : verticalList) {
            AssessmentService.VerticalInfo setupVertical = new AssessmentService.VerticalInfo(vertical);
            setupVertical.VerticalSelected = true;
            setupVerticals.add(setupVertical);
        }
        
        Test.startTest();
            Id result = AssessmentService.getStartingQuestion(setupVerticals);
        Test.stopTest();

        System.assertNotEquals(null, result, 'An AssessmentQuestion should be returned');
        System.assertEquals(1, [SELECT Id FROM Assessment__c].size(), 'A single Assessment should be created');
    }

    @IsTest
    static void saveQuestion_AssessmentUpdated(){
        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_QUESTION_LIST, MockCalloutDefinitions.RES_BRANCH_LIST, '{}' }));

        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;
    
        AuraHandledException exceptionResult;
        Test.startTest();
            try {
                SFDC_Industry_Assessment_Question__mdt question = AssessmentService.industryAssessmentQuestionList[0];

                AssessmentService.AssessmentQuestion setupAnswer = new AssessmentService.AssessmentQuestion();
                setupAnswer.AssessmentId = setupAssessment.Id;
                setupAnswer.AnswerFieldAPIName = Utilities.namespaceUnderscore+question.Answer_Field_API_Name__c;
                setupAnswer.AnswerDataType = AssessmentService.ASSESSMENT_FIELD_SCHEMA.get(setupAnswer.AnswerFieldAPIName).getDescribe().getType().name();
                if(setupAnswer.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                    setupAnswer.IsPicklist = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                    setupAnswer.IsMultiSelect = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                    setupAnswer.IsCheckBox = true;
                    setupAnswer.SelectedCheckbox = false;
                }

                AssessmentService.saveQuestion(JSON.serialize(setupAnswer));
            } 
            catch (AuraHandledException caughtException) {
                exceptionResult = caughtException;
            }
        Test.stopTest();
        
        System.assertEquals(null, exceptionResult, 'An exception should not be thrown');

        List<Assessment__c> queriedAssessments = [SELECT Id FROM Assessment__c];

        System.assertEquals(1, queriedAssessments.size(), 'A single Assessment should be present');
    }

    @IsTest
    static void saveQuestion_ExceptionThrown(){
        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_QUESTION_LIST, MockCalloutDefinitions.RES_BRANCH_LIST, '{}' }));

        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;
    
        AuraHandledException exceptionResult;
        Test.startTest();
            try {
                SFDC_Industry_Assessment_Question__mdt question = AssessmentService.industryAssessmentQuestionList[0];

                AssessmentService.AssessmentQuestion setupAnswer = new AssessmentService.AssessmentQuestion();
                setupAnswer.AnswerFieldAPIName = Utilities.namespaceUnderscore+question.Answer_Field_API_Name__c;
                setupAnswer.AnswerDataType = AssessmentService.ASSESSMENT_FIELD_SCHEMA.get(setupAnswer.AnswerFieldAPIName).getDescribe().getType().name();
                if(setupAnswer.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                    setupAnswer.IsPicklist = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                    setupAnswer.IsMultiSelect = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                    setupAnswer.IsCheckBox = true;
                    setupAnswer.SelectedCheckbox = false;
                }

                AssessmentService.saveQuestion(JSON.serialize(setupAnswer));
            } 
            catch (AuraHandledException caughtException) {
                exceptionResult = caughtException;
            }
        Test.stopTest();
        
        System.assertNotEquals(null, exceptionResult, 'An AuraHandledException should  be thrown');
    }


    @IsTest
    static void setStatus_StatusSet(){
        Assessment__c setupAssessment = new Assessment__c(Current_Question_Number__c = 1);
        insert setupAssessment;

        SFDC_Industry_Assessment_Question__mdt question = [
            SELECT Id FROM SFDC_Industry_Assessment_Question__mdt LIMIT 1];
        
        Test.startTest();
            Boolean statusSet = AssessmentService.setStatus(setupAssessment.Id, question.Id, '0', '0', 'next');
            Boolean mapStatusSet = AssessmentService.setStatus(setupAssessment.Id, 'MAP', '', '', '');
        Test.stopTest();

        System.assertNotEquals(false, statusSet, '"True" should be returned');
        System.assertNotEquals(false, mapStatusSet, '"True" should be returned');
    }

    @IsTest
    static void queryAssessment_AssessmentReturned(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;
        
        Test.startTest();
            Assessment__c result = AssessmentService.queryAssessment(setupAssessment.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'An Assessment should be returned');
        System.assertEquals(setupAssessment.Id, result.Id, 'The returned assessment should match the given Id');
    }

    @IsTest
    static void getMappingSection_MappingReturned(){

        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_QUESTION_LIST, RES_SECTION, '{}' }));
    
        AuraHandledException exceptionResult;
        Id sectionId;
        Test.startTest();
            try {
                SFDC_Industry_Assessment_Question__mdt question = AssessmentService.industryAssessmentQuestionList[0];

                AssessmentService.AssessmentQuestion setupAnswer = new AssessmentService.AssessmentQuestion();
                setupAnswer.AssessmentId = setupAssessment.Id;
                setupAnswer.AnswerFieldAPIName = Utilities.namespaceUnderscore+question.Answer_Field_API_Name__c;
                setupAnswer.AnswerDataType = AssessmentService.ASSESSMENT_FIELD_SCHEMA.get(setupAnswer.AnswerFieldAPIName).getDescribe().getType().name();
                if(setupAnswer.AnswerDataType == Schema.DisplayType.PICKLIST.name()) {
                    setupAnswer.IsPicklist = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.MULTIPICKLIST.name()) {
                    setupAnswer.IsMultiSelect = true;
                    setupAnswer.SelectedAnswer = null;
                }
                else if(setupAnswer.AnswerDataType == Schema.DisplayType.BOOLEAN.name()) {
                    setupAnswer.IsCheckBox = true;
                    setupAnswer.SelectedCheckbox = false;
                }

                sectionId = AssessmentService.getMappingSection(JSON.serialize(setupAnswer));
            } 
            catch (AuraHandledException caughtException) {
                exceptionResult = caughtException;
            }
        Test.stopTest();
        
        System.assertEquals(null, sectionId, 'sectionId should be null');
    }

    @IsTest
    static void evaluateExcludes_NoExcludesPresent(){
        AssessmentService.industryAssessmentQuestionExcludeMap = new Map<Id, List<SFDC_Industry_Assessment_Exclude__mdt>>();

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt();
        Assessment__c setupAssessment = new Assessment__c();

        Test.startTest();
            Set<String> result = AssessmentService.evaluateExcludes(setupQuestion, setupAssessment);
        Test.stopTest();
        
        System.assertEquals(new Set<String>(), result, 'An empty set should be returned when no excludes are found');
    }

    @IsTest
    static void evaluateExcludes_PicklistValueMatch(){
        AssessmentService.industryAssessmentQuestionExcludeMap = new Map<Id, List<SFDC_Industry_Assessment_Exclude__mdt>>();
        AssessmentService.industryAssessmentQuestionExcludeMap.put(null, new List<SFDC_Industry_Assessment_Exclude__mdt>{
            new SFDC_Industry_Assessment_Exclude__mdt(
                Controlling_Field__c = FIELD_PICKLIST,
                Controlling_Value__c = VALUE_PICKLIST,
                Exclude_Value__c = EXPECTED_VALUE
            )
        });

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt();
        Assessment__c setupAssessment = new Assessment__c();
        setupAssessment.put(Utilities.namespaceUnderscore+FIELD_PICKLIST, VALUE_PICKLIST);

        Test.startTest();
            Set<String> result = AssessmentService.evaluateExcludes(setupQuestion, setupAssessment);
        Test.stopTest();
        
        System.assertEquals(new Set<String>{EXPECTED_VALUE}, result, 'A set containing the expected value should be returned');
    }

    @IsTest
    static void evaluateExcludes_MultiselectValueMatch(){
        AssessmentService.industryAssessmentQuestionExcludeMap = new Map<Id, List<SFDC_Industry_Assessment_Exclude__mdt>>();
        AssessmentService.industryAssessmentQuestionExcludeMap.put(null, new List<SFDC_Industry_Assessment_Exclude__mdt>{
            new SFDC_Industry_Assessment_Exclude__mdt(
                Controlling_Field__c = FIELD_MULTISELECT,
                Controlling_Value__c = VALUE_MULTISELECT,
                Exclude_Value__c = EXPECTED_VALUE
            )
        });

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt();
        Assessment__c setupAssessment = new Assessment__c();
        setupAssessment.put(Utilities.namespaceUnderscore+FIELD_MULTISELECT, VALUE_MULTISELECT);

        Test.startTest();
            Set<String> result = AssessmentService.evaluateExcludes(setupQuestion, setupAssessment);
        Test.stopTest();
        
        System.assertEquals(new Set<String>{EXPECTED_VALUE}, result, 'A set containing the expected value should be returned');
    }

    @IsTest
    static void evaluateExcludes_BooleanValueMatch(){
        AssessmentService.industryAssessmentQuestionExcludeMap = new Map<Id, List<SFDC_Industry_Assessment_Exclude__mdt>>();
        AssessmentService.industryAssessmentQuestionExcludeMap.put(null, new List<SFDC_Industry_Assessment_Exclude__mdt>{
            new SFDC_Industry_Assessment_Exclude__mdt(
                Controlling_Field__c = FIELD_BOOLEAN,
                Controlling_Value__c = VALUE_BOOLEAN,
                Exclude_Value__c = EXPECTED_VALUE
            )
        });

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt();
        Assessment__c setupAssessment = new Assessment__c();
        setupAssessment.put(Utilities.namespaceUnderscore+FIELD_BOOLEAN, Boolean.valueOf(VALUE_BOOLEAN));

        Test.startTest();
            Set<String> result = AssessmentService.evaluateExcludes(setupQuestion, setupAssessment);
        Test.stopTest();
        
        System.assertEquals(new Set<String>{EXPECTED_VALUE}, result, 'A set containing the expected value should be returned');
    }

    @IsTest
    static void updateAssessmentDescription_DescriptionUpdated(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;
        
        Test.startTest();
            AssessmentService.updateAssessmentDescription(new List<Id>{setupAssessment.Id}, new List<String>{EXPECTED_VALUE});
        Test.stopTest();
        
        Assessment__c updatedAssessment = [
            SELECT Description__c
            FROM Assessment__c
            WHERE Id =: setupAssessment.Id
        ];

        System.assertEquals(EXPECTED_VALUE, updatedAssessment.Description__c, 'Description should be updated to its expected value');
    }


    @IsTest
    static void deleteAssessment_AssessmentDeleted(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.startTest();
            AssessmentService.deleteAssessment(setupAssessment.Id);
        Test.stopTest();
        
        System.assertEquals(0, [SELECT Id FROM Assessment__c WHERE Id =: setupAssessment.Id].size(), 'The setup assessment should be deleted');
    }


    @IsTest
    static void deleteAssessmenta_AssessmentsDeleted(){
        List<Assessment__c> setupAssessments = new List<Assessment__c>();
        for(Integer i = 0; i < RECORD_COUNT; i++) {
            setupAssessments.add(new Assessment__c());
        }
        insert setupAssessments;

        Set<Id> setupAssessmentIds = Utilities.pluckIds(setupAssessments);
        Test.startTest();
            AssessmentService.deleteAssessments(new List<Id>(setupAssessmentIds));
        Test.stopTest();
        
        System.assertEquals(0, [SELECT Id FROM Assessment__c WHERE Id IN: setupAssessmentIds].size(), 'The setup assessments should be deleted');
    }

    @IsTest
    static void cloneAssessment_assessmentCloned(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;


        Test.startTest();
            Id result = AssessmentService.cloneAssessment(setupAssessment.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'An id should be returned');
        System.assertNotEquals(setupAssessment.Id, result, 'The id of the cloned assessment should be different from the given assessment');
        
        List<Assessment__c> queriedAssessment = [
            SELECT Status__c, Current_Question_Number__c
            FROM Assessment__c
            WHERE Id =: result
        ];

        System.assertEquals(1, queriedAssessment.size(), 'A single assessment should be present');
        System.assertEquals(1, queriedAssessment[0].Current_Question_Number__c, 'The assessment should be set to the first question');
        System.assertEquals(AssessmentService.STATUS_ASSESSMENT, queriedAssessment[0].Status__c, 'The status of the assessment should be set to its expected value');

    }

    @IsTest
    static void AssessmentQuestionTemplateConstructor_PicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_EXCLUDE_LIST }));

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_PICKLIST
        );

        AssessmentService.industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt> {
            null => setupQuestion
        };

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.PICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionTemplateConstructor_MultiSelectPicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_MULTISELECT
        );

        ToolingService.customLabelMap = new Map<String, String>();

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_EXCLUDE_LIST }));

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.MULTIPICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionTemplateConstructor_BooleanPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_EXCLUDE_LIST }));

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_BOOLEAN
        );

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.BOOLEAN.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionBranchConstructor_PicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_EXCLUDE_LIST }));

        SFDC_Industry_Assessment_Question_Branch__mdt setupBranch = new SFDC_Industry_Assessment_Question_Branch__mdt();

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_PICKLIST
        );

        AssessmentService.industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt> {
            null => setupQuestion
        };

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupBranch, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.PICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionBranchConstructor_MultiSelectPicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        Test.setMock(HttpCalloutMock.class, MockCalloutDefinitions.createMockWithResponseList(new List<String>{ MockCalloutDefinitions.RES_EXCLUDE_LIST }));

        SFDC_Industry_Assessment_Question_Branch__mdt setupBranch = new SFDC_Industry_Assessment_Question_Branch__mdt();

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_MULTISELECT
        );

        AssessmentService.industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt> {
            null => setupQuestion
        };

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupBranch, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.MULTIPICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionBranchConstructor_BooleanPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        SFDC_Industry_Assessment_Question_Branch__mdt setupBranch = new SFDC_Industry_Assessment_Question_Branch__mdt();

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_BOOLEAN
        );

        AssessmentService.industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt> {
            null => setupQuestion
        };

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupBranch, setupAssessment);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.BOOLEAN.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionNumberConstructor_PicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_PICKLIST
        );

        AssessmentService.industryAssessmentQuestionMap = new Map<Id, SFDC_Industry_Assessment_Question__mdt> {
            null => setupQuestion
        };

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, 0);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.PICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionNumberConstructor_MultiSelectPicklistPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_MULTISELECT
        );

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, 0);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.MULTIPICKLIST.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }

    @IsTest
    static void AssessmentQuestionNumberConstructor_BooleanPath(){
        Assessment__c setupAssessment = new Assessment__c();
        insert setupAssessment;

        SFDC_Industry_Assessment_Question__mdt setupQuestion = new SFDC_Industry_Assessment_Question__mdt(
            Answer_Field_API_Name__c = FIELD_BOOLEAN
        );

        ToolingService.customLabelMap = new Map<String, String>();

        Test.startTest();
            AssessmentService.AssessmentQuestion result = new AssessmentService.AssessmentQuestion(setupQuestion, 0);
        Test.stopTest();

        System.assertNotEquals(null, result, 'The AssessmentQuestion should be constructed correctrly');
        System.assertEquals(Schema.DisplayType.BOOLEAN.name(), result.AnswerDataType, 'AnswerDataType should match its expected value');
    }
}