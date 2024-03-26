/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**************************************************************************************
 * Test class for AssessmentConfigController
 * 
 * Story: FSCTA-1626
 **************************************************************************************/
@IsTest
private class AssessmentConfigControllerTest {

    static final String REDIS_GET_RESPONSE = '{"ExcludedSections":["ReportSummaryUsedObjects","OverallRecommendation","FieldAnalysis","BestPractices"],"ExcludedMetadata":["ApexClass","ApexTrigger"]}';
    static final String METADATA_GET_RESPONSE = '{"excludedMetadata":["ApexClass"],"metadataList":[{"name":"ApexClass", "metadataId":"ApexClass"},{"name":"ApexPage", "metadataId":"ApexPage"}]}';
    static final String EXTERNAL_STRING_RESPONSE = '{"size":10,"totalSize":10,"done":true,"queryLocator":null,"entityTypeName":"ExternalString","records":[{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x000007AblEAAS"},"Id":"1014x000007AblEAAS","Name":"AssessmentReportSectionTitleApproach","Value":"Transition Approach","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x000007AblYAAS"},"Id":"1014x000007AblYAAS","Name":"AssessmentReportSectionTitleResults","Value":"Assessment Results","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x000007AbldAAC"},"Id":"1014x000007AbldAAC","Name":"AssessmentReportSectionTitleAnalysis","Value":"Migration Analysis","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x000007Abl4AAC"},"Id":"1014x000007Abl4AAC","Name":"AssessmentReportSectionTitleIntro","Value":"Intro","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x000007AblTAAS"},"Id":"1014x000007AblTAAS","Name":"AssessmentReportSectionTitleRecommendation","Value":"Upgrade Recommendation","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x00000FAMcRAAX"},"Id":"1014x00000FAMcRAAX","Name":"QuestionIndustry","Value":"What industry product would you like to transition to?","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x00000FAMcWAAX"},"Id":"1014x00000FAMcWAAX","Name":"QuestionCustomerRepresentation","Value":"How is your customer represented?","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x00000FAMcbAAH"},"Id":"1014x00000FAMcbAAH","Name":"QuestionRelationshipGroupings","Value":"Do you group together your customers through any shared relationships?","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x00000FAMcgAAH"},"Id":"1014x00000FAMcgAAH","Name":"QuestionRollups","Value":"Do these groups aggregate or summarize counts/sums of customer related products,services, or activities?","Language":"en_US"},{"attributes":{"type":"ExternalString","url":"/services/data/v50.0/tooling/sobjects/ExternalString/1014x00000FAGK9AAP"},"Id":"1014x00000FAGK9AAP","Name":"AssessmentReportSectionSummaryAnalysis","Value":"Here\'s a high-level view of how FSC features and customizations can be approached for possible migration . Use this information to create the first draft of your gap analysis. To get a closer look, click the link for each feature or customization for recommendations for specific changes. But remember: You\'re the Salesforce expert at your company. Leverage the usage data in each section to decide whether our recommendations are worth your effort. For example, if the report identifies AppExchange packages require a thoughtful rollout but no one is using them, cross that feature off your gap analysis.","Language":"en_US"}]};';
    
    static final String RES_SECTIONS = '[[{"Id":"m0T5f000000AzwKEAS","DeveloperName":"Welcome","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleWelcome","'+Utilities.namespaceUnderscore+'Sort_Order__c":1},{"Id":"m0T5f000000AzwGEAS","DeveloperName":"ReportSummary","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleReportSummary","'+Utilities.namespaceUnderscore+'Sort_Order__c":2},{"Id":"m0T5f000000AzwDEAS","DeveloperName":"OverallRecommendation","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleOverallRecommendation","'+Utilities.namespaceUnderscore+'Sort_Order__c":4},{"Id":"m0T5f000000Azw8EAC","DeveloperName":"AssessmentResults","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleResults","'+Utilities.namespaceUnderscore+'Sort_Order__c":5},{"Id":"m0T5f000000AzwCEAS","DeveloperName":"MigrationAnalysis","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleAnalysis","'+Utilities.namespaceUnderscore+'Sort_Order__c":6},{"Id":"m0T5f000000AzwBEAS","DeveloperName":"FieldAnalysis","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleFieldAnalysis","'+Utilities.namespaceUnderscore+'Sort_Order__c":7},{"Id":"m0T5f000000AzwHEAS","DeveloperName":"SharingSettingAnalysis","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionSharingSettingTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":8},{"Id":"m0T5f000000AzwFEAS","DeveloperName":"ProfileAnalysis","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleProfile","'+Utilities.namespaceUnderscore+'Sort_Order__c":9},{"Id":"m0T5f000000AzwAEAS","DeveloperName":"ComponentsNotCovered","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleComponentsCovered","'+Utilities.namespaceUnderscore+'Sort_Order__c":10},{"Id":"m0T5f000000Azw9EAC","DeveloperName":"BestPractices","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportSectionTitleBestPractices","'+Utilities.namespaceUnderscore+'Sort_Order__c":11}]]';
    static final String RES_SUMMARY_SECTIONS = '[[{"Id":"m0U5f000000GhZLEA0","DeveloperName":"ReportSummarySystemOverview","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryOverviewTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":4},{"Id":"m0U5f000000GhZNEA0","DeveloperName":"ReportSummaryUsedObjects","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryObjectsTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":5},{"Id":"m0U5f000000GhZMEA0","DeveloperName":"ReportSummaryTransitionApproach","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryApproachTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":6},{"Id":"m0U5f000000GhZKEA0","DeveloperName":"ReportSummaryRecommendedSettings","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummarySettingsTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":7},{"Id":"m0U5f000000GhZHEA0","DeveloperName":"ReportSummaryBasisofAssessment","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryBasisTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":8},{"Id":"m0U5f000000GhZIEA0","DeveloperName":"ReportSummaryConsiderations","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryConsiderationsTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":9},{"Id":"m0U5f000000GhZJEA0","DeveloperName":"ReportSummaryMigrationAnalysis","'+Utilities.namespaceUnderscore+'Title_Label_Name__c":"AssessmentReportReportSummaryMigrationTitle","'+Utilities.namespaceUnderscore+'Sort_Order__c":10}]]';

    @isTest
    static void testGetReportSections(){
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            RES_SECTIONS,
            new Map<String, String>()
        );

        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, RES_SUMMARY_SECTIONS);

        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, EXTERNAL_STRING_RESPONSE);

        Test.setMock(HttpCalloutMock.class, setupResponses);

        Test.startTest();
        List<AssessmentConfigController.ReportSection> sectionList = AssessmentConfigController.getReportSections();
        Test.stopTest();

        System.assert(sectionList.size() > 0);
    }

    @isTest
    static void testGetMetadataDescribe(){
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            METADATA_GET_RESPONSE,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);

        Test.startTest();
        AssessmentConfigController.MetaDescribeContainer metaContainer = AssessmentConfigController.getMetadataDescribe();
        Test.stopTest();

        System.assert(metaContainer.excludedMetadata.size() > 0);
        System.assert(metaContainer.metadataList.size() > 0);
    }

    @isTest
    static void testGetReportConfig(){
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            REDIS_GET_RESPONSE,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);

        Test.startTest();
        AssessmentConfigController.ReportConfigContainer container = AssessmentConfigController.getReportConfig();
        Test.stopTest();

        System.assert(container.ExcludedSections.size() > 0);
        System.assert(container.ExcludedMetadata.size() > 0);
    }

    @isTest
    static void testSaveReportConfig(){
        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_SAVE_SUCCESS,
            '',
            'Success',
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);

        List<String> sections = new List<String>{'Welcome', 'FieldAnalysis'};
        List<String> metadata = new List<String>{'ApexClass', 'ApexPage'};

        Test.startTest();
        String res = AssessmentConfigController.saveReportConfig(sections, metadata);
        Test.stopTest();

        System.assertEquals(res, 'Success');
    }
}