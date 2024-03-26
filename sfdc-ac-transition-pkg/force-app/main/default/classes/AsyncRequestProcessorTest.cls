/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class AsyncRequestProcessorTest {

    @IsTest static void testEnqueueJob() {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(AsyncType__c = TestProcessor.class.getName());

        insert asyncRequest;

        Test.startTest();
        AsyncRequestProcessor.enqueueJob(null, null, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testTryToQueue() {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(AsyncType__c = TestProcessor.class.getName());

        insert asyncRequest;

        Test.startTest();
        AsyncRequestProcessor.tryToQueue(null, null, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testTryToQueueWithRequestId() {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(AsyncType__c = TestProcessor.class.getName());

        insert asyncRequest;

        Test.startTest();
        AsyncRequestProcessor.tryToQueue(null, asyncRequest.Id, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testParentWithSingleChildRequest() {
        AsyncRequest__c parentAsyncRequest = new AsyncRequest__c(
                AsyncType__c = TestProcessor.class.getName(),
                StartDatetime__c = Datetime.now().addDays(-1));

        insert parentAsyncRequest;

        AsyncRequest__c childAsyncRequest = new AsyncRequest__c(AsyncType__c = TestProcessor.class.getName());
        childAsyncRequest.ParentRequest__c = parentAsyncRequest.Id;

        insert childAsyncRequest;

        Test.startTest();
        AsyncRequestProcessor.testChildContext = true;
        AsyncRequestProcessor.enqueueJob(null, parentAsyncRequest.Id, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testParentWithMultipleChildRequest() {
        AsyncRequest__c parentAsyncRequest = new AsyncRequest__c(
                AsyncType__c = TestProcessor.class.getName(),
                StartDatetime__c = Datetime.now().addDays(-1)
        );
        insert parentAsyncRequest;

        List<AsyncRequest__c> childRequests = new List<AsyncRequest__c>();

        for (Integer i = 0; i < 2; i++) {
            childRequests.add(new AsyncRequest__c(
                    AsyncType__c = TestProcessor.class.getName(),
                    ParentRequest__c = parentAsyncRequest.Id));
        }

        insert childRequests;

        Test.startTest();
        AsyncRequestProcessor.testChildContext = true;
        AsyncRequestProcessor.enqueueJob(null, parentAsyncRequest.Id, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testNewInsertionFunctions() {
        List<AsyncRequest__c> requests = new List<AsyncRequest__c>();
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
                AsyncType__c = TestProcessor.class.getName(),
                Params__c = 'TestProcessorException');
        requests.add(asyncRequest);
        AsyncRequest__c asyncRequest2 = new AsyncRequest__c(
                AsyncType__c = TestProcessor.class.getName(),
                Params__c = 'TestProcessorException');

        Test.startTest();
        AsyncRequestProcessor.insertAsyncRequest(asyncRequest2);
        AsyncRequestProcessor.insertAsyncRequests(requests);
        AsyncRequestProcessor.updateAsyncRequest(requests[0]);
        Test.stopTest();

        List<AsyncRequest__c> asyncJobs = [SELECT Id FROM AsyncRequest__c LIMIT 1];
        System.assert(asyncJobs.size() > 0);
    }

    @IsTest static void testExceptionHandling() {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
                AsyncType__c = TestProcessor.class.getName(),
                Params__c = 'TestProcessorException');

        insert asyncRequest;

        Test.startTest();
        AsyncRequestProcessor.enqueueJob(null, null, TestProcessor.class.getName());
        Test.stopTest();

        List<AsyncApexJob> asyncJobs = [SELECT Id,JobType FROM AsyncApexJob WHERE JobType = 'Queueable'];
        System.assert(asyncJobs.size() > 0);
    }
}