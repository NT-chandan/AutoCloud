/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public with sharing class PackageInstallationController {
    @TestVisible
    static final String STATUS_REVIEW = 'Review';
    @TestVisible
    static final String INSTALL_STATUS_ERROR = 'ERROR';
    @TestVisible
    static final String METADATA_INSTALLED_PACKAGE = 'InstalledPackage';
    @TestVisible
    static final String KEY_NAMESPACE = 'namespacePrefix';
    @TestVisible
    static final String HC_PACKAGE_NAMESPACE = 'HealthCloudGA';

    @TestVisible
    static Set<String> installedPackageExcludes {
        get {
            if(installedPackageExcludes == null) {
                String query = 'SELECT Package_Name__c FROM SFDC_Industry_Package_Exclude__mdt';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Industry_Package_Exclude__mdt> packageExcludes = (List<SFDC_Industry_Package_Exclude__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Package_Exclude__mdt>.class);

                installedPackageExcludes = Utilities.pluckStrings('Package_Name__c', packageExcludes);
            }
            return installedPackageExcludes;
        }
        set;
    }

    @TestVisible
    static List<SFDC_Industry_Package_Table_Assignment__mdt> installedPackageTableInfo {
        get {
            if(installedPackageTableInfo == null) {
                String query = 'SELECT Package_Name__c, Sort_Order__c, Selected__c, Description_Label__c FROM SFDC_Industry_Package_Table_Assignment__mdt ORDER BY Sort_Order__c ASC NULLS LAST';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                installedPackageTableInfo = (List<SFDC_Industry_Package_Table_Assignment__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Industry_Package_Table_Assignment__mdt>.class);
            }
            return installedPackageTableInfo;
        }
        set;
    }

    @TestVisible
    static List<ToolingService.InstalledSubscriberPackage> installedPackageList {
        get {
            if(installedPackageList == null) {
                installedPackageList = new List<ToolingService.InstalledSubscriberPackage>();
                String response = ToolingService.getInstalledSubscriberPackageResponse();
                if(response != null) {
                    installedPackageList = ToolingService.parseInstalledSubscriberPackageResponse(response).records;
                }
            }
            return installedPackageList;
        }
        set;

    }

    @TestVisible
    static Map<String, ToolingService.InstalledSubscriberPackage> installedPackageMap {
        get {
            if(installedPackageMap == null) {
                installedPackageMap = new Map<String, ToolingService.InstalledSubscriberPackage>();
                for(ToolingService.InstalledSubscriberPackage installedPackage : installedPackageList) {
                    installedPackageMap.put(installedPackage.SubscriberPackage.Name, installedPackage);
                }
            }
            return installedPackageMap;
        }
        set;
    }

    // @AuraEnabled
    // public static InstalledPackageTableInfo getPackageList(Id assessmentId){
    //     if(assessmentId == null) return new InstalledPackageTableInfo();

    //     Assessment__c relatedAssessment;
    //     List<Assessment__c> existingAssessments = (List<Assessment__c>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, [
    //         SELECT PendingInstallPackagesJSON__c, ErrorInstallPackagesJSON__c, InstallDataJSON__c
    //         FROM Assessment__c
    //         WHERE Id =: assessmentId
    //     ], true));
    //     if (!existingAssessments.isEmpty()) {
    //         relatedAssessment = existingAssessments[0];
    //     }

    //     List<PackageInfo> installedPackages = new List<PackageInfo>();
    //     List<PackageInfo> uninstalledPackages = new List<PackageInfo>();
    //     List<PackageInfo> errorPackages = relatedAssessment?.ErrorInstallPackagesJSON__c == null ? new List<PackageInfo>() : (List<PackageInfo>)JSON.deserialize(relatedAssessment.ErrorInstallPackagesJSON__c, List<PackageInfo>.class);
    //     List<PackageInfo> pendingPackages = relatedAssessment?.PendingInstallPackagesJSON__c == null ? new List<PackageInfo>() : (List<PackageInfo>)JSON.deserialize(relatedAssessment.PendingInstallPackagesJSON__c, List<PackageInfo>.class);
    //     Set<Id> pendingPackageIds = new Set<Id>();
    //     for(PackageInfo pendingPackage : pendingPackages) {
    //         pendingPackageIds.add(pendingPackage.VersionId);
    //     }

    //     Set<String> sortedPackages = new Set<String>();
    //     for(SFDC_Industry_Package_Table_Assignment__mdt tableInfo : installedPackageTableInfo) {
    //         ToolingService.InstalledSubscriberPackage currentPackage = ToolingService.fscPackageMap.get(tableInfo.Package_Name__c);
    //         if(currentPackage == null || pendingPackageIds.contains(currentPackage.SubscriberPackageVersion.Id) == true) {
    //             continue;
    //         }
            
    //         sortedPackages.add(tableInfo.Package_Name__c);
    //         ToolingService.InstalledSubscriberPackage installedPackage = installedPackageMap.get(currentPackage.SubscriberPackage.Name);
    //         if(installedPackage == null || 
    //             Decimal.valueOf(
    //                 installedPackage.SubscriberPackageVersion.MajorVersion == null ? '0' : installedPackage.SubscriberPackageVersion.MajorVersion + '.' + 
    //                 installedPackage.SubscriberPackageVersion.MinorVersion == null ? '0' : installedPackage.SubscriberPackageVersion.MinorVersion
    //             ) > 
    //             Decimal.valueOf(
    //                 currentPackage.SubscriberPackageVersion.MajorVersion == null ? '0' : currentPackage.SubscriberPackageVersion.MajorVersion + '.' + 
    //                 currentPackage.SubscriberPackageVersion.MinorVersion == null ? '0' : currentPackage.SubscriberPackageVersion.MinorVersion
    //             )
    //         ) {
    //             uninstalledPackages.add(new PackageInfo(currentPackage, tableInfo, tableInfo.Selected__c));
    //         }
    //         else {
    //             installedPackages.add(new PackageInfo(currentPackage, tableInfo, tableInfo.Selected__c));
    //         }
    //     }

    //     for(ToolingService.InstalledSubscriberPackage currentPackage : ToolingService.fscPackageMap.values()) {
    //         if(installedPackageExcludes.contains(currentPackage.SubscriberPackage.Name) == true || 
    //             sortedPackages.contains(currentPackage.SubscriberPackage.Name) == true ||
    //             pendingPackageIds.contains(currentPackage.SubscriberPackageVersion.Id) == true
    //         ) {
    //             continue;
    //         }

    //         ToolingService.InstalledSubscriberPackage installedPackage = installedPackageMap.get(currentPackage.SubscriberPackage.Name);
    //         if(installedPackage == null || 
    //             Decimal.valueOf(
    //                 installedPackage.SubscriberPackageVersion.MajorVersion == null ? '0' : installedPackage.SubscriberPackageVersion.MajorVersion + '.' + 
    //                 installedPackage.SubscriberPackageVersion.MinorVersion == null ? '0' : installedPackage.SubscriberPackageVersion.MinorVersion
    //             ) > 
    //             Decimal.valueOf(
    //                 currentPackage.SubscriberPackageVersion.MajorVersion == null ? '0' : currentPackage.SubscriberPackageVersion.MajorVersion + '.' + 
    //                 currentPackage.SubscriberPackageVersion.MinorVersion == null ? '0' : currentPackage.SubscriberPackageVersion.MinorVersion
    //             )
    //         ) {
    //             uninstalledPackages.add(new PackageInfo(currentPackage));
    //         }
    //         else {
    //             installedPackages.add(new PackageInfo(currentPackage));
    //         }
    //     }

    //     return new InstalledPackageTableInfo(
    //         installedPackages, 
    //         pendingPackages,
    //         uninstalledPackages, 
    //         errorPackages,
    //         relatedAssessment?.InstallDataJSON__c == null ? null : (InstallationResult)JSON.deserialize(relatedAssessment.InstallDataJSON__c, InstallationResult.class)
    //     );
    // }

    @AuraEnabled
    public static InstalledPackageTableInfo getPackageList(Id assessmentId){
        if(assessmentId == null) return new InstalledPackageTableInfo();

        Assessment__c relatedAssessment;
        List<Assessment__c> existingAssessments = (List<Assessment__c>)Utilities.nullStrippedFields(Security.stripInaccessible(AccessType.READABLE, [
            SELECT PendingInstallPackagesJSON__c, ErrorInstallPackagesJSON__c, InstallDataJSON__c
            FROM Assessment__c
            WHERE Id =: assessmentId
        ], true));
        if (!existingAssessments.isEmpty()) {
            relatedAssessment = existingAssessments[0];
        }

        List<PackageInfo> installedPackages = new List<PackageInfo>();
        List<PackageInfo> uninstalledPackages = new List<PackageInfo>();
        List<PackageInfo> errorPackages = relatedAssessment?.ErrorInstallPackagesJSON__c == null ? new List<PackageInfo>() : (List<PackageInfo>)JSON.deserialize(relatedAssessment.ErrorInstallPackagesJSON__c, List<PackageInfo>.class);
        List<PackageInfo> pendingPackages = relatedAssessment?.PendingInstallPackagesJSON__c == null ? new List<PackageInfo>() : (List<PackageInfo>)JSON.deserialize(relatedAssessment.PendingInstallPackagesJSON__c, List<PackageInfo>.class);
        Set<Id> pendingPackageIds = new Set<Id>();

        for(ToolingService.InstalledSubscriberPackage currentPackage : ToolingService.installedPackageMap.values()) {
            if(currentPackage.SubscriberPackage.NamespacePrefix == HC_PACKAGE_NAMESPACE) {
                installedPackages.add(new PackageInfo(currentPackage));
            }
        }

        return new InstalledPackageTableInfo(
            installedPackages, 
            pendingPackages,
            uninstalledPackages, 
            errorPackages,
            relatedAssessment?.InstallDataJSON__c == null ? null : (InstallationResult)JSON.deserialize(relatedAssessment.InstallDataJSON__c, InstallationResult.class)
        );
    }

    @AuraEnabled
    public static void deploySelectedPackages(Id assessmentId, List<PackageInfo> selectedPackages){
        if(ExternalUtilities.initiatePackageInstall(assessmentId, selectedPackages) == true) {
            AssessmentService.updateAssessment(new Assessment__c(
                Id = assessmentId,
                Status__c = STATUS_REVIEW,
                InstallDataJSON__c = null,
                PendingInstallPackagesJSON__c = JSON.serialize(selectedPackages),
                ErrorInstallPackagesJSON__c = null
            ));
        }
    }

    public static void processPackageInstall(List<Assessment__c> newList, Map<Id, Assessment__c> oldMap){
        for(Assessment__c currentAssessment : newList) {
            if(currentAssessment.Status__c == STATUS_REVIEW && 
                currentAssessment.InstallDataJSON__c != null && 
                oldMap.get(currentAssessment.Id).InstallDataJSON__c == null
            ) {
                if(((InstallationResult)JSON.deserialize(currentAssessment.InstallDataJSON__c, InstallationResult.class)).status == INSTALL_STATUS_ERROR) {
                    currentAssessment.ErrorInstallPackagesJSON__c = currentAssessment.PendingInstallPackagesJSON__c;
                }
                currentAssessment.Sub_Status__c = null;
                currentAssessment.PendingInstallPackagesJSON__c = null;
            }
        }
    }

    public class InstalledPackageTableInfo {
        @AuraEnabled
        public List<PackageInfo> InstalledPackages {get;set;}
        @AuraEnabled
        public List<PackageInfo> PendingPackages {get;set;}
        @AuraEnabled
        public List<PackageInfo> UninstalledPackages {get;set;}
        @AuraEnabled
        public List<PackageInfo> ErrorPackages {get;set;}
        @AuraEnabled
        public InstallationResult InstallResult {get;set;}
        @AuraEnabled
        public Boolean OrgReadyForInstallation {get; set;}

        public InstalledPackageTableInfo() {}

        public InstalledPackageTableInfo(
            List<PackageInfo> installedPackages, 
            List<PackageInfo> pendingPackages, 
            List<PackageInfo> uninstalledPackages, 
            List<PackageInfo> errorPackages, 
            InstallationResult installResult
        ) {
            this.InstalledPackages = installedPackages;
            this.PendingPackages = pendingPackages;
            this.UninstalledPackages = uninstalledPackages;
            this.ErrorPackages = errorPackages;
            this.InstallResult =  installResult;
            TransitionReadinessUtility.InstallReadiness currentOrgState = TransitionReadinessUtility.getFscInstallationReadiness();
            this.OrgReadyForInstallation = currentOrgState.hasPackage || currentOrgState.isOrgInstallationReady;
        }
    }


    public class PackageInfo {
        @AuraEnabled
        public Id VersionId {get;set;}
        @AuraEnabled
        public String Name {get;set;}
        @AuraEnabled
        public String Version {get;set;}
        @AuraEnabled
        public String PackageVersionName {get;set;}
        @AuraEnabled
        public String Description {get;set;}
        @AuraEnabled
        public Boolean IsSelected {get;set;}

        public PackageInfo() {}

        public PackageInfo(ToolingService.InstalledSubscriberPackage installedPackageInfo) {
            this.VersionId = installedPackageInfo.SubscriberPackageVersion.Id;
            this.Name = installedPackageInfo.SubscriberPackage.Name;
            this.Version = installedPackageInfo.SubscriberPackageVersion.MajorVersion + '.' + installedPackageInfo.SubscriberPackageVersion.MinorVersion;
            this.PackageVersionName = installedPackageInfo.SubscriberPackageVersion.Name;
            this.Description = '';
            this.IsSelected = false;
        }

        public PackageInfo(ToolingService.InstalledSubscriberPackage installedPackageInfo, SFDC_Industry_Package_Table_Assignment__mdt tableInfo, Boolean IsSelected) {
            this.VersionId = installedPackageInfo.SubscriberPackageVersion.Id;
            this.Name = installedPackageInfo.SubscriberPackage.Name;
            this.Version = installedPackageInfo.SubscriberPackageVersion.MajorVersion + '.' + installedPackageInfo.SubscriberPackageVersion.MinorVersion;
            this.PackageVersionName = installedPackageInfo.SubscriberPackageVersion.Name;
            this.Description = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + tableInfo.Description_Label__c) == null ? '' : ToolingService.customLabelMap.get(Utilities.namespaceUnderscore + tableInfo.Description_Label__c);
            this.IsSelected = IsSelected;
        }
    }

    public class InstallationResult {
        @AuraEnabled
        public String status {get; set;}
        @AuraEnabled
        public String error {get; set;}

        public InstallationResult() {}
    }

}