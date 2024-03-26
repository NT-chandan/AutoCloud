/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class SchemaServiceTest {
    static final String OBJECT_API_NAME = 'Account';
    static final String EXPECTED_FIRST_ITEM = '=Common Objects';
    static final String CUSTOM_METATDATA_DATA = '({Is_Namespace__c=true, MasterLabel=APXTConga4}, {Is_Namespace__c=true, MasterLabel=webm}, {Is_Namespace__c=false, MasterLabel=System_Log__c}, {Is_Namespace__c=true, MasterLabel=tfa}, {Is_Namespace__c=true, MasterLabel=skuid})';
    @IsTest
    static void testInstantiateSchemaModel() {
        Test.startTest();
        SchemaService.SchemaModel schemaModel = new SchemaService.SchemaModel();
        Schema.SObjectType userType = SchemaService.getSObjectType( 'User' );
        Test.stopTest();

        System.assert ( schemaModel.fields != NULL );
        System.assert ( schemaModel.recordTypes != NULL );
        System.assertEquals( User.getSObjectType(), userType );
    }

    @IsTest
    static void testGetSchemaMap() {
        Test.startTest();

        Map<String, SchemaService.SchemaModel> schemaModelMap = SchemaService.getFullSchemaModelMap();

        Test.stopTest();

        System.assertNotEquals( null, schemaModelMap, 'An org should have several standard objects that could populate the schema.' );
    }

    @IsTest
    static void testGetPicklistEntries() {
        Test.startTest();

        List<Schema.PicklistEntry> picklistEntries = SchemaService.getPicklistValues( 'User', 'EmailEncodingKey' );

        Test.stopTest();

        System.assert ( picklistEntries.size() > 0, 'There should be several EmailEncodingKey values available for selection' );
    }

    @IsTest
    static void testFilterSystemFields() {
        Test.startTest();

        SchemaService.SchemaModel userModel = SchemaService.getSchemaModel( 'User' );

        Test.stopTest();

        for ( SchemaService.FieldModel fieldModel : userModel.fields ) {
            System.assert ( !SchemaService.FIELDS_TO_EXCLUDE.contains( fieldModel.value.toLowerCase() ), 'Non-Audit system fields should be excluded.' );
        }
    }

    @IsTest
    static void testValidateManagedPackageObjectsFilter() {

        String packageNamespace = Utilities.namespaceUnderscore;

        //Returns empty string if within package dev org, so we need a "random" value that won't ever be
        // filtered on
        if (String.isBlank(packageNamespace)) {
            packageNamespace = 'PACKAGE_DEV_ORG';
        }

        Test.startTest();

        Map<String, SchemaService.SchemaModel> schemaModelMap = SchemaService.getFullSchemaModelMap();

        Test.stopTest();    
        System.assert (schemaModelMap.size() > 0, 'Schema is not available');
    }

    @IsTest
    static void getObjectsForOrg_UnsortedListReturned(){
        SchemaService.mappingOrderList = new List<SFDC_Industry_Mapping_List_Core_Object__mdt>();
        
        Test.startTest();
            List<String> result = SchemaService.getObjectsForOrg();
        Test.stopTest();

        System.assertNotEquals(null, result, 'A list should be returned');
    }

    @IsTest
    static void getObjectsForOrg_SortedListReturned(){
        SchemaService.mappingOrderList = new List<SFDC_Industry_Mapping_List_Core_Object__mdt>{
            new SFDC_Industry_Mapping_List_Core_Object__mdt(
                Object_API_Name__c = OBJECT_API_NAME,
                Sort_Order__c = 1
            )
        };
        
        Test.startTest();
            List<String> result = SchemaService.getObjectsForOrg();
        Test.stopTest();

        System.assertNotEquals(null, result, 'A list should be returned');
        System.assertEquals(EXPECTED_FIRST_ITEM, result[0], 'The first item in the list shold be the requested object');
    }

   /* @IsTest
    static void blacklistSourceEntriesSuccess(){
        MockResponse mockResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            CUSTOM_METATDATA_DATA
        );
        Test.setMock(HttpCalloutMock.class, mockResponses);

        Test.startTest();
            List<Blacklist_Source_Entry__mdt> result = SchemaService.blacklistSourceEntries;
        Test.stopTest();

        System.assertNotEquals(null, result, 'A list should be returned');
    }

*/
}