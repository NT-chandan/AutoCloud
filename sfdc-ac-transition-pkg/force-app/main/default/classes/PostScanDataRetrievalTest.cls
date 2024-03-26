/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Test Class for PostScanDataRetrieval
 */
@isTest
public with sharing class PostScanDataRetrievalTest {
    
    @IsTest
    static void testGet(){ 
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();  
        
        req.requestURI = '/services/apexrest/FSCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_FEATURES;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response= res;
        
        Test.startTest();
        String resString = PostScanDataRetrieval.doGet();
        System.assert(resString != null);
        // req.requestURI = '/services/apexrest/FSCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_LIMITS;
        // resString = PostScanDataRetrieval.doGet();
        // System.assert(resString != null);
        req.requestURI = '/services/apexrest/HCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_FIELD_COUNT;
        resString = PostScanDataRetrieval.doGet();
        System.assert(resString != null);
        req.requestURI = '/services/apexrest/HCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_INSTALL_READINESS;
        resString = PostScanDataRetrieval.doGet();
        System.assert(resString != null);
        req.requestURI = '/services/apexrest/HCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_ANSWERS;
        resString = PostScanDataRetrieval.doGet();
        System.assert(resString != null);
        req.requestURI = '/services/apexrest/HCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_HC_RECS;
        resString = PostScanDataRetrieval.doGet();
        System.assert(resString != null);
        Test.stopTest();
    }
    @IsTest
    static void testPost(){
        Assessment__c assessment = new Assessment__c();
        insert assessment;

        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();  
        
        req.requestURI = '/services/apexrest/FSCTransition/PostScanData/'+PostScanDataRetrieval.DATA_TYPE_OVERALL_REC;
        req.httpMethod = 'POST';
        RestContext.request = req;
        RestContext.response= res;


        Test.startTest();
        String resString = PostScanDataRetrieval.doPost(new List<String>{''+assessment.Id});
        Test.stopTest();

        System.assert(resString.equals('success'));
    }
}