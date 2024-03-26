/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public with sharing class HealthCloudMenuController {

    private static Map<Id, SFDC_Industry_Vertical__mdt> chosenVerticals;
    private static Map<String, List<SFDC_Industry_Assessment_Answer__mdt>> parentIdToFollowUpMap;
    @TestVisible
    static Map<String, List<SFDC_Industry_Mapping_Object__mdt>> objectMap {
        get {
            if(objectMap == null) {
                String query = 'SELECT Id, DeveloperName, MasterLabel, Object_API_Name__c, Assessment_Label__c FROM SFDC_Industry_Mapping_Object__mdt';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Mapping_Object__mdt> objMetadata = (List<SFDC_Industry_Mapping_Object__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Mapping_Object__mdt>.class);

                objectMap = Utilities.groupByStrings('DeveloperName', objMetadata);
            }
            return objectMap;
        }
        set;
    }
    @TestVisible
    private static String PERSON_ACCOUNT_NAME = 'PersonAccount';

    //For storing current mapping
    public static Map<String, MappingService.ObjectMapping> sectionNameToExistingMapping;
    public static String screenName = '';
    
    @AuraEnabled
    public static List<SFDC_Industry_Assessment_Question_Group__mdt> getMenuItems(String assessmentId){
        Assessment__c assessment = [SELECT Selected_Products__c FROM Assessment__c WHERE Id = :assessmentId LIMIT 1];
        List<String> verticals = assessment.Selected_Products__c.split(';');

        String query = 'SELECT Id FROM SFDC_Industry_Vertical__mdt WHERE Value__c In {0}';
        String inClause = '( ';
        for (String vertical : verticals) {
            if(inClause == '( '){
                inClause += '\''+ vertical +'\'';
            }else{
                inClause += ',\''+ vertical +'\'';
            }
            
        }
        inClause += ')';
        query = query.replace('{0}', inClause);

        String query2 = 'SELECT Id, MasterLabel, DeveloperName, Sort_Order__c, Vertical__c FROM SFDC_Industry_Assessment_Question_Group__mdt ORDER BY Sort_Order__c';

        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query, query2});
        List<SFDC_Industry_Vertical__mdt> verticalMeta = (List<SFDC_Industry_Vertical__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Vertical__mdt>.class);
        List<SFDC_Industry_Assessment_Question_Group__mdt> groupList = (List<SFDC_Industry_Assessment_Question_Group__mdt>) JSON.deserialize(JSON.serialize(metaRecords[1]), List<SFDC_Industry_Assessment_Question_Group__mdt>.class);


        Map<Id, SFDC_Industry_Vertical__mdt> chosenVerticals = new Map<Id, SFDC_Industry_Vertical__mdt>(verticalMeta);

        List<SFDC_Industry_Assessment_Question_Group__mdt> filteredList = new List<SFDC_Industry_Assessment_Question_Group__mdt>();
		Set<String>filteredListAddedItems = new Set<String>();
        for (SFDC_Industry_Assessment_Question_Group__mdt qGroup : groupList) {
            if(String.isBlank(qGroup.Vertical__c) || (chosenVerticals.keySet().contains(qGroup.Vertical__c))
              && (!filteredListAddedItems.contains(qGroup.MasterLabel))){
                filteredListAddedItems.add(qGroup.MasterLabel);
                filteredList.add(qGroup);
            }
        }
        return filteredList;
    }

    @AuraEnabled
    public static SectionData getSectionByGroupId(String assessmentId, String groupId, String screenIndex){
        String query = 'Select Id, MasterLabel FROM SFDC_Industry_Assessment_Question_Group__mdt WHERE Id = \''+groupId+'\' LIMIT 1';

        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        SFDC_Industry_Assessment_Question_Group__mdt currentGroup = ((List<SFDC_Industry_Assessment_Question_Group__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Question_Group__mdt>.class))[0];

        screenName = currentGroup.MasterLabel;
        String mappingJSON = MappingService.getMappingJSON(assessmentId);
        MappingService.UpgradeMapping mappingStructure;
        sectionNameToExistingMapping = new Map<String, MappingService.ObjectMapping>();
        if(!String.isBlank(mappingJSON)){
            mappingStructure = (MappingService.UpgradeMapping) JSON.deserialize(mappingJSON, MappingService.UpgradeMapping.class);
            //Populate section map
            for (MappingService.ObjectMapping recMapping : mappingStructure.recommended) {
                sectionNameToExistingMapping.put(recMapping.sectionName, recMapping);
            }
        }

        SectionData currentSection = new SectionData();

        Assessment__c assessment = [SELECT Selected_Products__c, Current_Question_Id__c FROM Assessment__c WHERE Id = :assessmentId LIMIT 1];
        List<String> verticals = assessment.Selected_Products__c.split(';');

        query = 'SELECT Id FROM SFDC_Industry_Vertical__mdt WHERE Value__c In {0}';
        String inClause = '( ';
        for (String vertical : verticals) {
            if(inClause == '( '){
                inClause += '\''+ vertical +'\'';
            }else{
                inClause += ',\''+ vertical +'\'';
            }   
        }
        inClause += ')';
        query = query.replace('{0}', inClause);

        String query2 = 'SELECT Id, MasterLabel, DeveloperName, Answer_Field_API_Name__c, Question_Group__c, Summary_Label_Name__c, Question_Label_Name__c FROM SFDC_Industry_Assessment_Question__mdt WHERE Question_Group__c = \'' + groupId + '\' Order By DeveloperName';

        metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query, query2});
        chosenVerticals = new Map<Id, SFDC_Industry_Vertical__mdt>((List<SFDC_Industry_Vertical__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Vertical__mdt>.class));
        Map<Id, SFDC_Industry_Assessment_Question__mdt> questions = new Map<Id, SFDC_Industry_Assessment_Question__mdt>((List<SFDC_Industry_Assessment_Question__mdt>) JSON.deserialize(JSON.serialize(metaRecords[1]), List<SFDC_Industry_Assessment_Question__mdt>.class));
        
        String query3 = 'SELECT Id, DeveloperName, Help_Text_Label__c, Mapped_Objects__c, Question_Label__c, Question__c, Required_Vertical__c, Index__c, Follow_Up_To__c, Verbose_Help_Text_Label__c, Bottom_Help_Text_Label__c FROM SFDC_Industry_Assessment_Answer__mdt WHERE Question__c In {0} ORDER BY Index__c';
        inClause = '( ';
        for (String vertical : questions.keySet()) {
            if(inClause == '( '){
                inClause += '\''+ vertical +'\'';
            }else{
                inClause += ',\''+ vertical +'\'';
            }     
        }
        inClause += ')';
        query3 = query3.replace('{0}', inClause);


        metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query3});
        List<SFDC_Industry_Assessment_Answer__mdt> answers = (List<SFDC_Industry_Assessment_Answer__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Assessment_Answer__mdt>.class);


        Map<Id, List<SFDC_Industry_Assessment_Answer__mdt>> questionIdToAnswerMap = new Map<Id, List<SFDC_Industry_Assessment_Answer__mdt>>();

        parentIdToFollowUpMap = new Map<String, List<SFDC_Industry_Assessment_Answer__mdt>>();
        List<SFDC_Industry_Assessment_Answer__mdt> tempAnswerList;
        for (SFDC_Industry_Assessment_Answer__mdt answer : answers) {
            if(String.isBlank(answer.Follow_Up_To__c)){
                tempAnswerList = (questionIdToAnswerMap.containsKey(answer.Question__c)) ? questionIdToAnswerMap.get(answer.Question__c) : new List<SFDC_Industry_Assessment_Answer__mdt>();
                tempAnswerList.add(answer);
                questionIdToAnswerMap.put(answer.Question__c, tempAnswerList);
            }else{
                tempAnswerList = (parentIdToFollowUpMap.containsKey(answer.Follow_Up_To__c)) ? parentIdToFollowUpMap.get(answer.Follow_Up_To__c) : new List<SFDC_Industry_Assessment_Answer__mdt>();
                tempAnswerList.add(answer);
                parentIdToFollowUpMap.put(answer.Follow_Up_To__c, tempAnswerList);
            }  
        }

        for (SFDC_Industry_Assessment_Question__mdt question : questions.values()) {
            if(questionIdToAnswerMap.containsKey(question.Id)){
                currentSection.questions.add(new MultiSelectQuestion(questionIdToAnswerMap.get(question.Id), question.Question_Label_Name__c, question.Summary_Label_Name__c));
            }else{
                currentSection.questions.add(new SingleSelectQuestion(question.Question_Label_Name__c, question.Summary_Label_Name__c));
            }
        }
        if (currentSection.questions.size()>0) {
            currentSection.questions[0].show = true;
        }

        return currentSection;
    }

    @AuraEnabled
    public static void saveMapping(Id assessmentId, String mappings, String screenId, String nextQuestionIndex) {
        //Get existing mapping
        List<MappingService.ObjectMapping> mappingsObject = (List<MappingService.ObjectMapping>) JSON.deserialize(mappings, List<MappingService.ObjectMapping>.class);
        String mappingJSON = MappingService.getMappingJSON(assessmentId);
        MappingService.UpgradeMapping mappingStructure;
        if(mappingsObject.size()>0){
            //Iterate and create a Set of section names
            Map<String, MappingService.ObjectMapping> sectionNamesToSectionMap = new Map<String, MappingService.ObjectMapping>();
            for (MappingService.ObjectMapping section : mappingsObject) {
                sectionNamesToSectionMap.put(section.sectionName, section);
            }
            if(!String.isBlank(mappingJSON)){
                System.debug('Existing File');
                mappingStructure = (MappingService.UpgradeMapping) JSON.deserialize(mappingJSON, MappingService.UpgradeMapping.class);
                //Check existing sections for screenId and (potentially) replace existing sections
                for (Integer i = 0; i < mappingStructure.recommended.size(); i++) {
                    if(mappingStructure.recommended[i].screenId == screenId){
                        if(sectionNamesToSectionMap.containsKey(mappingStructure.recommended[i].sectionName)){
                            //Check if objects are the same or not
                            for (Integer j = 0; j < mappingStructure.recommended[i].mappingData.size(); j++) {
                                if(mappingStructure.recommended[i].mappingData[j].source != sectionNamesToSectionMap.get(mappingStructure.recommended[i].sectionName).mappingData[j].source){
                                    mappingStructure.recommended[i].mappingData[j] = sectionNamesToSectionMap.get(mappingStructure.recommended[i].sectionName).mappingData[j];
                                }
                            }          
                            sectionNamesToSectionMap.remove(mappingStructure.recommended[i].sectionName);
                        }else{
                            //Remove this section
                            mappingStructure.recommended.remove(i);
                            i--;
                        }
                    }
                }
                //Add any additional sections not found
                for (MappingService.ObjectMapping newSection : sectionNamesToSectionMap.values()) {
                    mappingStructure.recommended.add(newSection);
                }
                //Sort current JSON
                //mappingStructure.recommended.sort();
            }else{
                System.debug('New File');
                mappingStructure = new MappingService.UpgradeMapping();
                mappingStructure.recommended = mappingsObject;
                mappingStructure.additional = new List<MappingService.MappingSelection>();
            }
            System.debug('==To Save: '+mappingStructure);
            MappingService.saveMapping(assessmentId, MappingService.FILENAME_MAPPINGJSON, MappingService.FILEEXTENSION_MAPPINGJSON, JSON.serialize(mappingStructure), false);
        }else{
            //Remove all items from this screen (if applicable)
            if(!String.isBlank(mappingJSON)){
                System.debug('Existing File');
                mappingStructure = (MappingService.UpgradeMapping) JSON.deserialize(mappingJSON, MappingService.UpgradeMapping.class);
                //Check existing sections for screenId and (potentially) replace existing sections
                for (Integer i = 0; i < mappingStructure.recommended.size(); i++) {
                    if(mappingStructure.recommended[i].screenId == screenId){
                        //Remove this section
                        mappingStructure.recommended.remove(i);
                        i--;
                    }
                }
                //Sort current JSON
                //mappingStructure.recommended.sort();
                System.debug('==To Save: '+mappingStructure);
                MappingService.saveMapping(assessmentId, MappingService.FILENAME_MAPPINGJSON, MappingService.FILEEXTENSION_MAPPINGJSON, JSON.serialize(mappingStructure), false);
            }
        }
        //Track current screen index
        trackScreen(assessmentId, nextQuestionIndex);
    }

    @AuraEnabled
    public static void trackScreen(Id assessmentId, String nextQuestionIndex) {
        Assessment__c currentAssessment = AssessmentService.queryAssessment(assessmentId);
        currentAssessment.Current_Question_Id__c = nextQuestionIndex;
        AssessmentService.updateAssessment(currentAssessment);
    }

    /** WRAPPER OBJECTS **/

    public class SectionData {

        @AuraEnabled
        public List<QuestionData> questions;

        public SectionData(){
            this.questions = new List<QuestionData>();
        }
    }

    public virtual class QuestionData {

        @AuraEnabled
        public String questionText {get;set;}
        @AuraEnabled
        public String summaryText {get;set;}
        @AuraEnabled
        public Boolean show {get;set;}

        public QuestionData(String questionLabel, String summaryLabel){
            this.questionText = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + questionLabel);
            if(!String.isBlank(summaryLabel) && summaryLabel.contains(';')){
                List<String> labels = summaryLabel.split(';');
                String finalString = '';
                for (String label : labels) {
                    finalString += ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + label);
                }
                this.summaryText = finalString;
            }else{
                this.summaryText = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + summaryLabel);
            }
            
            this.show = false;
        }
    }

    //TODO: Make this more dynamic + move to labels
    public class SingleSelectQuestion extends QuestionData {

        @AuraEnabled
        public String answer {get;set;}

        public SingleSelectQuestion(String questionLabel, String summaryLabel){
            super(questionLabel, summaryLabel);
        }
    }

    public class MultiSelectQuestion extends QuestionData {

        @AuraEnabled
        public List<Option> options {get;set;}

        public MultiSelectQuestion(List<SFDC_Industry_Assessment_Answer__mdt> answers, String questionLabel, String summaryLabel){
            super(questionLabel, summaryLabel);
            this.options = new List<Option>();
            for (SFDC_Industry_Assessment_Answer__mdt answer : answers) {
                if(String.isBlank(answer.Required_Vertical__c) || chosenVerticals.keySet().contains(answer.Required_Vertical__c)){
                    this.options.add(new Option(answer));
                } 
            }
            this.options.sort();
        }
    }

    public class Option implements Comparable {

        @AuraEnabled
        public String Id {get;set;}
        @AuraEnabled
        public String HelpTextLabel {get;set;}
        @AuraEnabled
        public String VerboseHelpTextLabel {get;set;} 
        @AuraEnabled
        public String BottomHelpTextLabel {get;set;}
        @AuraEnabled
        public List<MappingService.MappingSelection> MappedObjects {get;set;}
        @AuraEnabled
        public String QuestionLabel {get;set;}
        @AuraEnabled
        public String QuestionId {get;set;}
        @AuraEnabled
        public Boolean Show {get;set;}
        @AuraEnabled
        public Decimal Index {get;set;}
        @AuraEnabled
        public List<Option> followUp {get;set;}

        public Option(SFDC_Industry_Assessment_Answer__mdt answer){
            //TODO: Grab the proper MappingSelection definitions
            this.Id = answer.Id;
            this.HelpTextLabel = answer.Help_Text_Label__c;
            this.QuestionLabel = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + answer.Question_Label__c);
            this.HelpTextLabel = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + answer.Help_Text_Label__c);
            if(!String.isBlank(answer.Verbose_Help_Text_Label__c) && answer.Verbose_Help_Text_Label__c.contains(';')){
                List<String> labels = answer.Verbose_Help_Text_Label__c.split(';');
                String finalString = '';
                for (String label : labels) {
                    finalString += ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + label);
                }
                this.VerboseHelpTextLabel = finalString;
            }else if(!String.isBlank(answer.Verbose_Help_Text_Label__c)){
                this.VerboseHelpTextLabel = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + answer.Verbose_Help_Text_Label__c);
            }
            if(!String.isBlank(answer.Bottom_Help_Text_Label__c)){
                this.BottomHelpTextLabel = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + answer.Bottom_Help_Text_Label__c);
            }
            this.QuestionId = answer.Question__c;
            this.Index = answer.Index__c;
            this.Show = false;
            this.MappedObjects = new List<MappingService.MappingSelection>();
            MappingService.MappingSelection tempSelection;
            if(!String.isBlank(answer.Mapped_Objects__c)){
                for (String objectName : answer.Mapped_Objects__c.split(';')) {
                    System.debug('==Object Name: '+objectName);
                    SFDC_Industry_Mapping_Object__mdt objData = objectMap.get(objectName)[0];
                    if(objData!=null){
                        tempSelection = new MappingService.MappingSelection();
                        String nameToCheck = screenName + ' - ' + this.QuestionLabel;
                        //See if we can populate source
                        tempSelection.source = '';
                        if(sectionNameToExistingMapping.containsKey(nameToCheck)){
                            for (MappingService.MappingSelection selection : sectionNameToExistingMapping.get(nameToCheck).mappingData) {
                                System.debug('Recorded Meta Name: '+selection.destinationObjectMetaName);
                                System.debug('Dev Name: '+objData.DeveloperName);
                                System.debug('Source: '+selection.source);
                                if(!String.isBlank(selection.destinationObjectMetaName) && selection.destinationObjectMetaName.equals(objData.DeveloperName)){
                                    tempSelection.source = selection.source;
                                    this.Show = true;
                                    break;
                                }else if(selection.destination.equals(objData.Object_API_Name__c)){
                                    tempSelection.source = selection.source;
                                    this.Show = true;
                                }
                            }
                        }
                        tempSelection.destination = objData.Object_API_Name__c;
                        tempSelection.destinationLabel = objData.Object_API_Name__c;
                        tempSelection.destinationObjectMetaName = objData.DeveloperName;
                        if(objData.DeveloperName.contains(PERSON_ACCOUNT_NAME)){
                            tempSelection.destinationLabel = PERSON_ACCOUNT_NAME;
                        }
                        if(!String.isBlank(objData.Assessment_Label__c)){
                            tempSelection.assessmentDescription = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + objData.Assessment_Label__c);
                        }
                        this.MappedObjects.add(tempSelection);
                    }
                }
            }
            

            //Set follow up if present
            if(parentIdToFollowUpMap.containsKey(answer.DeveloperName)){
                List<Option> optionList = new List<Option>();
                for (SFDC_Industry_Assessment_Answer__mdt followUpAnswer : parentIdToFollowUpMap.get(answer.DeveloperName)) {
                    optionList.add(new Option(followUpAnswer));
                }
                this.followUp = optionList;
            }
            //If any follow-ups have "show", show this one (edge case for empty Care Plan checkbox)
            if(this.followUp!=null){
                for (Option opt : this.followUp) {
                    if(opt.Show){
                        this.Show = true;
                    }
                }
            }   
        }

        public Integer compareTo(Object compareTo) {
            Option compareToOption = (Option) compareTo; 
            if (Index == compareToOption.Index) return 0;
            if (Index > compareToOption.Index) return 1;
            return -1;
        }
    }

    /** END WRAPPER OBJECTS **/
}