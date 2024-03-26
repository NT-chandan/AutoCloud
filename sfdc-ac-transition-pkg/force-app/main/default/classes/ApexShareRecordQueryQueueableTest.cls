/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class ApexShareRecordQueryQueueableTest {

    @IsTest
    static void createAsyncRequestsTest() {
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        ApexShareRecordQueryQueueable.QueryCriteria criteria = new ApexShareRecordQueryQueueable.QueryCriteria(
            assessment.Id,
            'Account',
            new List<String>{'test'}
        );

        Test.startTest();
            ApexShareRecordQueryQueueable.createAsyncRequests(assessment.Id, new List<ApexShareRecordQueryQueueable.QueryCriteria>{criteria});
        Test.stopTest();

        List<AsyncRequest__c> asyncRequests = [
            SELECT Id, Assessment__c, AsyncType__c
            FROM AsyncRequest__c
            WHERE Assessment__c = :assessment.Id
            AND AsyncType__c = 'ApexShareRecordQueryQueueable'
        ];
        System.assert(asyncRequests!=null);
    }

    @IsTest
    static void updateAssessmentTest() {
        Assessment__c assessment = new Assessment__c();
        insert assessment;
        ApexShareRecordQueryQueueable queueable = new ApexShareRecordQueryQueueable();
        queueable.queryCriteriaItem = new ApexShareRecordQueryQueueable.QueryCriteria(
            assessment.Id,
            'Account',
            new List<String>{'test'}
        );

        Test.startTest();
            queueable.updateAssessment(true, true);
        	ApexShareReferenceScanQueueable finalizer = new ApexShareReferenceScanQueueable();
        	finalizer.execute(new MockFinalizerContext(ParentJobResult.UNHANDLED_EXCEPTION));
       		finalizer.execute(new MockFinalizerContext(ParentJobResult.SUCCESS));
        Test.stopTest();

        assessment = [
            SELECT Id, Apex_Sharing_Scan_Complete__c, Has_Apex_Sharing__c
            FROM Assessment__c
            WHERE Id = :assessment.Id
        ];
        System.assertEquals(true, assessment.Apex_Sharing_Scan_Complete__c);
        System.assertEquals(true, assessment.Has_Apex_Sharing__c);
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
