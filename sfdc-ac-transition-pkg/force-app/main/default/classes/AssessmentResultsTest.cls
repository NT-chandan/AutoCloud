/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class AssessmentResultsTest {

    static final String RESPONSE_DATA_EXTERNAL_SCHEMA = '{"Account":{"name":"Account","label":"Financial Account","recordTypeInfos":[{"active":true,"available":true,"defaultRecordTypeMapping":true,"developerName":"BankingAccount","master":false,"name":"Bank Account","recordTypeId":"01256000001bZWrAAM","urls":{"layout":"/services/data/v50.0/sobjects/FinServ__FinancialAccount__c/describe/layouts/01256000001bZWrAAM"}}],"fields":[{"aggregatable":true,"aiPredictionField":false,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":true,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":false,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":{"controllingFields":[],"dependent":false,"optionalFilter":false},"formulaTreatNullNumberAsZero":false,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Primary Owner","length":18,"mask":null,"maskType":null,"name":"FinServ__PrimaryOwner__c","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"polymorphicForeignKey":false,"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["Account"],"relationshipName":"FinServ__PrimaryOwner__r","relationshipOrder":null,"restrictedDelete":true,"restrictedPicklist":false,"scale":0,"searchPrefilterable":true,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":true,"writeRequiresMasterRead":false}]},"FinServ__FinancialAccountRole__c":{"name":"FinServ__FinancialAccountRole__c","label":"Financial Account Role","recordTypeInfos":[],"fields":[]}}';
	static final String MAPPING_JSON_COMPLETE = '{"recommended":[{"mappingData":[{"destination":"Account","fieldMapping":[{"source":"MasterRecordId","destination":"MasterRecordId","userGenerated":"true"},{"source":"LastName","destination":"LastName","userGenerated":"true"},{"source":"FirstName","destination":"FirstName","userGenerated":"true"},{"source":"Salutation","destination":"Salutation","userGenerated":"true"},{"source":"Name","destination":"Name","userGenerated":"true"},{"source":"OtherStreet","destination":"PersonOtherStreet","userGenerated":"true"},{"source":"OtherCity","destination":"PersonOtherCity","userGenerated":"true"},{"source":"OtherState","destination":"PersonOtherState","userGenerated":"true"},{"source":"OtherPostalCode","destination":"PersonOtherPostalCode","userGenerated":"true"},{"source":"OtherCountry","destination":"PersonOtherCountry","userGenerated":"true"},{"source":"OtherLatitude","destination":"PersonOtherLatitude","userGenerated":"true"},{"source":"OtherLongitude","destination":"PersonOtherLongitude","userGenerated":"true"},{"source":"OtherGeocodeAccuracy","destination":"PersonOtherGeocodeAccuracy","userGenerated":"true"},{"source":"OtherAddress","destination":"PersonOtherAddress","userGenerated":"true"},{"source":"MailingStreet","destination":"PersonMailingStreet","userGenerated":"true"},{"source":"MailingCity","destination":"PersonMailingCity","userGenerated":"true"},{"source":"MailingState","destination":"PersonMailingState","userGenerated":"true"},{"source":"MailingPostalCode","destination":"PersonMailingPostalCode","userGenerated":"true"},{"source":"MailingCountry","destination":"PersonMailingCountry","userGenerated":"true"},{"source":"MailingLatitude","destination":"PersonMailingLatitude","userGenerated":"true"},{"source":"MailingLongitude","destination":"PersonMailingLongitude","userGenerated":"true"},{"source":"MailingGeocodeAccuracy","destination":"PersonMailingGeocodeAccuracy","userGenerated":"true"},{"source":"MailingAddress","destination":"PersonMailingAddress","userGenerated":"true"},{"source":"Phone","destination":"Phone","userGenerated":"true"},{"source":"Fax","destination":"Fax","userGenerated":"true"},{"source":"HomePhone","destination":"PersonHomePhone","userGenerated":"true"},{"source":"OtherPhone","destination":"PersonOtherPhone","userGenerated":"true"},{"source":"AssistantPhone","destination":"PersonAssistantPhone","userGenerated":"true"},{"source":"Email","destination":"PersonEmail","userGenerated":"true"},{"source":"Title","destination":"PersonTitle","userGenerated":"true"},{"source":"Department","destination":"PersonDepartment","userGenerated":"true"},{"source":"LeadSource","destination":"PersonLeadSource","userGenerated":"true"},{"source":"Birthdate","destination":"PersonBirthdate","userGenerated":"true"},{"source":"Description","destination":"Description","userGenerated":"true"},{"source":"OwnerId","destination":"OwnerId","userGenerated":"true"},{"source":"CreatedDate","destination":"CreatedDate","userGenerated":"true"},{"source":"CreatedById","destination":"CreatedById","userGenerated":"true"},{"source":"LastModifiedDate","destination":"LastModifiedDate","userGenerated":"true"},{"source":"LastModifiedById","destination":"LastModifiedById","userGenerated":"true"},{"source":"LastActivityDate","destination":"LastActivityDate","userGenerated":"true"},{"source":"LastCURequestDate","destination":"PersonLastCURequestDate","userGenerated":"true"},{"source":"LastCUUpdateDate","destination":"PersonLastCUUpdateDate","userGenerated":"true"},{"source":"EmailBouncedReason","destination":"PersonEmailBouncedReason","userGenerated":"true"},{"source":"EmailBouncedDate","destination":"PersonEmailBouncedDate","userGenerated":"true"},{"source":"PhotoUrl","destination":"PhotoUrl","userGenerated":"true"},{"source":"Jigsaw","destination":"Jigsaw","userGenerated":"true"},{"source":"IndividualId","destination":"PersonIndividualId","userGenerated":"true"}],"recordTypeMapping":[{"source":"Master","destination":"Master","userGenerated":"true"}],"showDetails":true,"source":"Contact"}],"sectionName":"People (B2C)"},{"mappingData":[{"destination":"FinServ__FinancialAccount__c","fieldMapping":[{"source":"Name","destination":"Name","userGenerated":"true"},{"source":"AccountNumber","destination":"FinServ__FinancialAccountNumber__c","userGenerated":"true"},{"source":"Ownership","destination":"FinServ__Ownership__c","userGenerated":"true"},{"source":"OwnerId","destination":"OwnerId","userGenerated":"true"},{"source":"CreatedDate","destination":"CreatedDate","userGenerated":"true"},{"source":"CreatedById","destination":"CreatedById","userGenerated":"true"},{"source":"LastModifiedDate","destination":"LastModifiedDate","userGenerated":"true"},{"source":"LastModifiedById","destination":"LastModifiedById","userGenerated":"true"},{"source":"LastActivityDate","destination":"LastActivityDate","userGenerated":"true"}],"recordTypeMapping":[{"source":"Master","destination":"Master","userGenerated":"true"}],"showDetails":true,"source":"Account"},{"destination":"FinServ__FinancialAccountRole__c","fieldMapping":[{}],"recordTypeMapping":[{}],"source":""}],"sectionName":"Checking Account"},{"mappingData":[{"destination":"FinServ__FinancialAccount__c","fieldMapping":[{"source":"OwnerId","destination":"OwnerId","userGenerated":"true"},{"source":"Name","destination":"Name","userGenerated":"true"},{"source":"CreatedDate","destination":"CreatedDate","userGenerated":"true"},{"source":"CreatedById","destination":"CreatedById","userGenerated":"true"},{"source":"LastModifiedDate","destination":"LastModifiedDate","userGenerated":"true"},{"source":"LastModifiedById","destination":"LastModifiedById","userGenerated":"true"},{"source":"Name","destination":"FinServ__Status__c","userGenerated":"true"}],"recordTypeMapping":[{"source":"Master","destination":"Master","userGenerated":"true"}],"showDetails":true,"source":"Account"},{"destination":"FinServ__FinancialAccountRole__c","fieldMapping":[{}],"recordTypeMapping":[{}],"source":""}],"sectionName":"Loans"}],"additional":[{"userGenerated":"true","showDetails":true,"source":"Case","destination":"FinServ__LifeEvent__c","fieldMapping":[{"destination":"Name","source":"CaseNumber","truncate":"false","userGenerated":"true"}],"recordTypeMapping":[{"source":"Master","destination":"Master","userGenerated":"true"}]}],"sourceToDestinationObject":{"Asset.AccountId":"Asset.AccountId"}}';
    
    static testMethod void testController_NewAssessment() {
        //create a new assessment
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        
        MockResponse mockResponses;
        if(String.isBlank(Utilities.namespaceUnderscore)){
            mockResponses = MockCalloutDefinitions.createMockWithResponseList(new List<String>{MockCalloutDefinitions.RES_ORG_STATUS, MockCalloutDefinitions.RES_LIMITS, MockCalloutDefinitions.RES_ACTIONS, MockCalloutDefinitions.RES_RECOMMENDATIONS, 
                '{}', MockCalloutDefinitions.RES_OBJECT_WARN, RESPONSE_DATA_EXTERNAL_SCHEMA, MockCalloutDefinitions.RES_ISV_WARN, '{"releaseVersion": "Spring \'21 Patch 9.2"}', '{}', '{}'});
            mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_PROCESSING, 'Processing'); //async dependency tooling response 2
        }else{
            mockResponses = MockCalloutDefinitions.createMockWithResponseList(new List<String>{MockCalloutDefinitions.RES_CURRENT_PACKAGES, MockCalloutDefinitions.RES_ORG_STATUS, MockCalloutDefinitions.RES_LIMITS, MockCalloutDefinitions.RES_ACTIONS, MockCalloutDefinitions.RES_RECOMMENDATIONS, 
                '{}', MockCalloutDefinitions.RES_OBJECT_WARN, '{}', MockCalloutDefinitions.RES_ISV_WARN, '{"releaseVersion": "Spring \'21 Patch 9.2"}', '{}', '{}'});
            mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_PROCESSING, 'Processing'); //async dependency tooling response 2
        }
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();

        //load new results for component
        AssessmentResultsController.AssessmentResultsView resultsView = AssessmentResultsController.getAssessmentResults(assessment.Id);
        
        Test.stopTest();

        //verify results
        System.assertNotEquals(null, resultsView, 'Results view must be generated');
    }

    static testMethod void testController_ExistingAssessment() {
        //create a new assessment
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        
        MockResponse mockResponses;
        if(String.isBlank(Utilities.namespaceUnderscore)){
            mockResponses = MockCalloutDefinitions.createMockWithResponseList(new List<String>{MockCalloutDefinitions.RES_ORG_STATUS, MockCalloutDefinitions.RES_LIMITS, MockCalloutDefinitions.RES_ACTIONS, MockCalloutDefinitions.RES_RECOMMENDATIONS, 
                '{}', MockCalloutDefinitions.RES_OBJECT_WARN, RESPONSE_DATA_EXTERNAL_SCHEMA, MockCalloutDefinitions.RES_ISV_WARN, '{"releaseVersion": "Spring \'21 Patch 9.2"}', '{}', '{}'});
            mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_PROCESSING, 'Processing'); //async dependency tooling response 2
        }else{
            mockResponses = MockCalloutDefinitions.createMockWithResponseList(new List<String>{MockCalloutDefinitions.RES_CURRENT_PACKAGES, MockCalloutDefinitions.RES_ORG_STATUS, MockCalloutDefinitions.RES_LIMITS, MockCalloutDefinitions.RES_ACTIONS, MockCalloutDefinitions.RES_RECOMMENDATIONS, 
                '{}', MockCalloutDefinitions.RES_OBJECT_WARN, '{}', MockCalloutDefinitions.RES_ISV_WARN, '{"releaseVersion": "Spring \'21 Patch 9.2"}', '{}', '{}'});
            mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_PROCESSING, 'Processing'); //async dependency tooling response 2
        }
        
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();

        //load new results for component
        AssessmentResultsController.AssessmentResultsView resultsView = AssessmentResultsController.getAssessmentResults(assessment.Id);

        //reload existing results for component
        //API callouts SHOULD NOT repeat loading saved report results
        AssessmentResultsController.AssessmentResultsView resultsViewReloaded = AssessmentResultsController.getAssessmentResults(assessment.Id);
        
        Test.stopTest();

        //verify results
        System.assertNotEquals(null, resultsViewReloaded, 'Reloaded results must be populated');
        System.assertEquals(resultsView.dateRun, resultsViewReloaded.dateRun, 'Results should be same when reloaded');
    }

    static testMethod void testMiscFunctions(){
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        
        MockResponse mockResponses = new MockResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}'); //installed assessment version will be empty in dev
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();

        Boolean settingsValue = AssessmentResultsController.getCustomSettings();
        System.assert(settingsValue!=null);

        settingsValue = AssessmentResultsController.disableWelcomeDefault();
        System.assert(settingsValue!=null);

        Boolean hideSummary = AssessmentResultsController.hideReportSummary();
        System.assert(hideSummary!=null);

        String pdfResult = AssessmentResultsController.downloadPdfReport(assessment.Id, '{}', 'full');
        System.assert(pdfResult!=null);

        pdfResult = AssessmentResultsController.downloadPdfReport(assessment.Id, '{}', 'summary');
        System.assert(pdfResult!=null);
        
        Test.stopTest();
    }
    
    static testMethod void testgetDataTypeMisMatchedField(){
        Assessment__c setupAssessment = new Assessment__c(
            MappingDataJson__c = MAPPING_JSON_COMPLETE
        );
        insert setupAssessment;
        Test.startTest();

        Map<String,List<String>> dataTypeMisMatchedField = AssessmentResultsController.getDataTypeMisMatchedFields(setupAssessment.Id);
        Map<String,List<String>> unmappedRequiredField = AssessmentResultsController.getUnmappedRequiredFields(setupAssessment.Id);
        System.assert(dataTypeMisMatchedField!=null);
        
        Test.stopTest();
    }
}