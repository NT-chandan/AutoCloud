/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**************************************************************************************
 * Contains functions related to the "Customize Report" sidebar component
 * 
 * Story: FSCTA-1626
 **************************************************************************************/

public with sharing class AssessmentConfigController {

    public static final String SECTION_NAME_SUMMARY = 'ReportSummary';

    @AuraEnabled
    public static List<ReportSection> getReportSections() {
        List<ReportSection> sectionList = new List<ReportSection>();
        String query = 'Select Id, DeveloperName, Title_Label_Name__c, Sort_Order__c FROM Assessment_Report_Section__mdt WHERE Sort_Order__c != null ORDER BY Sort_Order__c ASC';

        //Query Custom Metadata Type
        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
        List<Assessment_Report_Section__mdt> sections = (List<Assessment_Report_Section__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<Assessment_Report_Section__mdt>.class);

        String query2 = 'Select Id, DeveloperName, Title_Label_Name__c, Sort_Order__c FROM Assessment_Report_Subsection__mdt WHERE Assessment_Report_Section__r.DeveloperName = \''+SECTION_NAME_SUMMARY+'\' ORDER BY Sort_Order__c ASC';

        //Query Custom Metadata Type
        List<Object> metaRecords2 = ExternalUtilities.getCustomMetadata(new List<String>{query2});
        List<Assessment_Report_Subsection__mdt> summarySections = (List<Assessment_Report_Subsection__mdt>) JSON.deserialize(JSON.serialize(metaRecords2[0]), List<Assessment_Report_Subsection__mdt>.class);

        //Assemble sections in order
        for (Assessment_Report_Section__mdt section : sections) {
            sectionList.add(new ReportSection(ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + section.Title_Label_Name__c), section.DeveloperName));
            if(section.DeveloperName.equals(SECTION_NAME_SUMMARY)){
                for (Assessment_Report_Subsection__mdt summarySection : summarySections) {
                    sectionList.add(new ReportSection('- '+ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + summarySection.Title_Label_Name__c), summarySection.DeveloperName));
                }
            }
        }

        return sectionList;
    }
    
    @AuraEnabled
    public static MetaDescribeContainer getMetadataDescribe(){
        MetaDescribeContainer metaContainer = new MetaDescribeContainer();

        //Call out Heroku for /describemetadata
        String metaJSON = ExternalUtilities.getOrgMetadata();

        if(!String.isBlank(metaJSON)){
            metaContainer = (MetaDescribeContainer) JSON.deserialize(metaJSON, MetaDescribeContainer.class);
        }

        return metaContainer;
    }

    @AuraEnabled
    public static ReportConfigContainer getReportConfig(){
        ReportConfigContainer metaContainer = new ReportConfigContainer();

        //Call out Heroku for /describemetadata
        String metaJSON = ExternalUtilities.getReportConfig();
        System.debug('==Response: '+metaJSON);

        if(!String.isBlank(metaJSON)){
            metaContainer = (ReportConfigContainer) JSON.deserialize(metaJSON, ReportConfigContainer.class);
        }

        System.debug('==Config: '+metaContainer);

        return metaContainer;
    }

    @AuraEnabled
    public static String saveReportConfig(List<String> sections, List<String> meta){
        MetaDescribeContainer metaContainer = new MetaDescribeContainer();

        //Call out Heroku for /describemetadata
        String saveResponse = ExternalUtilities.setReportConfig(sections, meta);

        return saveResponse;
    }

    //Overall Container
    public class ReportConfigContainer {
        @AuraEnabled
        public List<String> ExcludedSections {get;set;}
        @AuraEnabled
        public List<String> ExcludedMetadata {get;set;}

        public ReportConfigContainer(){}

    }

    //DataTable view

    public class ReportSection {
        @AuraEnabled
        public String name;

        @AuraEnabled
        public String apiName;

        public ReportSection(String name, String apiName){
            this.name = name;
            this.apiName = apiName;
        }
    }

    public class MetaDescribeContainer {
        @AuraEnabled
        public List<String> excludedMetadata {get;set;}
        @AuraEnabled
        public List<MetadataDef> metadataList {get;set;}

        public MetaDescribeContainer(){
            this.excludedMetadata = new List<String>();
            this.metadataList = new List<MetadataDef>();
        }
    }

    public class MetadataDef {
        @AuraEnabled 
        public String metadataId {get;set;}
        @AuraEnabled 
        public String name {get;set;}
    }
}