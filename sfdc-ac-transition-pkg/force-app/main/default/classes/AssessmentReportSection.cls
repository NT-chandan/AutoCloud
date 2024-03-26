/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Apex access to Report Section and Report Subsection custom metadata records
 */

public without sharing class AssessmentReportSection {
    @TestVisible
    private static Map<Id, List<MdtConfig>> configsCachedByAssessmentId = new Map<Id, List<MdtConfig>>();

    private static final String sectionTitleLabelName = Utilities.namespaceUnderscore + 'Title_Label_Name__c';
    private static final String sectionRenderFlags = Utilities.namespaceUnderscore + 'Render_Flags__c';
    private static final String sectionBodyLabelName = Utilities.namespaceUnderscore + 'Body_Label_Name__c';
    private static final String sectionSortOrder = Utilities.namespaceUnderscore + 'Sort_Order__c';
    private static final String sectionDeveloperName = 'DeveloperName';

    public class MdtConfig implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String title;
        @AuraEnabled public String body;
        @AuraEnabled public String imageHeight;
        @AuraEnabled public String imageWidth;
        @AuraEnabled public List<MdtConfig> subsections = new List<MdtConfig>();

        @AuraEnabled public Boolean isImage {
            get {
                return this.imageWidth != null;
            }
            private set;
        }

        private Integer sortOrder;
        private Boolean render = true;
        private List<String> renderFlags;

        private Id orgId {
            get {
                if (orgId == null) {
                    orgId = UserInfo.getOrganizationId();
                }
                return orgId;
            } set;
        }

        public MdtConfig(Assessment_Report_Subsection__mdt source) {
            this((SObject) source);

            if (String.isNotBlank(source.Image_Width__c)) {
                imageWidth = source.Image_Width__c;
            }
            if (String.isNotBlank(source.Image_Height__c)) {
                imageHeight = source.Image_Height__c;
            }
            if (isImage) {
                body = '/file-asset/' + Utilities.namespaceUnderscore + source.Body_Label_Name__c + '?oid=' + orgId;
            } else {
                body = ToolingService.customLabelMap.get(
                    Utilities.namespaceUnderscore + (String) source.get(sectionBodyLabelName));
            }
        }

        public MdtConfig(Assessment_Report_Section__mdt source) {
            this((SObject) source);
        }

        public MdtConfig(List<Assessment_Report_Subsection__mdt> sources) {
            this(sources[0]);

            for (Integer i = 0; i < sources.size(); i++) {
                if (i == 0) continue;
                body += ToolingService.customLabelMap.get(
                    Utilities.namespaceUnderscore + (String) sources.get(i).Body_Label_Name__c);
            }
        }

        // Constructor that sets default values
        public MdtConfig(String mdName) {
            name = mdName;
        }

        private MdtConfig(SObject source) {
            id = source.Id;
            name = (String) source.get(sectionDeveloperName);
            sortOrder = Integer.valueOf(source.get(sectionSortOrder));
            renderFlags = source.get(sectionRenderFlags) != null ?
                (List<String>) ((String) source.get(sectionRenderFlags)).split(',') : new List<String>();
            title = ToolingService.customLabelMap.get(
                Utilities.namespaceUnderscore + (String) source.get(sectionTitleLabelName));
        }

        public Integer compareTo(Object compareTo) {
            MdtConfig compareToConfig = (MdtConfig) compareTo;
            if (sortOrder == compareToConfig.sortOrder) return 0;
            if (sortOrder > compareToConfig.sortOrder) return 1;
            return -1;
        }

        public void calculateRender(Assessment__c assessment) {
            try {
                List<MdtConfig> configs = new List<MdtConfig>{ this };
                configs.addAll(this.subsections);

                for (Integer i = configs.size() - 1; i >= 0; i--) {
                    MdtConfig config = configs.get(i);

                    if (!config.renderFlags.isEmpty() && config.render) {
                        for (String flag : config.renderFlags) {
                            flag = flag.trim();

                            //detect a populated field or true value
                            System.debug('==Flag: '+flag);
                            System.debug('==Value: '+assessment.get(Utilities.namespaceUnderscore+flag));
                            Object fieldValue = assessment.get(Utilities.namespaceUnderscore+flag);
                            if (fieldValue != null && fieldValue instanceof Boolean && !Boolean.valueOf(fieldValue) ||
                                String.isBlank(String.valueOf(fieldValue)) && !(fieldValue instanceof Boolean)) {
                                config.render = false;
                            }
                            System.debug('==Render? '+config.render);
                            // remove subsections
                            if (!config.render && i != 0) {
                                this.subsections.remove(i - 1);
                                break;
                            }
                        }
                    }
                }
            } catch (SObjectException ex) {
                SystemLogger.log(LoggingLevel.ERROR, ex, assessment.Id);
            }
        }
    }

    /**
     * Return section metadata relevant to a specific assessment
     *
     * @return - List of AssessmentReportSection.MdtConfig pertaining to the assessment
     */
    public static List<MdtConfig> getConfigsForAssessment(Id assessmentId) {
        List<MdtConfig> mdtConfigs = configsCachedByAssessmentId.get(assessmentId);

        if (mdtConfigs != null) {
            return mdtConfigs;
        }

        mdtConfigs = createConfigs(assessmentId);

        if (mdtConfigs.isEmpty() || Test.isRunningTest()) {
            mdtConfigs = new List<MdtConfig>{ new MdtConfig('Default') };
        }

        configsCachedByAssessmentId.put(assessmentId, mdtConfigs);

        return mdtConfigs;
    }

    private static List<MdtConfig> createConfigs(Id assessmentId) {
        List<MdtConfig> mdtConfigs = new List<MdtConfig>();
        Pattern splitPattern = Pattern.compile('^(\\w*)_[0-9]+$');
        Set<String> renderFlags = new Set<String>();

        // OLD 
        // SOQL within the for loop is strategic to avoid a known bug occurring with the use of
        // ORDER BY clauses within sub-queries for custom metadata causing only the first child to be returned.
        String sectionQuery = 'SELECT Id, DeveloperName, Title_Label_Name__c, Sort_Order__c, Render_Flags__c FROM Assessment_Report_Section__mdt WHERE Sort_Order__c != NULL ORDER BY Sort_Order__c';
        String subSectionBase = 'SELECT Id, DeveloperName, Title_Label_Name__c, Body_Label_Name__c, Sort_Order__c, Render_Flags__c, Assessment_Report_Section__c, Image_Width__c, Image_Height__c FROM Assessment_Report_Subsection__mdt WHERE Assessment_Report_Section__c IN {0} AND Sort_Order__c != NULL ORDER BY Sort_Order__c';

        List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{sectionQuery});
        List<Assessment_Report_Section__mdt> sectionMetadata = (List<Assessment_Report_Section__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<Assessment_Report_Section__mdt>.class);


        //NEW Grab Id's so we can avoid for-loop query
        String inClause = '( ';
        for (Assessment_Report_Section__mdt section : sectionMetadata) {
            if(inClause == '( '){
                inClause += '\''+ section.Id +'\'';
            }else{
                inClause += ',\''+ section.Id +'\'';
            }
            
        }
        inClause += ')';
        subSectionBase = subSectionBase.replace('{0}', inClause);

        System.debug('==Subquery: ' + subSectionBase);
        metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{subSectionBase});
        List<Assessment_Report_Subsection__mdt> subsectionMetadata = (List<Assessment_Report_Subsection__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<Assessment_Report_Subsection__mdt>.class);

        //Mapify subsections 
        Map<Id, List<Assessment_Report_Subsection__mdt>> subsectionMap = Utilities.groupByIds('Assessment_Report_Section__c', subsectionMetadata);
        System.debug(subsectionMap);

        for (Assessment_Report_Section__mdt section : sectionMetadata) {
            Map<String, List<Assessment_Report_Subsection__mdt>> groupedSplitSubsections =
                new Map<String, List<Assessment_Report_Subsection__mdt>>();

            if (String.isNotBlank(section.Render_Flags__c)) {
                for (String flag : section.Render_Flags__c.split(',')) {
                    renderFlags.add(flag.trim());
                }
            }

            MdtConfig config = new MdtConfig(section);

            System.debug('Has sub?: '+subsectionMap.containsKey(section.Id));

            if(subsectionMap.containsKey(section.Id)){
                for (Assessment_Report_Subsection__mdt subsection : subsectionMap.get(section.Id)) {
                    Matcher splitMatcher = splitPattern.matcher(subsection.DeveloperName);

                    if (!splitMatcher.matches()) {
                        if (String.isNotBlank(subsection.Render_Flags__c)) {
                            for (String flag : subsection.Render_Flags__c.split(',')) {
                                renderFlags.add(flag.trim());
                            }
                        }

                        config.subsections.add(new MdtConfig(subsection));
                    } else {
                        String name = splitMatcher.group(1);
                        if (!groupedSplitSubsections.containsKey(name)) {
                            groupedSplitSubsections.put(name, new List<Assessment_Report_Subsection__mdt>());
                        }
                        groupedSplitSubsections.get(name).add(subsection);
                    }
                }

                for (List<Assessment_Report_Subsection__mdt> splitSubsections : groupedSplitSubsections.values()) {
                    config.subsections.add(new MdtConfig(splitSubsections));
                }
            }
            
            config.subsections.sort();
            mdtConfigs.add(config);
        }

        if (!renderFlags.isEmpty()) {
            Assessment__c assessment = AssessmentService.queryAssessment(assessmentId, renderFlags);

            if (assessment != null) {
                for (Integer i = 0; i < mdtConfigs.size(); i++) {
                    MdtConfig config = mdtConfigs[i];
                    config.calculateRender(assessment);
                    if (!config.render) mdtConfigs.remove(i);
                }
            }
        }

        mdtConfigs.sort();
        return mdtConfigs;
    }
}