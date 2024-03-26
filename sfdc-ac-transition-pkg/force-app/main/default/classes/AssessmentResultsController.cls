/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Controller for the c-assessment-results web component
 */
public with sharing class AssessmentResultsController {

    public static final String ASSESSMENT_REPORT_FILENAME = 'Automotive Cloud Transition Assistant Report'.escapeHtml4();
    public static final String REPORT_SUMMARY_FILENAME = 'Automotive Cloud Transition Assistant Report Summary'.escapeHtml4();
    // public static final String ASSESSMENT_REPORT_FILENAME = 'AssessmentReport';
    // public static final String REPORT_SUMMARY_FILENAME = 'ReportSummary';

    /**
     * Return view model for displaying upgrade readiness assessment results
     * stored on an Assessment record
     *
     * @return - AssessmentResultsView Model of results from of TransitionReadinessUtility.ReadinessResults
     */
    @AuraEnabled
    public static AssessmentResultsView getAssessmentResults(Id assessmentId) {
        return new AssessmentResultsView(TransitionReadinessUtility.performFscUpgradeAssessment(assessmentId));
    }

    /**
     * Return view model for the structure of the Assessment Report
     *
     * @return - AssessmentReportStructure Model of results specific to the assessment
     */
    @AuraEnabled
    public static AssessmentReportStructure getAssessmentReportStructure(Id assessmentId) {
        return new AssessmentReportStructure(assessmentId);
    }

    /**
     * Get and Set Custom Settings values pertaining to the Assessment Report
     */
    @AuraEnabled
    public static Boolean getCustomSettings(){
        TransitionAppSettings__c settings = TransitionAppSettings__c.getOrgDefaults();
        return (settings!=null) ? settings.Collapse_Welcome_Section_By_Default__c : false;
    }
    @AuraEnabled
    public static Boolean disableWelcomeDefault(){
        Database.SaveResult result;
        try{
            TransitionAppSettings settings = new TransitionAppSettings();
            return settings.collapseWelcomeSectionByDefault;
        }catch(Exception e){
            SystemLogger.log(LoggingLevel.ERROR, e);
            return false;
        }
    }

    /**
     * Get and Set Custom Settings values pertaining to the Report Summary
     */
    @AuraEnabled(cacheable=true)
    public static Boolean hideReportSummary() {
        // system.debug('Getting custom setting values');
        return TransitionAppSettings__c.getOrgDefaults().Hide_Report_Summary__c;
    }
    @AuraEnabled(cacheable=true)
    public static Decimal notableObjectCount() {
        return TransitionAppSettings__c.getOrgDefaults().Notable_Objects_Count__c;
    }
    @AuraEnabled(cacheable=true)
    public static Decimal notableObjectThreshold() {
        return TransitionAppSettings__c.getOrgDefaults().Notable_Objects_Threshold__c;
    }

    @AuraEnabled
    public static String downloadPdfReport(Id assessmentId, String pdfContentJson, String mode){
        String pdfVersionId;

        // Get the contentDocumentId based on whether we're requesting a full report or summary
        String contentDocumentId = '';
        System.debug('this.............=======> ' + mode);
        System.debug('this.............=======> ' + mode);
        if(mode == 'full') {
            contentDocumentId = getAssessmentReportId(assessmentId);
        } else if(mode == 'summary') {
            contentDocumentId = getReportSummaryId(assessmentId);
        }

        if(String.isNotBlank(contentDocumentId)){
            pdfVersionId = contentDocumentId;
        } else {
            try{
                PdfContent pdfContent = new pdfContent(pdfContentJson);

                ExternalUtilities.PdfDocumentResponse pdfResponse = ExternalUtilities.requestAssessmentAsPdf(assessmentId, pdfContent);

                pdfVersionId = 'PENDING';
            } catch(Exception e){
                SystemLogger.log(LoggingLevel.ERROR, e, assessmentId);
                throw new AuraHandledException(e.getMessage());
            }
        }

        return pdfVersionId;
    }

    @AuraEnabled
    public static String getAssessmentReportId(Id assessmentId){
        System.debug('assessmentId=======> ' + assessmentId);
        return FileUtility.getContentDocumentIdByName(assessmentId, ASSESSMENT_REPORT_FILENAME);
    }

    @AuraEnabled
    public static String getReportSummaryId(Id assessmentId){
        return FileUtility.getContentDocumentIdByName(assessmentId, REPORT_SUMMARY_FILENAME);
    }

    /**
     * View Model for Assessment Report Results
     */
    public class AssessmentResultsView {
        @AuraEnabled public String assessmentVersion;
        @AuraEnabled public Datetime dateRun;
        @AuraEnabled public Id orgId;
        @AuraEnabled public String orgEdition;
        @AuraEnabled public String upgradeType;
        @AuraEnabled public TransitionReadinessUtility.InstallReadiness installReadiness;
        @AuraEnabled public RecommendationView overallRecommendation;
        @AuraEnabled public List<RecommendationView> recommendations = new List<RecommendationView>();
        @AuraEnabled public TransitionAnalysis analysis;

        public AssessmentResultsView(TransitionReadinessUtility.ReadinessResults results) {
            this.assessmentVersion = results.assessmentVersion;
            this.dateRun = results.dateRun;
            this.orgId = results.orgId;
            this.orgEdition = results.orgEdition;
            this.upgradeType = String.valueOf(results.upgradeType) + (results.orgVersion != null ? ' ' + results.orgVersion : '');
            this.installReadiness = results.installReadiness;
            if (results.overallRecommendation != null) {
                this.overallRecommendation = new RecommendationView(results.overallRecommendation);
            }
            if (results.recommendations != null) {
                for (TransitionRecommendation rec : results.recommendations) {
                    this.recommendations.add(new RecommendationView(rec));
                }
            }
            this.analysis = results.analysis != null ? results.analysis : new TransitionAnalysis();
        }
    }

    /**
     * View Model for Assessment Report Sections
     */
    public class AssessmentReportStructure {
        @AuraEnabled public List<AssessmentReportSection.MdtConfig> sections;

        public AssessmentReportStructure(Id assessmentId) {
            sections = AssessmentReportSection.getConfigsForAssessment(assessmentId);
        }
    }

    /**
     * View Model for TransitionRecommendation
     */
    public class RecommendationView {
        @AuraEnabled public String text;
        @AuraEnabled public List<RecommendationReason> reasons;
        @AuraEnabled public String severityIcon;

        public RecommendationView(TransitionRecommendation recommendation) {
            System.debug('REC: ' + recommendation);
            this.text = recommendation.text;
            this.reasons = new List<RecommendationReason>();
            for(Integer i = 0; i < recommendation.reasons.size(); i++) {
                reasons.add(new RecommendationReason(
                    recommendation.reasons[i], 
                    recommendation.descriptions[i], 
                    recommendation.titles[i], 
                    recommendation.hasDescription[i]
                ));
            }
            System.debug('REASONS: ' + reasons);
            switch on recommendation.severity {
                when INFO {
                    this.severityIcon = 'utility:info';
                }
                when SUCCESS {
                    this.severityIcon = 'action:approval';
                }
                when WARNING {
                    this.severityIcon = 'utility:warning';
                }
                when CRITICAL {
                    this.severityIcon = 'action:close';
                }
                when else {
                    this.severityIcon = 'utility:info';
                }
            }
        }
    }

    public class RecommendationReason {
        @AuraEnabled
        public String reason;
        @AuraEnabled
        public String description;
        @AuraEnabled
        public String title;
        @AuraEnabled
        public Boolean hasDescription;

        public RecommendationReason() {}

        public RecommendationReason(String reason, String description, String title, Boolean hasDescription) {
            this.reason = reason;
            this.description = description;
            this.title = title;
            this.hasDescription = hasDescription;
        }
    }

    /**
     * Model for PDF Report Generation
     */
    public class PdfContent {
        @AuraEnabled public Map<String, Object> label;
        @AuraEnabled public Map<String, Object> assessment;
        @AuraEnabled public Map<String, Object> assessmentResults;
        @AuraEnabled public List<Object> sections;
        @AuraEnabled public String mode;
        @AuraEnabled public Boolean hideSummary;

        public PdfContent(String pdfContentJson){
            Map<String, Object> pdfContentObject = (Map<String, Object>)JSON.deserializeUntyped(pdfContentJson);

            this.label = (Map<String, Object>)pdfContentObject.get('label');
            this.mode = (String)pdfContentObject.get('mode');
            this.hideSummary = hideReportSummary();
            this.assessment = (Map<String, Object>)pdfContentObject.get('assessment');
            this.assessmentResults = (Map<String, Object>)pdfContentObject.get('assessmentResults');
            this.sections = (List<Object>)pdfContentObject.get('sections');
        }
    }
	
    @AuraEnabled
    public static Map<String,List<String>> getUnmappedRequiredFields(String assessmentId){
        Map<String,String>sourceToDestObject = new Map<String,String>(); 
        List<String>mappedObjects = new List<String>();
        List<String>requiredUnmappedFields = new List<String>();
        Set<String>requiredFieldSet = new Set<String>();
        Set<String>auditFields = new Set<String>{'CreatedDate','CreatedById','LastModifiedById','LastModifiedDate'};
        MappingService.MappedComponents cmp = MappingService.parseMappedComponents(assessmentId);
        sourceToDestObject = cmp.sourceToDestinationObject;
        for(String destObj : sourceToDestObject.values()){
            mappedObjects.add(destObj);
        }
        List<MappingService.ObjectMapping> objectMap = MappingService.buildObjectMappingList(mappedObjects);
        Map<String,List<MappingService.FieldMapping>>fieldMappingMap = new Map<String,List<MappingService.FieldMapping>>();
        for(MappingService.ObjectMapping obj : objectMap){
            fieldMappingMap.put(obj.sourceObject,obj.fieldMapping);
        }
        if(!fieldMappingMap.isEmpty()){
            for(String objectName : fieldMappingMap.keyset()){
                for(MappingService.FieldMapping field :fieldMappingMap.get(objectName)){
                    if(field.currentMeta != null && field.currentMeta.required){
                        if(!auditFields.contains(field.value)){
                        	requiredFieldSet.add(objectName+'.'+field.value);
                        }
                    }
                }
                system.debug('requiredFieldSet::'+requiredFieldSet);
            }
        }
        Map<String,List<String>>mapOfObjectAndUnmapeedFields = new Map<String,List<String>>();
        for(String requiredField : requiredFieldSet){
            if(!mapOfObjectAndUnmapeedFields.containsKey(requiredField.substringBefore('.'))){
            	mapOfObjectAndUnmapeedFields.put(requiredField.substringBefore('.'),new List<String>{requiredField.substringAfter('.')});
            }else{
                mapOfObjectAndUnmapeedFields.get(requiredField.substringBefore('.')).add(requiredField.substringAfter('.'));
            }
        }
        system.debug('mapOfObjectAndUnmapeedFields::'+mapOfObjectAndUnmapeedFields);
        return mapOfObjectAndUnmapeedFields;
    }
    
    @AuraEnabled 
    public static Map<String,List<String>> getDataTypeMisMatchedFields(String assessmentId){
        Map<String,String>sourceToDestObject = new Map<String,String>(); 
        Map<String,String>sourceToDestField = new Map<String,String>(); 
        List<String>mappedObjects = new List<String>();
        List<String>requiredUnmappedFields = new List<String>();
        Set<String>requiredFieldSet = new Set<String>();
        Map<String,String>targetFieldAndDataType = new Map<String,String>();
        MappingService.MappedComponents cmp = MappingService.parseMappedComponents(assessmentId);
        sourceToDestObject = cmp.sourceToDestinationObject;
        sourceToDestField = cmp.sourceToDestinationField;
        for(String destObj : sourceToDestObject.values()){
            mappedObjects.add(destObj);
        }
        Map<String, String> sourceToDestFieldMap = new Map<String, String>();
        for(String key : sourceToDestField.keySet()) {
            sourceToDestFieldMap.put(key.toUpperCase(), sourceToDestField.get(key));
        }
        List<MappingService.ObjectMapping> objectMap = MappingService.buildObjectMappingList(mappedObjects);
        Map<String,List<MappingService.FieldMapping>>targetFieldMappingMap = new Map<String,List<MappingService.FieldMapping>>();
        for(MappingService.ObjectMapping obj : objectMap){
            targetFieldMappingMap.put(obj.sourceObject,obj.fieldMapping);
        }
        if(!targetFieldMappingMap.isEmpty()){
            for(String objectName : targetFieldMappingMap.keyset()){
                for(MappingService.FieldMapping field :targetFieldMappingMap.get(objectName)){
                    if(field.currentMeta != null && field.currentMeta.dataType != null){
                    	targetFieldAndDataType.put(objectName+'.'+field.value,field.currentMeta.dataType);
                    }
                }
            }
        }
        Map<String,List<String>>mapOfObjectAndMismatchedDatatypeFields = new Map<String,List<String>>();
        for (String sourceMappedObject : sourceToDestObject.keyset()) {
            Map<String, Schema.SObjectField> fieldMap = SchemaService.getFieldMap(sourceMappedObject);
            for (String field : fieldMap.keySet()) {
                if (fieldMap.get(field) != null && sourceToDestFieldMap.containsKey((sourceMappedObject+'.'+field).toUpperCase()) 
                    && String.valueOf(fieldMap.get(field).getDescribe().getType()).toUpperCase()
                    != targetFieldAndDataType.get(sourceToDestFieldMap.get((sourceMappedObject+'.'+field).toUpperCase()))) {
                    if(!mapOfObjectAndMismatchedDatatypeFields.containsKey(sourceMappedObject)){
                        mapOfObjectAndMismatchedDatatypeFields.put(sourceMappedObject,new List<String>{String.valueOf(fieldMap.get(field).getDescribe().getName())});
                    }else{
                        mapOfObjectAndMismatchedDatatypeFields.get(sourceMappedObject).add(fieldMap.get(field).getDescribe().getName());
                    }
               }
            }
        }
        system.debug('mapOfObjectAndMismatchedDatatypeFields::'+mapOfObjectAndMismatchedDatatypeFields);
        return mapOfObjectAndMismatchedDatatypeFields;
    }
}