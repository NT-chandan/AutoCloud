/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class AsyncRequestTriggerHandler extends TriggerHandler {
    private static TransitionAppSettings appSettings = new TransitionAppSettings();

    public override void afterInsert() {
        enqueueRequests(Trigger.new);
    }

    public override void afterUpdate() {
        retryAsyncRequests((Map<Id, AsyncRequest__c>)Trigger.oldMap, Trigger.new);
    }

    private static void enqueueRequests(List<AsyncRequest__c> asyncRequests) {
        for (AsyncRequest__c request : asyncRequests) {
            if (request.ParentRequest__c == null) {
                TransitionAppSettings.asyncTypesToEnqueue.add(request.AsyncType__c);
            }
        }

        for (String asyncType : TransitionAppSettings.asyncTypesToEnqueue) {
            AsyncRequestProcessor.enqueueJob(null, null, asyncType);
        }
    }

    private static void retryAsyncRequests(Map<Id, AsyncRequest__c> oldAsyncRequestsByIds, List<AsyncRequest__c> newAsyncRequests) {
        for (AsyncRequest__c newAsyncRequest : newAsyncRequests) {
            AsyncRequest__c oldAsyncRequest = oldAsyncRequestsByIds.get(newAsyncRequest.Id);

            if (oldAsyncRequest.Error__c && !newAsyncRequest.Error__c) {
                if (newAsyncRequest.ParentRequest__c != null) {
                    if (!TransitionAppSettings.parentIdsByDependentTypes.containsKey(newAsyncRequest.AsyncType__c))
                        TransitionAppSettings.parentIdsByDependentTypes.put(newAsyncRequest.AsyncType__c, new List<Id>());
                    TransitionAppSettings.parentIdsByDependentTypes.get(newAsyncRequest.AsyncType__c).add(newAsyncRequest.ParentRequest__c);
                } else {
                    TransitionAppSettings.asyncTypesToEnqueue.add(newAsyncRequest.AsyncType__c);
                }
            }
        }

        for (String asyncType : TransitionAppSettings.asyncTypesToEnqueue)
            AsyncRequestProcessor.enqueueJob(null, null, asyncType);

        for (String asyncType : TransitionAppSettings.parentIdsByDependentTypes.keySet()) {
            for (Id parentRequestId : TransitionAppSettings.parentIdsByDependentTypes.get(asyncType)) {
                AsyncRequestProcessor.enqueueJob(null, parentRequestId, asyncType);
            }
        }
    }
}