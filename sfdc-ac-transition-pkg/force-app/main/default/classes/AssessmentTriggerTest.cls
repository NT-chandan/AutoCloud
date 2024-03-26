/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class AssessmentTriggerTest {
    static testMethod void testAssessmentAfterUpdate_BulkScanComplete() {
        Assessment__c assessment = new Assessment__c();
        insert assessment;

        Test.startTest();
            assessment.Bulk_Scan_Complete__c = true;
            update assessment;
        Test.stopTest();

        System.assert(true, 'This test should complete without exception invokes a void method. No results expected.');
    }
    
    @IsTest
    static void givenUnhandledExceptionVerifyFinalizer() {
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        AsyncRequest__c asyncRequest = new AsyncRequest__c(AsyncType__c = ScanSharingReasonsQueueable.class.getName(), Assessment__c =assessment.Id);
        insert asyncRequest;

        Test.startTest();
            ScanSharingReasonsQueueable finalizer = new ScanSharingReasonsQueueable();
        	finalizer.execute(new MockFinalizerContext(ParentJobResult.UNHANDLED_EXCEPTION));
        Test.stopTest();

    }
    
    /** Mock FinalizerContext impl **/
    class MockFinalizerContext implements System.FinalizerContext {
        ParentJobResult result;
        public Id getAsyncApexJobId() { // valid Id, or query one 
            return '707000000000000';
        }
        public Exception getException() { return new System.AsyncException('heap breached'); }
        public String getRequestId() { return 'someRequestId'; }
        public ParentJobResult getResult() { return this.result; }
        MockFinalizerContext (ParentJobResult mockResult) {this.result = mockResult;}
    }
}
