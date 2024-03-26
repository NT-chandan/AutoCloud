/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/***********************************************************************************
 * Class used for discerning specific data points, based on the selection of 
 * items within the assessment (aka The composition and presence of section 
 * names within the mapping JSON file)
 **********************************************************************************/

public inherited sharing class HealthCloudSelectionHelper {

    private static String FILENAME_MAPPINGJSON {get{return (String.isBlank(FILENAME_MAPPINGJSON)) ? Label.MappingJsonTitle : FILENAME_MAPPINGJSON;}set;}

    private static String mappingJSON;
    private static String sectionJSONForm = '"sectionName":"{0}"';

    /***********************************************************************************
     * Helper to populate an assessment's MappingJSON file for use within this class
     **********************************************************************************/
    private static void getMappingJSON(Id recordId){
        if(mappingJSON==null){
            mappingJSON = FileUtility.readFileDataString(recordId, FILENAME_MAPPINGJSON);
        }
    }

    /***********************************************************************************
     * Given an assessment Id and the SFDC_Industry_Assessment_Answer__mdt record's
     * API/Developer Name, checks if the current assessment contains the corresponding
     * mapping section
     **********************************************************************************/
    public static Boolean checkSectionName(Id recordId, String answerApiName){
        SFDC_Industry_Assessment_Answer__mdt matchingAnswer;

        String query = 'Select Id, DeveloperName, Question_Label__c, Question__r.Question_Group__r.MasterLabel From SFDC_Industry_Assessment_Answer__mdt Where DeveloperName = \'' + answerApiName + '\'';

        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        List<SFDC_Industry_Assessment_Answer__mdt> answerList = (List<SFDC_Industry_Assessment_Answer__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Answer__mdt>.class);

        if(answerList.size()>0){
            matchingAnswer = answerList[0];
            getMappingJSON(recordId);

            //Get Section Label Name (TODO: Update Question Groups to have a dedicated label field)
            String sectionName = String.format(sectionJSONForm, new List<Object>{matchingAnswer.Question__r.Question_Group__r.MasterLabel + ' - ' + ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + (String) matchingAnswer.Question_Label__c)});
            return mappingJSON != null && mappingJSON.contains(sectionName);
        }
        return false;
    }
}