/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class TransitionReadinessTest {

    static final String RESPONSE_DATA_EXTERNAL_SCHEMA = '{"Account":{"name":"Account","label":"Financial Account","recordTypeInfos":[{"active":true,"available":true,"defaultRecordTypeMapping":true,"developerName":"BankingAccount","master":false,"name":"Bank Account","recordTypeId":"01256000001bZWrAAM","urls":{"layout":"/services/data/v50.0/sobjects/FinServ__FinancialAccount__c/describe/layouts/01256000001bZWrAAM"}}],"fields":[{"aggregatable":true,"aiPredictionField":false,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":true,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":false,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":{"controllingFields":[],"dependent":false,"optionalFilter":false},"formulaTreatNullNumberAsZero":false,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Primary Owner","length":18,"mask":null,"maskType":null,"name":"FinServ__PrimaryOwner__c","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"polymorphicForeignKey":false,"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["Account"],"relationshipName":"FinServ__PrimaryOwner__r","relationshipOrder":null,"restrictedDelete":true,"restrictedPicklist":false,"scale":0,"searchPrefilterable":true,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":true,"writeRequiresMasterRead":false}]},"FinServ__FinancialAccountRole__c":{"name":"FinServ__FinancialAccountRole__c","label":"Financial Account Role","recordTypeInfos":[],"fields":[]}}';
    
    static testMethod void testUpgradeAssessment() {
        //get the assessment (should already exist passed from lightning record page)
        Id assessmentId = [SELECT Id FROM Assessment__c LIMIT 1][0].Id;

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

        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}'); //tooling TransitionRecommendation.CheckCustomFieldLimits
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}'); //tooling TransitionRecommendation.CheckCurrencySettings
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}'); //sync dependency tooling response 1
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_PROCESSING, 'Processing'); //async dependency tooling response 2
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();

        //Run with an assessment record
        TransitionReadinessUtility.ReadinessResults results = TransitionReadinessUtility.performFscUpgradeAssessment(assessmentId);
        
        Test.stopTest();

        //verify results
        System.assertNotEquals(null, results.installReadiness, 'Installation readiness results should be generated');
        System.assertNotEquals(null, results.recommendations, 'Recommendation list results should be generated');
    }

    /**
     * TODO CLEAN UP THIS TEST AND FUNCTION FOR LOADING ASSESSMENT VS PERFORM ASSESSMENT
     */
    static testMethod void testUpgradeAnalysis() {
        //get the assessment (should already exist passed from lightning record page)
        Id assessmentId = [SELECT Id FROM Assessment__c LIMIT 1][0].Id;

        Test.startTest();

        //Process dependency results
        Boolean hasVoidError = false;
        try {
            TransitionReadinessUtility.processScanResultsCallback(new List<Id>{assessmentId});
        } catch (Exception e) {
            hasVoidError = true;
        }
        
        //verify results
        //results = TransitionReadinessUtility.performFscUpgradeAssessment(assessmentId);
        Test.stopTest();

        //System.assertNotEquals(null, results.analysis, 'Analyis results should be generated');
        System.assert(!hasVoidError, 'Void callback should execute without exceptions');
    }

    @TestSetup
    static void makeData() {
        //create a new assessment
        Assessment__c assessment = new Assessment__c();
        insert assessment;
    }

}