/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class TransitionRecommendationTest {

    private static final String API_RESPONSE_FSC_SCHEMA = '{"objectDescribeMap":{"Event":{"urls":{"sobject":"/services/data/v51.0/sobjects/Event","layouts":"/services/data/v51.0/sobjects/Event/describe/layouts","quickActions":"/services/data/v51.0/sobjects/Event/quickActions","uiNewRecord":"https://computing-customer-7699-dev-ed.cs95.my.salesforce.com/00U/e","describe":"/services/data/v51.0/sobjects/Event/describe","defaultValues":"/services/data/v51.0/sobjects/Event/defaultValues?recordTypeId&fields","eventSeriesUpdates":"/services/data/v51.0/sobjects/Event/{ID}/fromThisEventOnwards","uiEditTemplate":"https://computing-customer-7699-dev-ed.cs95.my.salesforce.com/{ID}/e","uiDetailTemplate":"https://computing-customer-7699-dev-ed.cs95.my.salesforce.com/{ID}","rowTemplate":"/services/data/v51.0/sobjects/Event/{ID}","compactLayouts":"/services/data/v51.0/sobjects/Event/describe/compactLayouts"},"updateable":true,"undeletable":true,"triggerable":true,"supportedScopes":[{"name":"delegated","label":"My delegated events"},{"name":"everything","label":"All events"},{"name":"mine","label":"My events"},{"name":"team","label":"My team\'s events"}],"sobjectDescribeOption":"FULL","searchable":true,"searchLayoutable":true,"retrieveable":true,"replicateable":true,"recordTypeInfos":[{"urls":{"layout":"/services/data/v51.0/sobjects/Event/describe/layouts/0120x000001Ee2oAAC"},"recordTypeId":"0120x000001Ee2oAAC","name":"Advisor Event","master":false,"developerName":"AdvisorEvent","defaultRecordTypeMapping":false,"available":false,"active":true},{"urls":{"layout":"/services/data/v51.0/sobjects/Event/describe/layouts/0120x000001Ee2pAAC"},"recordTypeId":"0120x000001Ee2pAAC","name":"Client Associate Event","master":false,"developerName":"ClientAssociateEvent","defaultRecordTypeMapping":false,"available":false,"active":true},{"urls":{"layout":"/services/data/v51.0/sobjects/Event/describe/layouts/012000000000000AAA"},"recordTypeId":"012000000000000AAA","name":"Master","master":true,"developerName":"Master","defaultRecordTypeMapping":true,"available":true,"active":true}],"queryable":true,"networkScopeFieldName":null,"namedLayoutInfos":[],"name":"Event","mruEnabled":true,"mergeable":false,"lookupLayoutable":null,"listviewable":null,"layoutable":true,"labelPlural":"Events","label":"Event","keyPrefix":"00U","isSubtype":false,"isInterface":false,"implementsInterfaces":null,"implementedBy":null,"hasSubtypes":false,"fields":[{"writeRequiresMasterRead":false,"updateable":true,"unique":false,"type":"reference","sortable":true,"soapType":"tns:ID","searchPrefilterable":false,"scale":0,"restrictedPicklist":false,"restrictedDelete":false,"relationshipOrder":null,"relationshipName":"FinServ__Household__r","referenceTo":["Account"],"referenceTargetField":null,"queryByDistance":false,"precision":0,"polymorphicForeignKey":false,"picklistValues":[],"permissionable":true,"nillable":true,"namePointing":false,"nameField":false,"name":"FinServ__Household__c","maskType":null,"mask":null,"length":18,"label":"Household","inlineHelpText":null,"idLookup":false,"htmlFormatted":false,"highScaleNumber":false,"groupable":true,"formulaTreatNullNumberAsZero":false,"filteredLookupInfo":null,"filterable":true,"extraTypeInfo":null,"externalId":false,"encrypted":false,"displayLocationInDecimal":false,"digits":0,"deprecatedAndHidden":false,"dependentPicklist":false,"defaultedOnCreate":false,"defaultValueFormula":null,"defaultValue":null,"custom":true,"createable":true,"controllerName":null,"compoundFieldName":null,"caseSensitive":false,"cascadeDelete":false,"calculatedFormula":null,"calculated":false,"byteLength":18,"autoNumber":false,"aiPredictionField":false,"aggregatable":true}]}}}';
    private static final String API_RESPONSE_ACM_SCHEMA = '{"createable":true}';
    static final String RESPONSE_DATA_EXTERNAL_SCHEMA = '{"Account":{"name":"Account","label":"Financial Account","recordTypeInfos":[{"active":true,"available":true,"defaultRecordTypeMapping":true,"developerName":"BankingAccount","master":false,"name":"Bank Account","recordTypeId":"01256000001bZWrAAM","urls":{"layout":"/services/data/v50.0/sobjects/FinServ__FinancialAccount__c/describe/layouts/01256000001bZWrAAM"}}],"fields":[{"aggregatable":true,"aiPredictionField":false,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":true,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":false,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":{"controllingFields":[],"dependent":false,"optionalFilter":false},"formulaTreatNullNumberAsZero":false,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Primary Owner","length":18,"mask":null,"maskType":null,"name":"FinServ__PrimaryOwner__c","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"polymorphicForeignKey":false,"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["Account"],"relationshipName":"FinServ__PrimaryOwner__r","relationshipOrder":null,"restrictedDelete":true,"restrictedPicklist":false,"scale":0,"searchPrefilterable":true,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":true,"writeRequiresMasterRead":false}]},"FinServ__FinancialAccountRole__c":{"name":"FinServ__FinancialAccountRole__c","label":"Financial Account Role","recordTypeInfos":[],"fields":[]}}';
	private static final String API_META_DATA_MOCK = '{"Id":"m0p5f000000cPNmAAM","DeveloperName":"orgFscInstallationReady","MasterLabel":"orgFscInstallationReady","Custom_Label__c":"RecOrgFscInstallationReady","Recommendation_Apex__c":null,"Recommendation_Description_Label__c":null,"Recommendation_Description_Title_Label__c":null}';
    static final String MAPPING_JSON_COMPLETE = '{"recommended":[{"mappingData":[{"destination":"Asset","destinationObjectMetaName":"Asset","fieldMapping":[{"source":"AccountId","destination":"AccountId","userGenerated":"true","currentMeta":{"childRelationshipName":"Account","connectedObject":"(Account)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"Name","destination":"Name","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"string","decimalPlaces":"0","length":"255","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"AssetProvidedById","destination":"AssetProvidedById","userGenerated":"true","currentMeta":{"childRelationshipName":"AssetProvidedBy","connectedObject":"(Account)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"AssetServicedById","destination":"AssetServicedById","userGenerated":"true","currentMeta":{"childRelationshipName":"AssetServicedBy","connectedObject":"(Account)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"IsCompetitorProduct","destination":"IsCompetitorProduct","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"boolean","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"ContactId","destination":"ContactId","userGenerated":"true","currentMeta":{"childRelationshipName":"Contact","connectedObject":"(Contact)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"CreatedById","destination":"CreatedById","userGenerated":"true","currentMeta":{"childRelationshipName":"CreatedBy","connectedObject":"(User)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"CreatedDate","destination":"CreatedDate","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"datetime","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"Description","destination":"Description","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"textarea","decimalPlaces":"0","length":"32000","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"InstallDate","destination":"InstallDate","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"date","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"IsInternal","destination":"IsInternal","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"boolean","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"LastModifiedById","destination":"LastModifiedById","userGenerated":"true","currentMeta":{"childRelationshipName":"LastModifiedBy","connectedObject":"(User)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"LastModifiedDate","destination":"LastModifiedDate","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"datetime","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"OwnerId","destination":"OwnerId","userGenerated":"true","currentMeta":{"childRelationshipName":"Owner","connectedObject":"(User)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":true,"unique":false}},{"source":"ParentId","destination":"ParentId","userGenerated":"true","currentMeta":{"childRelationshipName":"Parent","connectedObject":"(Asset)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"Price","destination":"Price","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"currency","decimalPlaces":"2","length":"0","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"ProductCode","destination":"ProductCode","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"string","decimalPlaces":"0","length":"255","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"Product2Id","destination":"Product2Id","userGenerated":"true","currentMeta":{"childRelationshipName":"Product2","connectedObject":"(Product2)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"StockKeepingUnit","destination":"StockKeepingUnit","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"string","decimalPlaces":"0","length":"180","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"PurchaseDate","destination":"PurchaseDate","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"date","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"Quantity","destination":"Quantity","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"double","decimalPlaces":"2","length":"0","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"RootAssetId","destination":"RootAssetId","userGenerated":"true","currentMeta":{"childRelationshipName":"RootAsset","connectedObject":"(Asset)","dataType":"reference","decimalPlaces":"0","length":"18","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"SerialNumber","destination":"SerialNumber","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"string","decimalPlaces":"0","length":"80","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"Status","destination":"Status","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"picklist","decimalPlaces":"0","length":"255","referenceType":"Lookup Relationship","required":false,"unique":false}},{"source":"UsageEndDate","destination":"UsageEndDate","userGenerated":"true","currentMeta":{"connectedObject":"()","dataType":"date","decimalPlaces":"0","length":"0","referenceType":"Lookup Relationship","required":false,"unique":false}}],"recordTypeMapping":[{"source":"Master","destination":"Master","userGenerated":"true"}],"showDetails":true,"source":"Asset","rtCountString":"1 of 1 Record Type(s) Mapped","fieldCountString":"25 of 49 Field(s) Mapped","childCountString":"0 of 0 Child Relationship(s) Mapped"}],"screenId":"m0D1Q0000000jGcUAI","sectionName":"Financial Services Information - Asset"}],"additional":[]}';
    static final String ANALYSIS_JSON_COMPLETE = '{"migrationAnalysis":[{"toComponentName":"FinServ__FinancialAccount__c","fromComponentType":"CustomObject","fromComponentId":"01I4x000000VYCnEAO","fromComponentName":"Assessment","children":[{"fromComponentType":"CompactLayout","fromComponentName":"Compact Layout (1)","children":[{"fromComponentType":"CompactLayout","fromComponentId":"0AH4x000001GwftGAC","fromComponentName":"Test_Compact_INGORE","children":[]}]},{"fromComponentType":"FieldSet","fromComponentName":"Field Set (1)","children":[{"fromComponentType":"FieldSet","fromComponentId":"0IX4x0000004YxbGAE","fromComponentName":"Test_IGNORE","children":[{"fromComponentId":"0IX4x0000004YxbGAF","children":[],"fromComponentType":"FieldSet","fromComponentName":"Test_IGNORE2"},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000DuR3VEAV","fromComponentName":"Bulk_Scan_Complete","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000KlmzQEAR","fromComponentName":"Financial_Accounts_Leveraged","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foK3EAI","fromComponentName":"Is_B2C","children":[]}]}]},{"fromComponentType":"FlexiPage","fromComponentName":"Lightning Page (1)","children":[{"fromComponentType":"FlexiPage","fromComponentId":"0M04x000002KVefCAG","fromComponentName":"Assessment_Record_Page","children":[{"fromComponentType":"CustomLabel","fromComponentId":"1014x00000QDmULAA1","fromComponentName":"UIAssessmentPageTabChecklist","children":[]},{"fromComponentType":"CustomLabel","fromComponentId":"1014x00000QDmUQAA1","fromComponentName":"UIAssessmentPageTabDeploy","children":[]},{"fromComponentType":"CustomLabel","fromComponentId":"1014x00000QDmUGAA1","fromComponentName":"UIAssessmentPageTabInstall","children":[]},{"fromComponentType":"CustomLabel","fromComponentId":"1014x00000QDmUBAA1","fromComponentName":"UIAssessmentPageTabReport","children":[]},{"fromComponentType":"CustomLabel","fromComponentId":"1014x00000QDmUVAA1","fromComponentName":"UIAssessmentPageTabRollout","children":[]},{"fromComponentType":"LightningComponentBundle","fromComponentId":"0Rb4x0000001pctCAA","fromComponentName":"assessmentResults","children":[]},{"fromComponentType":"LightningComponentBundle","fromComponentId":"0Rb4x0000003x9OCAQ","fromComponentName":"deploymentChecklist","children":[]},{"fromComponentType":"LightningComponentBundle","fromComponentId":"0Rb4x0000003xDkCAI","fromComponentName":"packageScreen","children":[]}]}]},{"fromComponentType":"RecordType","fromComponentName":"Record Type (1)","children":[{"toComponentName":"Brokerage","fromComponentType":"RecordType","fromComponentName":"Master","children":[]}]},{"fromComponentType":"ReportType","fromComponentName":"Report Type (1)","children":[{"fromComponentType":"ReportType","fromComponentId":"0704x000000Ls70AAC","fromComponentName":"Test_Report_Type","children":[{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foKNEAY","fromComponentName":"AnalysisDataJSON","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000Q659AEAR","fromComponentName":"Apex_Sharing_Scan_Complete","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000DuR3VEAV","fromComponentName":"Bulk_Scan_Complete","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000KkwJKEAZ","fromComponentName":"Current_Question_Id","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000KkwJPEAZ","fromComponentName":"Current_Question_Number","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000Du46tEAB","fromComponentName":"Customer_Representation","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000Dx1j8EAB","fromComponentName":"External_Data_In_Salesforce","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000KlmzQEAR","fromComponentName":"Financial_Accounts_Leveraged","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000Q65CxEAJ","fromComponentName":"HasMappingData","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000Q5rviEAB","fromComponentName":"Has_Apex_Sharing","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foK8EAI","fromComponentName":"Has_Relationship_Groups","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000DuM0jEAF","fromComponentName":"Has_Rollups","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foK3EAI","fromComponentName":"Is_B2C","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foKIEAY","fromComponentName":"MappingDataJSON","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000DuM0ZEAV","fromComponentName":"Relationship_Groupings","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foJzEAI","fromComponentName":"Selected_Products","children":[]},{"toComponentName":"FinServ__Status__c","fromComponentType":"CustomField","fromComponentId":"00N4x000007foJFEAY","fromComponentName":"Status","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x000007foKDEAY","fromComponentName":"Upgrade_Recommendation","children":[]}]}]}]},{"toComponentName":"Account","fromComponentType":"StandardEntity","fromComponentId":"Contact","fromComponentName":"Contact","children":[{"fromComponentType":"FieldSet","fromComponentName":"Field Set (1)","children":[{"fromComponentType":"FieldSet","fromComponentId":"0IX4x0000004YxgGAE","fromComponentName":"Contact_FieldSet_Test","children":[]}]},{"fromComponentType":"Layout","fromComponentName":"Page Layout (4)","children":[{"fromComponentType":"Layout","fromComponentId":"00h4x000003wltyAAA","fromComponentName":"Contact (Marketing) Layout","children":[{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcPEAV","fromComponentName":"Languages","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcQEAV","fromComponentName":"Level","children":[]}]},{"fromComponentType":"Layout","fromComponentId":"00h4x000003wltzAAA","fromComponentName":"Contact (Sales) Layout","children":[{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcPEAV","fromComponentName":"Languages","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcQEAV","fromComponentName":"Level","children":[]}]},{"fromComponentType":"Layout","fromComponentId":"00h4x000003wlu0AAA","fromComponentName":"Contact (Support) Layout","children":[{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcPEAV","fromComponentName":"Languages","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcQEAV","fromComponentName":"Level","children":[]}]},{"fromComponentType":"Layout","fromComponentId":"00h4x000003wlu1AAA","fromComponentName":"Contact Layout","children":[{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcPEAV","fromComponentName":"Languages","children":[]},{"fromComponentType":"CustomField","fromComponentId":"00N4x00000BkCcQEAV","fromComponentName":"Level","children":[]}]}]},{"uuid":"1faa6ab8-3743-cf7b-0779-99f70fa3331c","toComponentUrl":null,"toComponentName":null,"reasonText":"Email Template can be automatically migrated. Use the Generate Changes tab to select and generate changes for deployment.","fromComponentUrl":"https://fsc-upgrade-development-dev-ed.my.salesforce.com/lightning/setup/CommunicationTemplatesEmail/home","fromComponentType":"EmailTemplate","fromComponentName":"Email Template (1)","fromComponentInternalSharing":null,"fromComponentId":null,"fromComponentExternalSharing":null,"children":[{"uuid":"102cb32a-f55e-8d14-6101-2ca9261d9265","toComponentUrl":null,"toComponentName":null,"reasonText":null,"fromComponentUrl":"https://fsc-upgrade-development-dev-ed.my.salesforce.com/lightning/setup/CommunicationTemplatesEmail/page?address=%2F00X4x000000pnSrEAI","fromComponentType":"EmailTemplate","fromComponentName":"Awesome_Emails","fromComponentInternalSharing":null,"fromComponentId":"00X4x000000pnSrEAI","fromComponentExternalSharing":null,"children":[]}]},{"fromComponentType":"ListView","fromComponentName":"List View (6)","children":[{"fromComponentType":"ListView","fromComponentId":"00B4x000006hcwgEAA","fromComponentName":"All Contacts","children":[]},{"fromComponentType":"ListView","fromComponentId":"00B4x000006hcw9EAA","fromComponentName":"Birthdays This Month","children":[]},{"fromComponentType":"ListView","fromComponentId":"00B4x000006hcw9EAZ","fromComponentName":"Recently Viewed Contacts","children":[]}]},{"fromComponentType":"RecordType","fromComponentName":"Record Type (1)","children":[{"toComponentName":"PersonAccount","fromComponentType":"RecordType","fromComponentName":"Master","children":[]}]}]}],"accessInfoResults":[{"uuid":"4c0a40a1-26c9-7efb-3eba-81bfa6391f88","toComponentName":null,"reasonText":"0","fromComponentType":"Profile","fromComponentId":"00e4x000001ngr5AAA","fromComponentName":"Custom: Marketing Profile","children":[]},{"uuid":"4c0a40a1-26c9-7efb-3eba-81bfa6391f89","toComponentName":null,"reasonText":"10","fromComponentType":"PermissionSet","fromComponentId":"00e4x000001ngrFAKE","fromComponentName":"Awesome Permission Set","children":[]}]}';
    static final String ASSESSMENT_STATUS_REVIEW = 'Review';
    static testMethod void testRecommendationAbstractGenerate_NullId() {
        TransitionRecommendation recommendation;

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_LIMITS,
            new Map<String, String>()
        );

        Test.setMock(HttpCalloutMock.class, setupResponses);

        Test.startTest();
            recommendation = new TransitionRecommendation().generate(null);
        Test.stopTest();

        System.assertNotEquals(null, recommendation, 'Recommendation instance should be available');
    }

    static testMethod void testAccessRecommendationTextMap() {
        Map<String,String> recommendTextMap;

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_LIMITS,
            new Map<String, String>()
        );

        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_LIMITS);
        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}');

        Test.setMock(HttpCalloutMock.class, setupResponses);

        //This test invokes ToolingService.customLabelMap
        Test.startTest();
            recommendTextMap = TransitionRecommendation.recommendTextMap;
        Test.stopTest();

        System.assertNotEquals(null, recommendTextMap, 'Recommendation text map instance should be available');
        System.assertNotEquals(true, recommendTextMap.isEmpty(), 'At least one recommendation text should be generated dynamically');
    }

    static testMethod void testExecuteRecommendations() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true);
        insert assessment;
        List<TransitionRecommendation> recommendations = new List<TransitionRecommendation>();

        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.RES_LIMITS,
            new Map<String, String>()
        );

        //This test invokes callouts in some of the recommendation checks
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ACTIONS);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_RECOMMENDATIONS);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, '{}'); //toling labels text not needed for this test
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_OBJECT_WARN);
        if(String.isBlank(Utilities.namespaceUnderscore)){
            mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, RESPONSE_DATA_EXTERNAL_SCHEMA);
        }
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA); //CheckCustomFieldLimits - FSC org schema describe
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_ACM_SCHEMA); //CheckCurrencySettings - Advanced currency management check
        
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
            recommendations.addAll(TransitionRecommendation.executeAllActions(assessment.Id));
        Test.stopTest();

        System.assertNotEquals(true, recommendations.isEmpty(), 'At least one recommendation instance should be generated dynamically');
    }

    static testMethod void CheckCustomFieldLimitsSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckCustomFieldLimits customFieldChecker = new TransitionRecommendation.CheckCustomFieldLimits();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckLicensedFeaturesSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		//mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        //mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        //mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckLicensedFeatures customFieldChecker = new TransitionRecommendation.CheckLicensedFeatures();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckSharingConfigurationSuccess() {
       Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true, MappingDataJSON__c = MAPPING_JSON_COMPLETE,
                                                    AnalysisDataJSON__c = ANALYSIS_JSON_COMPLETE);        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckSharingConfiguration customFieldChecker = new TransitionRecommendation.CheckSharingConfiguration();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckClassicEmailTemplatesSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckClassicEmailTemplates customFieldChecker = new TransitionRecommendation.CheckClassicEmailTemplates();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }

	static testMethod void CheckHighDataVolumeSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckHighDataVolume customFieldChecker = new TransitionRecommendation.CheckHighDataVolume();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckMemberModelSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true, MappingDataJSON__c = MAPPING_JSON_COMPLETE,
                                                    AnalysisDataJSON__c = ANALYSIS_JSON_COMPLETE);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckMemberModel customFieldChecker = new TransitionRecommendation.CheckMemberModel();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
     static testMethod void CheckPatientModelSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true, MappingDataJSON__c = MAPPING_JSON_COMPLETE,
                                                    AnalysisDataJSON__c = ANALYSIS_JSON_COMPLETE);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckPatientModel customFieldChecker = new TransitionRecommendation.CheckPatientModel();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckOrgAgeSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true, MappingDataJSON__c = MAPPING_JSON_COMPLETE,
                                                    AnalysisDataJSON__c = ANALYSIS_JSON_COMPLETE);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckOrgAge customFieldChecker = new TransitionRecommendation.CheckOrgAge();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
    
    static testMethod void CheckObjectLookupsContactSuccess() {
        Assessment__c assessment = new Assessment__c(Is_B2C__c = true, Has_Apex_Sharing__c = true, Has_Apex_Sharing_on_CDS_Object__c = true, MappingDataJSON__c = MAPPING_JSON_COMPLETE,
                                                    AnalysisDataJSON__c = ANALYSIS_JSON_COMPLETE);
        insert assessment;
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            
            MockCalloutDefinitions.RES_ISV_WARN
        );
		mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.RES_ISV_WARN);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_META_DATA_MOCK);
        mockResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, API_RESPONSE_FSC_SCHEMA);
       
       
        Test.setMock(HttpCalloutMock.class, mockResponses);
        Test.startTest();
        TransitionRecommendation.CheckObjectLookupsContact customFieldChecker = new TransitionRecommendation.CheckObjectLookupsContact();
        customFieldChecker.generate(assessment.Id);
        Test.stopTest();
    }
}