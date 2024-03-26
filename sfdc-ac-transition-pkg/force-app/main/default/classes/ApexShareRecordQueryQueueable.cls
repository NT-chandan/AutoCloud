/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * @Desc:  Provided a list of Share objects, this queries those objects for custom Apex Share Reasons
**/
public inherited sharing class ApexShareRecordQueryQueueable extends AsyncRequestProcessor {

    @TestVisible
    private QueryCriteria queryCriteriaItem;
    
    private static final String ASSESSMENT_FILE_ANALYSIS = 'analysis';

    private void processRequest(AsyncRequest__c request){
        this.queryCriteriaItem = (QueryCriteria) JSON.deserialize(request.Params__c, QueryCriteria.class);

        if( hasSharingReasonsInUse() ){
            updateAssessment(true, false);
        }
    }

    /**
     * @Desc:  Queries __Share object for existence of custom Apex Sharing Reasons
     */
    private Boolean hasSharingReasonsInUse() {

        final String SHARE_QUERY = 'SELECT COUNT(Id), RowCause FROM {0} WHERE RowCause IN ({1}{2}{3}) GROUP BY RowCause';
        final String singleQuote = '\'';
        final String separator = '\',\'';
        String joinedSharingReasons = String.join( this.queryCriteriaItem.sharingReasons, separator );

        String queryString = String.format( SHARE_QUERY, new List<String> {
            queryCriteriaItem.sObjectApiName,
            singleQuote,
            joinedSharingReasons,
            singleQuote
        } );
        List<AggregateResult> sharingReasonQuery = Database.query( queryString );

        if ( !sharingReasonQuery.isEmpty() ) {
            return true;
        }

        return false;
    }

    /**
     *
     * @param hasApexSharing If object has a Custom Apex Share Reason
     * @param isScanComplete If all items have been scanned
     */
    @TestVisible
    private void updateAssessment(Boolean hasApexSharing, Boolean isScanComplete){
        Assessment__c assessment = new Assessment__c(Id = this.queryCriteriaItem.assessmentId);
        if(hasApexSharing){
            assessment.Has_Apex_Sharing__c = true;
        }
        if(isScanComplete){
            assessment.Apex_Sharing_Scan_Complete__c = true;
        }
        AssessmentService.updateAssessment(assessment);
    }

    /**
     * Wrapper to help with processing of multiple objects and Apex Share Reasons
     */
    public class QueryCriteria {
        public Id assessmentId;
        public String sObjectApiName;
        public List<String> sharingReasons;

        public QueryCriteria(Id assessmentId, String sObjectApiName, List<String> sharingReasons){
            this.assessmentId = assessmentId;
            this.sObjectApiName = sObjectApiName;
            this.sharingReasons = sharingReasons;
        }
    }

    public static void createAsyncRequests(Id assessmentId, List<ApexShareRecordQueryQueueable.QueryCriteria> criteria) {
        List<AsyncRequest__c> newAsyncRequests = new List<AsyncRequest__c>();

        for (ApexShareRecordQueryQueueable.QueryCriteria params : criteria)
            newAsyncRequests.add(new AsyncRequest__c(
                Assessment__c = assessmentId,
                AsyncType__c = ApexShareRecordQueryQueueable.class.getName(),
                Params__c = JSON.serialize(params)));

        AsyncRequestProcessor.insertAsyncRequests(newAsyncRequests);

        if (newAsyncRequests.isEmpty()) {
            ApexShareReferenceScanQueueable.createAsyncRequest(assessmentId, null);
        } else {
            ApexShareReferenceScanQueueable.createAsyncRequest(assessmentId, newAsyncRequests.get(newAsyncRequests.size() - 1).Id);
        }
    }
}