/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Gets the total number of fields in the org (async)
 */
public inherited sharing class GetOrgFieldCountQueueable extends AsyncRequestProcessor {
    public static Id asyncRequestId;
    private Id assessmentId;

    private void processRequest(AsyncRequest__c request) {
        this.assessmentId = request.Params__c;
        asyncRequestId = request.Id;

        getFullOrgFieldCount(this.assessmentId);
    }

    private static void getFullOrgFieldCount(Id assessmentId){
        Integer orgFieldCount = SchemaService.getOrgFieldCount();
        Assessment__c assessment = new Assessment__c(Id = assessmentId, Org_Field_Count__c = orgFieldCount);
        Database.update(assessment);
    }

    public static void createAsyncRequest(Id assessmentId) {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
            Assessment__c = assessmentId,
            AsyncType__c = GetOrgFieldCountQueueable.class.getName(),
            Params__c = assessmentId);

        insertAsyncRequest(asyncRequest);
    }
}