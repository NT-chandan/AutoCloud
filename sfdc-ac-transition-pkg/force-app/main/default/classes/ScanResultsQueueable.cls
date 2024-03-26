/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class ScanResultsQueueable extends AsyncRequestProcessor {
    public static Id asyncRequestId;
    private Id assessmentId;

    public void processRequest(AsyncRequest__c request) {
        this.assessmentId = request.Params__c;
        asyncRequestId = request.Id;

        TransitionReadinessUtility.processScanResults(this.assessmentId);
    }

    public static void createAsyncRequest(Id assessmentId){
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
            Assessment__c = assessmentId,
            AsyncType__c = ScanResultsQueueable.class.getName(),
            Params__c = assessmentId);

        insertAsyncRequest(asyncRequest);
    }
}