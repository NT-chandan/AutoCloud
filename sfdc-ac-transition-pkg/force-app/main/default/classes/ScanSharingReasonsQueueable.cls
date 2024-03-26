/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class ScanSharingReasonsQueueable extends AsyncRequestProcessor {
    private Id assessmentId;

    private void processRequest(AsyncRequest__c request) {
        this.assessmentId = request.Params__c;
        queryForSharingReasons(this.assessmentId);
    }

    private void queryForSharingReasons(Id assessmentId) {
        Assessment__c assessment = AssessmentService.queryAssessment(assessmentId);
        MappingService.MappedComponents mapping = MappingService.parseMappedComponents(assessment);

        Map<String, Map<String, String> > customObjectToApexSharingReasons = TransitionAnalysis.getApexSharingReasons(mapping.mappedObjects);

        List<ApexShareRecordQueryQueueable.QueryCriteria> criteria = new List<ApexShareRecordQueryQueueable.QueryCriteria>();

        for (String sObjectApiName : customObjectToApexSharingReasons.keySet()) {
            criteria.add(new ApexShareRecordQueryQueueable.QueryCriteria(
                assessmentId, sObjectApiName, customObjectToApexSharingReasons.get(sObjectApiName).values()));
        }

        assessment.Sub_Status__c = 'Scanning Apex Sharing';
        //assessment.Scan_Status_Sharing_Reasons__c = TransitionReadinessUtility.ASSESSMENT_SUB_STATUS_SUCCESS;

        TriggerHandler.bypass('AssessmentTriggerHandler');
        AssessmentService.updateAssessment(assessment);
        TriggerHandler.clearBypass('AssessmentTriggerHandler');

        if (!criteria.isEmpty()) {
            ApexShareRecordQueryQueueable.createAsyncRequests(assessmentId, criteria);
        } else {
            ApexShareReferenceScanQueueable.createAsyncRequest(assessmentId, null);
        }

    }

    public static void createAsyncRequest(Id assessmentId) {
        AsyncRequest__c asyncRequest = new AsyncRequest__c(
            Assessment__c = assessmentId,
            AsyncType__c = ScanSharingReasonsQueueable.class.getName(),
            Params__c = assessmentId);

        insertAsyncRequest(asyncRequest);
    }

    public override void execute(FinalizerContext ctx) {
        System.ParentJobResult result = ctx.getResult();
        if (result == ParentJobResult.UNHANDLED_EXCEPTION) {
            Exception ex = ctx.getException();
            SystemLogger.log(LoggingLevel.ERROR, ex);
			
            if(test.isRunningTest()){
                deactivate([SELECT Id FROM AsyncRequest__c WHERE AsyncType__c = :ScanSharingReasonsQueueable.class.getName()]);
            }else{
            	deactivate([SELECT Id FROM AsyncRequest__c WHERE AsyncType__c = :ScanSharingReasonsQueueable.class.getName() And Assessment__c = :currentRequest.Assessment__c]);
            }
            List<Assessment__c>  assessments;
            if(test.isRunningTest()){
                assessments = [SELECT Id, Sub_Status__c FROM Assessment__c];
            }else{
            	assessments = [SELECT Id, Sub_Status__c FROM Assessment__c WHERE Id = :currentRequest.Assessment__c LIMIT 1];
            }
            Assessment__c assessment = (assessments.size() == 1) ? assessments.get(0) : null;

            if (assessment != null) {
                //Ensure Status has been changed at least
                assessment.Sub_Status__c = 'Scanning Apex Sharing';
                //assessment.Scan_Status_Sharing_Reasons__c = TransitionReadinessUtility.ASSESSMENT_SUB_STATUS_SUCCESS;

                TriggerHandler.bypass('AssessmentTriggerHandler');
                AssessmentService.updateAssessment(assessment);
                TriggerHandler.clearBypass('AssessmentTriggerHandler');

                //Default to no criteria Queueable
                ApexShareReferenceScanQueueable.createAsyncRequest(assessmentId, null);
            }
        }
    }
}
