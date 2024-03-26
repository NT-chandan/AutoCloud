/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Retrieve and process component metadata dependencies
 */
public inherited sharing class ScanComponentDependenciesQueueable extends AsyncRequestProcessor {
    public static Id asyncRequestId;
    private Id assessmentId;

    private void processRequest(AsyncRequest__c request) {
        this.assessmentId = request.Params__c;
        asyncRequestId = request.Id;

        scanComponentDependencies(this.assessmentId);
    }

    private static void scanComponentDependencies(Id assessmentId){
        MappingService.MappedComponents mapping = MappingService.parseMappedComponents(TransitionReadinessUtility.getAssessment(assessmentId));
        ExternalUtilities.initiateBulkDependencyScan(assessmentId, mapping);
    }

    public static void createAsyncRequest(Id assessmentId) {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
            Assessment__c = assessmentId,
            AsyncType__c = ScanComponentDependenciesQueueable.class.getName(),
            Params__c = assessmentId);

        insertAsyncRequest(asyncRequest);
    }

    public override void execute(FinalizerContext ctx) {
        System.ParentJobResult result = ctx.getResult();
        if (result == ParentJobResult.UNHANDLED_EXCEPTION) {
            Exception ex = ctx.getException();
            SystemLogger.log(LoggingLevel.ERROR, ex);

            currentRequest.Error__c = true;
            currentRequest.ErrorMessage__c = ctx.getException().getMessage();
            currentRequest.NumberOfAttempts__c++;
            updateAsyncRequest(currentRequest);

            List<Assessment__c> assessments = [SELECT Id, Status__c, Sub_Status__c, Apex_Sharing_Scan_Complete__c FROM Assessment__c WHERE Id = :currentRequest.Assessment__c LIMIT 1];
            Assessment__c assessment = (assessments.size() == 1) ? assessments.get(0) : null;

            if (assessment != null) {
                if (!assessment.Apex_Sharing_Scan_Complete__c) {
                    assessment.Status__c = TransitionReadinessUtility.ASSESSMENT_STATUS_SCAN;
                    assessment.Sub_Status__c = TransitionReadinessUtility.ASSESSMENT_SUBSTATUS_APEX_SHARE_SCAN;
                    AssessmentService.updateAssessment(assessment);
        
                    ScanSharingReasonsQueueable.createAsyncRequest(assessment.Id);
                } else {
                    deactivate([SELECT Id FROM AsyncRequest__c WHERE Id = :currentRequest.Id]);
                }
            }
        }
    }
}