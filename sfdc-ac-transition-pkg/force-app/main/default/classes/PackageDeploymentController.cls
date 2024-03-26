/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public with sharing class PackageDeploymentController {
    @TestVisible
    static final String DOWNLOAD_URL_PREFIX = Label.PackageDeploymentControllerDownloadUrlPrefix;
    @TestVisible
    static final Datetime NOW = Datetime.now();
    @TestVisible 
    static final String FILETYPE_ZIP = 'ZIP';
    @TestVisible
    static final String STATUS_REVIEW = 'Review';
    @TestVisible
    static final String INSTALL_STATUS_SUCCEEDED = 'SUCCEEEDED';
    @TestVisible
    static final String INSTALL_STATUS_SUCCEEDEDPARTIAL = 'SUCCEEDEDPARTIAL';
    @TestVisible
    static final String INSTALL_STATUS_FAILED = 'FAILED';
    @TestVisible
    static final String INSTALL_STATUS_CANCELING = 'CANCELING';
    @TestVisible
    static final String INSTALL_STATUS_CANCELED = 'CANCELED';
    @TestVisible
    static final String DEPLOY_STATUS_CANCEL_LABEL = 'DeployStatusCancel';
    @TestVisible
    static final String DEPLOY_STATUS_FAIL_LABEL = 'DeployStatusFail';
    @TestVisible
    static final String DEPLOY_STATUS_SUCCESS_LABEL = 'DeployStatusSuccess';
    @TestVisible
    static final String DEPLOY_STATUS_UNKNOWN_LABEL = 'DeployStatusUnknown';

    @TestVisible
    static Set<String> INSTALL_ERROR_STATUSES = new Set<String> {
        INSTALL_STATUS_SUCCEEDEDPARTIAL,
        INSTALL_STATUS_FAILED,
        INSTALL_STATUS_CANCELING,
        INSTALL_STATUS_CANCELED
    };


    @AuraEnabled
    public static DeployedPackageTableInfo getDeploymentInfo(){
        Map<Id, Assessment__c> orgAssessmentMap = new Map<Id, Assessment__c>((List<Assessment__c>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Description__c, DeploymentDataJSON__c, ErrorDeployPackagesJSON__c, PendingDeployPackagesJSON__c, DeployedPackageJSON__c
            FROM Assessment__c
            WHERE Status__c =: STATUS_REVIEW
        ], true)));

        List<ContentDocumentLink> deploymentZips = (List<ContentDocumentLink>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, [
            SELECT LinkedEntityId, LinkedEntity.Name, ContentDocumentId, ContentDocument.CreatedDate, 
                ContentDocument.Description, ContentDocument.Title
            FROM ContentDocumentLink 
            WHERE LinkedEntityId IN: orgAssessmentMap.keySet()
                AND ContentDocument.FileType =: FILETYPE_ZIP
            ORDER BY ContentDocument.CreatedDate DESC
        ], true));

        List<DeploymentInfo> deployedPackages = new List<DeploymentInfo>();
        Set<Id> deployedPackageIds = new Set<Id>();
        List<DeploymentInfo> pendingPackages = new List<DeploymentInfo>();
        Set<Id> pendingPackageIds = new Set<Id>();
        List<DeploymentInfo> deployablePackages = new List<DeploymentInfo>();
        List<DeploymentInfo> errorPackages = new List<DeploymentInfo>();
        Set<Id> errorPackageIds = new Set<Id>();
        for(ContentDocumentLink deploymentZip : deploymentZips) {
            Assessment__c relatedAssessment = orgAssessmentMap.get(deploymentZip.LinkedEntityId);

            if(relatedAssessment.DeployedPackageJSON__c != null) {
                List<DeploymentInfo> successfulDeploymentList;
                DeploymentInfo successfulDeployment;
                try{
                    successfulDeploymentList = (List<DeploymentInfo>)JSON.deserialize(relatedAssessment.DeployedPackageJSON__c, List<DeploymentInfo>.class);
                    for (DeploymentInfo infoItem : successfulDeploymentList) {
                        if(deployedPackageIds.contains(infoItem.DocumentId) == false) {
                            deployedPackages.add(infoItem);
                            deployedPackageIds.add(infoItem.DocumentId);
                        }
                    }
                }catch(Exception ex){
                    SystemLogger.log(LoggingLevel.ERROR, ex);
                }
            }

            if(relatedAssessment.PendingDeployPackagesJSON__c != null) {
                DeploymentInfo pendingDeployment = (DeploymentInfo)JSON.deserialize(relatedAssessment.PendingDeployPackagesJSON__c, DeploymentInfo.class);
                if(pendingPackageIds.contains(pendingDeployment.DocumentId) == false) {
                    pendingPackages.add(pendingDeployment);
                    pendingPackageIds.add(pendingDeployment.DocumentId);
                }
            }

            if(relatedAssessment.ErrorDeployPackagesJSON__c != null) {
                DeploymentInfo errorDeployment = (DeploymentInfo)JSON.deserialize(relatedAssessment.ErrorDeployPackagesJSON__c, DeploymentInfo.class);
                if(errorPackageIds.contains(errorDeployment.DocumentId) == false) {
                    if(relatedAssessment.DeploymentDataJSON__c != null) {
                        errorDeployment.DeploymentDetails = (DeploymentResult)JSON.deserialize(relatedAssessment.DeploymentDataJSON__c, DeploymentResult.class);
                    }
                    errorPackages.add(errorDeployment);
                    errorPackageIds.add(errorDeployment.DocumentId);
                }
            }
        }

        for(DeploymentInfo errorPackage : errorPackages) {
            if(errorPackage.DeploymentDetails != null) {
                errorPackage.ErrorDetails = errorPackage.DeploymentDetails.details.componentFailures;
                errorPackage.SuccessDetails = errorPackage.DeploymentDetails.details.componentSuccesses;
            }
        }

        for(ContentDocumentLink deploymentZip : deploymentZips) {
            if(pendingPackageIds.contains(deploymentZip.ContentDocumentId) == false && deployedPackageIds.contains(deploymentZip.ContentDocumentId) == false) {
                deployablePackages.add(new DeploymentInfo(deploymentZip, orgAssessmentMap.get(deploymentZip.LinkedEntityId)));
            }
        }

        return new DeployedPackageTableInfo(
            orgAssessmentMap.keySet(),
            deployedPackages,
            pendingPackages,
            deployablePackages,
            errorPackages
        ); 
    }

    @AuraEnabled
    public static void deployPackage(String deploymentJSON){
        DeploymentInfo deployment = (DeploymentInfo)JSON.deserialize(deploymentJSON, DeploymentInfo.class);
        if(ExternalUtilities.initiatePackageDeployment(deployment) == true) {
            deployment.DeploymentStarttime = NOW;
            AssessmentService.updateAssessment(new Assessment__c(
                Id = deployment.AssessmentId,
                Status__c = STATUS_REVIEW,
                DeploymentDataJSON__c = null,
                PendingDeployPackagesJSON__c = JSON.serialize(deployment),
                ErrorDeployPackagesJSON__c = null
            ));
        }
    }

    public static void processPackageDeployment(List<Assessment__c> newList, Map<Id, Assessment__c> oldMap){
        for(Assessment__c currentAssessment : newList) {
            if(currentAssessment.Status__c == STATUS_REVIEW && 
                currentAssessment.DeploymentDataJSON__c != null && 
                oldMap.get(currentAssessment.Id).DeploymentDataJSON__c == null &&
                currentAssessment.PendingDeployPackagesJSON__c != null
            ) {
                DeploymentInfo pendingDeployment = (DeploymentInfo)JSON.deserialize(currentAssessment.PendingDeployPackagesJSON__c, DeploymentInfo.class);
                DeploymentResult result = (DeploymentResult)JSON.deserialize(currentAssessment.DeploymentDataJSON__c, DeploymentResult.class);
                pendingDeployment.DeploymentStatus = getTableDeploymentStatus(result.status);
                pendingDeployment.DeploymentEndtime = NOW;

                //String updatedPendingJSON = JSON.serialize(pendingDeployment);

                if(INSTALL_ERROR_STATUSES.contains(result.status) == true) {
                    currentAssessment.ErrorDeployPackagesJSON__c = JSON.serialize(pendingDeployment);
                }
                else {
                    //Create list and add deployed package to list
                    List<DeploymentInfo> listToRecord;
                    if(!String.isBlank(currentAssessment.DeployedPackageJSON__c)){
                        if(currentAssessment.DeployedPackageJSON__c.startsWith('[')){
                            listToRecord = (List<DeploymentInfo>)JSON.deserialize(currentAssessment.DeployedPackageJSON__c, List<DeploymentInfo>.class);
                        }else{
                            //Support for legacy deployment list within app
                            listToRecord = new List<DeploymentInfo>{(DeploymentInfo) JSON.deserialize(currentAssessment.DeployedPackageJSON__c, DeploymentInfo.class)};
                        }
                        listToRecord.add(pendingDeployment);
                    }else{
                        listToRecord = new List<DeploymentInfo>{pendingDeployment};
                    }
                    currentAssessment.DeployedPackageJSON__c = JSON.serialize(listToRecord);
                }
                currentAssessment.PendingDeployPackagesJSON__c = null;
            }
        }
    }

    @TestVisible
    static String getTableDeploymentStatus(String status) {
        if(status == INSTALL_STATUS_SUCCEEDED) {
            return ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + DEPLOY_STATUS_SUCCESS_LABEL);
        }
        else if(status == INSTALL_STATUS_FAILED || status == INSTALL_STATUS_SUCCEEDEDPARTIAL) {
            return ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + DEPLOY_STATUS_FAIL_LABEL);
        }
        else if(status == INSTALL_STATUS_CANCELING || status == INSTALL_STATUS_CANCELED) {
            return ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + DEPLOY_STATUS_CANCEL_LABEL);
        }
        else {
            return ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + DEPLOY_STATUS_UNKNOWN_LABEL);
        }
    }

    public class DeploymentInfo {
        @AuraEnabled
        public Id DocumentId {get;set;}
        @AuraEnabled
        public String DocumentUrl {get;set;}
        @AuraEnabled
        public String Name {get;set;}
        @AuraEnabled
        public Id AssessmentId {get;set;}
        @AuraEnabled
        public String AssessmentUrl {get;set;}
        @AuraEnabled
        public String AssessmentName {get;set;}
        @AuraEnabled
        public String Description {get;set;}
        @AuraEnabled
        public String DeploymentStatus {get;set;}
        @AuraEnabled
        public DeploymentResult DeploymentDetails {get;set;}
        @AuraEnabled
        public List<ComponentDetails> ErrorDetails {get; set;}
        @AuraEnabled
        public List<ComponentDetails> SuccessDetails {get; set;}
        @AuraEnabled
        public Datetime PackageCreatedDate {get;set;}
        @AuraEnabled
        public Datetime DeploymentStarttime {get;set;}
        @AuraEnabled
        public Datetime DeploymentEndtime {get;set;}
        @AuraEnabled
        public Boolean IsSelected {get;set;}

        public DeploymentInfo() {}

        public DeploymentInfo(ContentDocumentLink deployment, Assessment__c parentAssessment) {
            this.DocumentId = deployment.ContentDocumentId;
            this.DocumentUrl = DOWNLOAD_URL_PREFIX + this.DocumentId;
            this.Name = deployment.ContentDocument.Title;
            this.AssessmentId = deployment.LinkedEntityId;
            this.AssessmentName = deployment.LinkedEntity.Name;
            this.AssessmentUrl = '/' + this.AssessmentId;
            this.Description = parentAssessment.Description__c;
            this.PackageCreatedDate = deployment.ContentDocument.CreatedDate;
            this.IsSelected = false;
        }
    }

    public class DeploymentResult {
        @AuraEnabled
        public String status {get; set;}
        @AuraEnabled
        public ComponentInfo details {get; set;}

        public DeploymentResult() {}
    }

    public class ComponentInfo {
        @AuraEnabled
        public List<ComponentDetails> componentFailures {get; set;}
        @AuraEnabled
        public List<ComponentDetails> componentSuccesses {get; set;}

        public ComponentInfo() {}
    }

    public class ComponentDetails {
        @AuraEnabled
        public String changed {get;set;}
        @AuraEnabled
        public String columnNumber {get;set;}
        @AuraEnabled
        public String componentType {get;set;}
        @AuraEnabled
        public String created {get;set;}
        @AuraEnabled
        public String createdDate {get;set;}
        @AuraEnabled
        public String deleted {get;set;}
        @AuraEnabled
        public String fileName {get;set;}
        @AuraEnabled
        public String fullName {get;set;}
        @AuraEnabled
        public String lineNumber {get;set;}
        @AuraEnabled
        public String problem {get;set;}
        @AuraEnabled
        public String problemType {get;set;}
        @AuraEnabled
        public String success {get;set;}

        public ComponentDetails() {}
    }

    public class DeployedPackageTableInfo {
        @AuraEnabled
        public Set<Id> AssessmentIds {get;set;}
        @AuraEnabled
        public List<DeploymentInfo> DeployedPackages {get;set;}
        @AuraEnabled
        public List<DeploymentInfo> PendingPackages {get;set;}
        @AuraEnabled
        public List<DeploymentInfo> DeployablePackages {get;set;}
        @AuraEnabled
        public List<DeploymentInfo> ErrorPackages {get;set;}

        public DeployedPackageTableInfo() {}

        public DeployedPackageTableInfo(
            Set<Id> assessmentIds,
            List<DeploymentInfo> deployedPackages, 
            List<DeploymentInfo> pendingPackages, 
            List<DeploymentInfo> deployablePackages, 
            List<DeploymentInfo> errorPackages
        ) {
            this.AssessmentIds = assessmentIds;
            this.DeployedPackages = deployedPackages;
            this.PendingPackages = pendingPackages;
            this.DeployablePackages = deployablePackages;
            this.ErrorPackages = errorPackages;
        }
    }
}