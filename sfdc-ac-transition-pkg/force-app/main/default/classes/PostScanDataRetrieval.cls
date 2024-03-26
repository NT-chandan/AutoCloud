/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * REST Service for providing Heroku functions with metadata/records that are protected
 * by the Transition Assistant's managed package rules.
 */
@RestResource(urlMapping='/PostScanData/*')
global with sharing class PostScanDataRetrieval {
    
    @TestVisible private static final String DATA_TYPE_FEATURES = 'features';
    @TestVisible private static final String DATA_TYPE_LIMITS = 'limitsMap';
    @TestVisible private static final String DATA_TYPE_LABELS = 'labels';
    @TestVisible private static final String DATA_TYPE_FIELD_COUNT = 'fieldcount';
    @TestVisible private static final String DATA_TYPE_INSTALL_READINESS = 'installReadiness';
    @TestVisible private static final String DATA_TYPE_OVERALL_REC = 'overallRec';

    //HC-Specific
    @TestVisible private static final String DATA_TYPE_ANSWERS = 'answers';
    @TestVisible private static final String DATA_TYPE_HC_RECS = 'hcRecs';
    

    @HttpGet
    global static String doGet() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.statuscode = 200;

        String dataType = req.requestURI.substring(req.requestURI.lastIndexOf('/')+1);

        //Get SFDC_Feature__mdt records
        if(dataType.equals(DATA_TYPE_FEATURES)){
            return JSON.serialize(SFDC_Feature__mdt.getAll().values());
        }else if(dataType.equals(DATA_TYPE_LIMITS)){
            return JSON.serialize(OrgLimits.getMap());
        }else if(dataType.equals(DATA_TYPE_FIELD_COUNT)){
            return ''+SchemaService.getOrgFieldCount();
        }else if(dataType.equals(DATA_TYPE_INSTALL_READINESS)){
            return JSON.serialize(TransitionReadinessUtility.getFscInstallationReadiness());
        }else if(dataType.equals(DATA_TYPE_ANSWERS)){
            return JSON.serialize([SELECT Id, DeveloperName, Question_Label__c, Question__r.Question_Group__r.MasterLabel FROM SFDC_Industry_Assessment_Answer__mdt]);
        }else if(dataType.equals(DATA_TYPE_HC_RECS)){
            return JSON.serialize([SELECT DeveloperName, Answer_API_Name__c, Icon_Name__c, Render_Flags__c, Recommendation_Label__c FROM SFDC_Health_Cloud_Recommendation__mdt WHERE Section__r.DeveloperName = 'AssessmentResults' Order By List_Index__c]);
        }

        res.statuscode = 404;
        return '';
    }

    @HttpPost
    global static String doPost(List<String> items){
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.statuscode = 200;

        String dataType = req.requestURI.substring(req.requestURI.lastIndexOf('/')+1);

        //Generate Overall Recommendation
        if(dataType.equals(DATA_TYPE_OVERALL_REC)){
            Assessment__c assessment = TransitionReadinessUtility.getAssessment(items[0]);
            TransitionReadinessUtility.ReadinessResults results = TransitionReadinessUtility.loadReadinessResults(assessment);
            if(!Test.isRunningTest()){
                TransitionReadinessUtility.injectApexSharingRecommendations(assessment, results);
                results.overallRecommendation = TransitionReadinessUtility.generateOverallRecommendation(results);
            }
            assessment.AnalysisDataJSON__c = results.toString();
            AssessmentService.updateAssessment(assessment);

            return 'success';
        }

        res.statuscode = 404;
        return '';
    }
}