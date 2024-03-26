/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * Utility class for performing industry upgrade readiness checks and component
 * dependency scans for migrating to a Salesforce industry cloud
 */
public inherited sharing class TransitionReadinessUtility {

    //Assessment run details
    private static String assessmentVersion {
        get {
            if (assessmentVersion == null) {
                assessmentVersion = 'DEV';
                if (String.isNotBlank(Utilities.namespace)) {
                    ToolingService.InstalledSubscriberPackage installedPackage = ToolingService.installedPackageMap.get(Utilities.namespace);
                    assessmentVersion = Utilities.namespace;//not in dev mode
                    if (installedPackage != null && installedPackage.SubscriberPackageVersion != null) {
                        assessmentVersion = installedPackage.SubscriberPackageVersion.MajorVersion + '.' +
                                installedPackage.SubscriberPackageVersion.MinorVersion + '.' +
                                installedPackage.SubscriberPackageVersion.PatchVersion + '-' +
                                installedPackage.SubscriberPackageVersion.BuildNumber;
                    }
                }
            }
            return assessmentVersion;
        }
        private set;
    }
    private static final String INSTANCE_EDITION = [SELECT OrganizationType FROM Organization WHERE Id = :UserInfo.getOrganizationId()].OrganizationType;
    private static final String INSTANCE_ID = UserInfo.getOrganizationId();

    public static final String ASSESSMENT_STATUS_SCAN = 'Scanning';
    public static final String ASSESSMENT_STATUS_REVIEW = 'Review';

    public static final String ASSESSMENT_SUBSTATUS_INITIATE = 'Initializing';
    public static final String ASSESSMENT_SUBSTATUS_APEX_SHARE_SCAN = 'Scanning for Sharing Reasons';

    public static final String ASSESSMENT_SUB_STATUS_PENDING = 'Pending';
    public static final String ASSESSMENT_SUB_STATUS_SUCCESS = 'Success';
    public static final String ASSESSMENT_SUB_STATUS_FAILED = 'Failed';
    public static final String ASSESSMENT_SUB_STATUS_SKIPPED = 'Skipped';

    private static final String ASSESSMENT_FILE_MIGRATION_ANALYSIS = 'migrationAnalysis';

    //Platform Cache Keys
    private static final String CACHE_PARTITION = (String.isNotBlank(Utilities.namespace) ? Utilities.namespace : 'local') + '.TransitionCache';
    private static final Cache.OrgPartition CACHE_ORG = Cache.Org.getPartition(CACHE_PARTITION);
    private static final Integer CACHE_TTL_HOUR = 3600;
    private static final Integer CACHE_TTL_MINUTE = 60;
    private static final String CACHE_KEY_FSC_INSTALL_READINESS = 'fscInstallReadiness';

    //private assessment record instance
    private static Assessment__c assessment;

    private static Boolean hasHealthCloudGA = false;
    private static Boolean hasHealthCloudPlatform = false;
    private static Boolean hasHealthCloudPNM = false;
    private static Set<String> permSetsToAssign = new Set<String>();

    public static MappingService.UpgradeMapping assessmentMapping {
        get {
            if (assessmentMapping == null) {
                // Query the mapping data of the incoming assessment
                assessmentMapping = MappingService.getExistingMapping(assessment);
            }

            return assessmentMapping;
        } set;
    }

    private static Boolean requiresPNMLicense {
        get {
            if (requiresPNMLicense == null) {
                Set<String> PNMObjects = new Set<String>{
                        'InsurancePolicy', 'BusinessLicense', 'PersonEducation'
                };

                // Get the recommended mapping from the retrieved mapping JSON
                if (assessmentMapping != null) {
                    List<MappingService.ObjectMapping> recommendedMapping = assessmentMapping.recommended;

                    for (MappingService.ObjectMapping om : recommendedMapping) {
                        for (MappingService.MappingSelection ms : om.mappingData) {
                            if (PNMObjects.contains(ms.destination)) {
                                return true;
                            }
                        }
                    }
                }

                return false;
            }
            return requiresPNMLicense;
        }
        set;
    }

    /**
     * Run FSC Upgrade Assessment
     */
    public static ReadinessResults performFscUpgradeAssessment(Id assessmentId) {
        ReadinessResults results = new ReadinessResults(UpgradeType.AC);
        //load record with stored results
        assessment = getAssessment(assessmentId);
        //scan org into new analysis data based on assessment results
        if (String.isBlank(assessment.AnalysisDataJSON__c)) {    //only works if analysis Data json is nulllll
            //check FSC package install readiness
            results.installReadiness = getFscInstallationReadiness();
            if (results.recommendations == null) {
                results.recommendations = new List<TransitionRecommendation>();
            }
            //Perform all configured org Apex checks and collect recommendations
            results.recommendations.addAll(TransitionRecommendation.executeAllActions(assessmentId));

            //sort based on severity
            results.recommendations.sort();

            //Create FSC install recommendations
            if (results.recommendations.isEmpty()) {
                results.recommendations.add(getInstallRecommendation(results.installReadiness));
            } else {
                results.recommendations.add(0, getInstallRecommendation(results.installReadiness));
            }

            ScanComponentDependenciesQueueable.createAsyncRequest(assessmentId);

            //save results progress
            if (assessment.Id != null) {
                assessment.AnalysisDataJSON__c = results.toString();
                assessment.Status__c = ASSESSMENT_STATUS_SCAN;
                assessment.Sub_Status__c = ASSESSMENT_SUBSTATUS_INITIATE;
                AssessmentService.updateAssessment(assessment);
            }
        }
        //load existing analysis data
        else {
            results = loadReadinessResults(assessment);
            results.analysis = TransitionAnalysis.loadAnalysis(assessmentId);
        }

        return results;
    }

    /**
     * Determine Financial Services Cloud managed package installation readiness
     * Result is cached in Platform Cache for repeated access accross contexts
     */
    public static InstallReadiness getFscInstallationReadiness() {
        InstallReadiness readiness = (InstallReadiness) CACHE_ORG.get(CACHE_KEY_FSC_INSTALL_READINESS);
        if (readiness == null) {
            readiness = new InstallReadiness();

            //Get org feature flags
            readiness.hasPackage = ![SELECT Id FROM PackageLicense WHERE NamespacePrefix = 'HealthCloudGA'].isEmpty();
            readiness.hasLex = isLEXEnabled();
            readiness.hasPersonAccounts = isPersonAccountEnabled();
            readiness.hasContactToMultipleAccounts = isContactMultipleAccountsEnabled();
            //has health cloud licenece
            readiness.isLicensesAvailable = readiness.isBaseLicensesAvailable = hasHCLicenses(readiness);
            readiness.myDomainEnabled = isMyDomainEnabled();
            readiness.isChatterEnabled = isChatterEnabled();

            if (!hasHealthCloudPNM && requiresPNMLicense) {
                readiness.isPNMLicenseAvailable = false;
                readiness.isLicensesAvailable = false;
            }

            //Determine FSC package install readiness (without licenses)
            readiness.isOrgInstallationReady =
                    !readiness.hasPackage && //FSC not already installed
                            readiness.hasLex && //Lightning Experience Enabled
                            readiness.hasPersonAccounts && //Person Accounts needed
                            readiness.myDomainEnabled && //My Domain enabled
                            readiness.hasContactToMultipleAccounts; //Contacts To Multiple Accounts enabled

            CACHE_ORG.put(CACHE_KEY_FSC_INSTALL_READINESS, readiness, CACHE_TTL_MINUTE * 5, Cache.Visibility.NAMESPACE, true); //5 minutes
        }
        return readiness;
    }

    /**
     * Callback from Flow after update of Assessment record Bulk Scan Complete = true ready to finalize
     */
    public static void processScanResultsCallback(List<Id> assessmentIds) {
        ScanResultsQueueable.createAsyncRequest(assessmentIds[0]); //limited to and expecting 1 record
    }

    public static void processScanResults(Id assessmentId) {
        //Load json from file deserialize into TransitionAnalysis lists of dependencies
        String fileDataJson = FileUtility.readFileDataString(assessmentId, ASSESSMENT_FILE_MIGRATION_ANALYSIS);
        if (String.isNotBlank(fileDataJson)) {
            //parse results file json data into list structure and process
            List<TransitionAnalysis.MigrationAnalysisItem> migrationAnalysis = (List<TransitionAnalysis.MigrationAnalysisItem>) JSON.deserialize(fileDataJson, List<TransitionAnalysis.MigrationAnalysisItem>.class);
            processAnalysis(assessmentId, migrationAnalysis);
        } /*else {
            throw new AnalysisException('File content missing "' + filename + '.json"');
        }*/
    }

    /**
     * Process Dependency API Results into an TransitionAnalysis with recommendations for Report Results view
     */
    public static void processDependencies(Id assessmentId, List<ToolingService.MetadataComponentDependency> dependencies) {
        // if (assessmentId != null && dependencies != null) {
        //     Assessment__c assessment = getAssessment(assessmentId);
        //     if (!assessment.Apex_Sharing_Scan_Complete__c) {
        //         assessment.Status__c = ASSESSMENT_STATUS_SCAN;
        //         assessment.Sub_Status__c = ASSESSMENT_SUBSTATUS_APEX_SHARE_SCAN;
        //         AssessmentService.updateAssessment(assessment);

        //         try {
        //             ScanSharingReasonsQueueable.createAsyncRequest(assessmentId);
        //         } catch (Exception e) {
        //             SystemLogger.log(LoggingLevel.ERROR, e, assessmentId);
        //         }
        //     } else {
        //         TransitionAnalysis.createAsyncRequest(assessmentId, ScanComponentDependenciesQueueable.asyncRequestId, dependencies);
        //         // //generate full analysis from raw dependencies
        //         // TransitionAnalysis analysis = new TransitionAnalysis(assessmentId).generateAnalysis(dependencies);

        //         // //Update assessment with analysis results for user review
        //         // completeAssessmentAnalysis(assessmentId, analysis);
        //     }
        // }
    }

    /**
     * Process previously generated MigrationAnalysisItem Results into an TransitionAnalysis with recommendations for Report Results view
     */
    private static void processAnalysis(Id assessmentId, List<TransitionAnalysis.MigrationAnalysisItem> migrationAnalysis) {
        if (assessmentId != null && migrationAnalysis != null) {
            //generate full analysis from pre-processed results
            TransitionAnalysis analysis = new TransitionAnalysis(assessmentId).generateAnalysis(migrationAnalysis);

            //Update assessment with analysis results for user review
            completeAssessmentAnalysis(assessmentId, analysis);
        }
    }

    /**
     * Complete the Assessment report and mark ready for review
     */
    public static void completeAssessmentAnalysis(Id assessmentId, TransitionAnalysis analysis) {
        //Update assessment with analysis results for user review
        assessment = getAssessment(assessmentId);
        ReadinessResults results = loadReadinessResults(assessment);
        if (results != null) {
            injectApexSharingRecommendations(assessment, results);
            //save related result file
            TransitionAnalysis.saveAnalysis(assessmentId, analysis);
            //generate overall recommendation
            results.overallRecommendation = generateOverallRecommendation(results);
            //set results
            assessment.AnalysisDataJSON__c = results.toString();
            assessment.Status__c = ASSESSMENT_STATUS_REVIEW; //Let user know ready for review
            AssessmentService.updateAssessment(assessment);
        }
    }

    /**
     * Apex Sharing Reason / CDS Recommendations can't be performed until an analysis is complete
     * so we have to intercept and inject them here if they don't exist.
     */
    public static void injectApexSharingRecommendations(Assessment__c assessment, ReadinessResults results) {
        String sharingRecommendationText = TransitionRecommendation.recommendTextMap.get(TransitionRecommendation.SHARING_SETTINGS_RECOMMENDATION_TEXT);
        String apexSharingReason = TransitionRecommendation.recommendTextMap.get(TransitionRecommendation.SHARING_SETTINGS_APEX_SHARE_REASON);
        String cdsReason = TransitionRecommendation.recommendTextMap.get(TransitionRecommendation.SHARING_SETTINGS_CDS_REASON);

        Boolean hasSharingSettingsCheck = false;
        Boolean hasApexSharingReason = false;
        Boolean hasApexCdsReason = false;

        if(results!=null && results.recommendations != null){
            for (TransitionRecommendation recommendation : results.recommendations) {
                if (recommendation.text == sharingRecommendationText) {
                    hasSharingSettingsCheck = true;

                    for (String reasonText : recommendation.reasons) {
                        if (assessment.Has_Apex_Sharing__c && reasonText == apexSharingReason) {
                            hasApexSharingReason = true;
                        } else if (assessment.Has_Apex_Sharing_on_CDS_Object__c && reasonText == cdsReason) {
                            hasApexCdsReason = true;
                        }
                    }

                    if (assessment.Has_Apex_Sharing__c && !hasApexSharingReason) {
                        recommendation.complexity++;
                        recommendation.reasons.add(apexSharingReason);
                        String description = TransitionRecommendation.recommendationDescriptionMap.get(TransitionRecommendation.SHARING_SETTINGS_APEX_SHARE_REASON);
                        recommendation.descriptions.add(description == null ? '' : description);
                        recommendation.hasDescription.add(String.isNotBlank(description));
                        String title = TransitionRecommendation.recommendationDescriptionTitleMap.get(TransitionRecommendation.SHARING_SETTINGS_APEX_SHARE_REASON);
                        recommendation.titles.add(title == null ? '' : title);
                    }

                    if (assessment.Has_Apex_Sharing_on_CDS_Object__c && !hasApexCdsReason) {
                        recommendation.complexity++;
                        recommendation.reasons.add(cdsReason);
                        String description = TransitionRecommendation.recommendationDescriptionMap.get(TransitionRecommendation.SHARING_SETTINGS_APEX_SHARE_REASON);
                        recommendation.descriptions.add(description == null ? '' : description);
                        recommendation.hasDescription.add(String.isNotBlank(description));
                        String title = TransitionRecommendation.recommendationDescriptionTitleMap.get(TransitionRecommendation.SHARING_SETTINGS_APEX_SHARE_REASON);
                        recommendation.titles.add(title == null ? '' : title);
                    }
                }
            }
        }
        

        if (!hasSharingSettingsCheck && (assessment.Has_Apex_Sharing__c || assessment.Has_Apex_Sharing_on_CDS_Object__c)) {
            try {
                TransitionRecommendation sharingRecommendations = TransitionRecommendation.executeAction(assessment.Id, TransitionRecommendation.apexActionMap.get(TransitionRecommendation.SHARING_SETTINGS_RECOMMENDATION_TEXT));
                results.recommendations.add(sharingRecommendations);
                results.recommendations.sort();
            } catch (Exception e) {
                SystemLogger.log(LoggingLevel.ERROR, e, assessment.Id);
            }
        }
    }

    /**
     * CHECK ORG FEATURES
     **/


    //Check LEX enabled org
    public static Boolean isLEXEnabled() {
        Boolean hasLEX = false;
        // Check enabled org
        //(Metadata API) LightningExperienceSettings enableS1DesktopEnabled = true

        //Check LEX enabled users
        Integer totalUserCount = [SELECT COUNT() FROM User WHERE IsActive = true];
        Integer totalLEXUserCount = [SELECT COUNT() FROM User WHERE IsActive = true AND UserPreferencesLightningExperiencePreferred = true];
        Decimal percentOnLightning = ((totalLEXUserCount / totalUserCount) * 100);
        hasLEX = totalLEXUserCount > 1;

        return hasLEX;
    }

    //Check Person Accounts enabled
    public static Boolean isPersonAccountEnabled() {
        return Schema.sObjectType.Account.fields.getMap().containsKey('isPersonAccount');
    }

    //Check Person Accounts enabled
    private static Boolean isChatterEnabled() {
        return Schema.getGlobalDescribe().containsKey('FeedItem');
    }

    //Check for Contact to Multiple Accounts
    public static Boolean isContactMultipleAccountsEnabled() {
        Boolean hasContactToMultipleAccounts = false;
        try {
            hasContactToMultipleAccounts = !Schema.describeSObjects(new List<String>{
                    'AccountContactRelation'
            }).isEmpty();
        } catch (System.NoAccessException e) {
            String warnMsg = 'Please enable Contact to Multiple Accounts: /lightning/setup/AccountSettings/home';
            SystemLogger.log(LoggingLevel.WARN, warnMsg);
        }
        return hasContactToMultipleAccounts;
    }

    //Check for feature licenses FSC
    public static Boolean hasHCLicenses(InstallReadiness IR) {
        for (PermissionSetLicense license : [SELECT DeveloperName FROM PermissionSetLicense WHERE DeveloperName LIKE 'Health%']) {
            switch on license.DeveloperName {
                when 'HealthCloudGA_HealthCloudPsl' {
                    hasHealthCloudGA = true;
                    permSetsToAssign.add('HealthCloudGA_HealthCloudPsl');
                }
                when 'HealthCloudPlatformPsl' {
                    hasHealthCloudPlatform = true;
                    permSetsToAssign.add('HealthCloudPlatformPsl');
                }
                when 'HealthCloudPNMPsl' {
                    hasHealthCloudPNM = true;
                    permSetsToAssign.add('HealthCloudPNMPsl');
                }
            }
        }

        for (PermissionSetLicenseAssign psla : [
                SELECT PermissionSetLicense.DeveloperName
                FROM PermissionSetLicenseAssign
                WHERE PermissionSetLicense.DeveloperName IN :permSetsToAssign
        ]) {
            switch on psla.PermissionSetLicense.DeveloperName {
                when 'HealthCloudGA_HealthCloudPsl' {
                    IR.hasAssignedHcLicense = true;
                }
                when 'HealthCloudPlatformPsl' {
                    IR.hasAssignedHcPlatformLicense = true;
                }
                when 'HealthCloudPNMPsl' {
                    IR.hasAssignedPnmLicense = true;
                }
            }
            if (IR.hasAssignedHcLicense && IR.hasAssignedHcPlatformLicense && (IR.hasAssignedPnmLicense || !requiresPNMLicense)) {
                break;
            }
        }

        if (hasHealthCloudGA && hasHealthCloudPlatform) {
            return true;
        } else {
            return false;
        }
    }

    private static Boolean isMyDomainEnabled() {
        return String.valueOf(Url.getOrgDomainUrl()).contains('.my.');
    }

    /**
     * Generate recommendation for package installation readiness
     */
    private static TransitionRecommendation getInstallRecommendation(InstallReadiness readiness) {
        TransitionRecommendation recommendation = new TransitionRecommendation();
        if (readiness.isOrgInstallationReady) {
            recommendation.text = TransitionRecommendation.recommendTextMap.get('orgFscInstallationReady');
        } else {
            if (readiness.hasPackage) {
                recommendation.text = TransitionRecommendation.recommendTextMap.get('hasHc');
                recommendation.severity = TransitionRecommendationBase.SeverityLevel.SUCCESS;
            } else {
                recommendation.text = TransitionRecommendation.recommendTextMap.get('hasNoHc');
                recommendation.severity = TransitionRecommendationBase.SeverityLevel.INFO;
                if (!readiness.hasLex) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoLex'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoLex');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoLex');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (!readiness.hasPersonAccounts) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoPersonAccounts'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoPersonAccounts');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoPersonAccounts');
                    recommendation.titles.add(title == null ? '' : title);
                } else {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasPersonAccounts'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasPersonAccounts');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasPersonAccounts');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (!readiness.myDomainEnabled) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoMyDomain'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoMyDomain');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoMyDomain');
                    recommendation.titles.add(title == null ? '' : title);
                } else {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasMyDomain'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasMyDomain');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasMyDomain');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (!readiness.isChatterEnabled) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoChatter'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoChatter');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoChatter');
                    recommendation.titles.add(title == null ? '' : title);
                } else {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasChatter'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasChatter');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasChatter');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (!readiness.hasContactToMultipleAccounts) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoContactMultipleAccounts'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoContactMultipleAccounts');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoContactMultipleAccounts');
                    recommendation.titles.add(title == null ? '' : title);
                } else {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasContactMultipleAccounts'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasContactMultipleAccounts');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasContactMultipleAccounts');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (!readiness.isBaseLicensesAvailable) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoHcLicence'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoHcLicenses');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoHcLicenses');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (requiresPNMLicense && !readiness.isPNMLicenseAvailable) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNoPnmLicenses'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNoPnmLicenses');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNoPnmLicenses');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (readiness.isBaseLicensesAvailable && !readiness.hasAssignedHcLicense) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNotAssignedHcLicense'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNotAssignedHcLicense');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNotAssignedHcLicense');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (readiness.isBaseLicensesAvailable && !readiness.hasAssignedHcPlatformLicense) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNotAssignedHcPlatformLicense'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNotAssignedHcPlatformLicense');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNotAssignedHcPlatformLicense');
                    recommendation.titles.add(title == null ? '' : title);
                }
                if (requiresPNMLicense && readiness.isPNMLicenseAvailable && !readiness.hasAssignedPnmLicense) {
                    recommendation.reasons.add(TransitionRecommendation.recommendTextMap.get('hasNotAssignedPnmLicense'));
                    String description = TransitionRecommendation.recommendationDescriptionMap.get('hasNotAssignedPnmLicense');
                    recommendation.descriptions.add(description == null ? '' : description);
                    recommendation.hasDescription.add(String.isNotBlank(description));
                    String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('hasNotAssignedPnmLicense');
                    recommendation.titles.add(title == null ? '' : title);
                }
            }
        }
        return recommendation;
    }

    /**
     * Determine overall upgrade approach based on results calculate a complexity score and provide recommendation
     */
    public static TransitionRecommendation generateOverallRecommendation(ReadinessResults results) {
        TransitionRecommendation recommendation = new TransitionRecommendation();
        //calculate total complexity score
        Integer totalComplexity = 0;
        if(results!=null && results.recommendations!=null){
            for (TransitionRecommendation r : results.recommendations) {
                totalComplexity += r.complexity;
            }
        }
        
        recommendation.complexity = totalComplexity;
        //TODO update complexity based on dependency analysis (e.g. total apex classes > some limit)

        Map<String, String> recommendTextMap = TransitionRecommendation.recommendTextMap;

        //Clean Upgrade
        if (recommendation.complexity <= TransitionRecommendation.COMPLEXITY_THRESHOLD_BROWNFIELD_EASY) {
            recommendation.text = recommendTextMap.get('upgradeApproachBrownfieldClean');
            recommendation.reasons.add(recommendTextMap.get('upgradeApproachBrownfieldCleanSummary'));
            String description = TransitionRecommendation.recommendationDescriptionMap.get('upgradeApproachBrownfieldCleanSummary');
            recommendation.descriptions.add(description == null ? '' : description);
            recommendation.hasDescription.add(String.isNotBlank(description));
            String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('upgradeApproachBrownfieldCleanSummary');
            recommendation.titles.add(title == null ? '' : title);
            recommendation.severity = TransitionRecommendationBase.SeverityLevel.SUCCESS;
        }

        //Complex Upgrade
        else if (recommendation.complexity > TransitionRecommendation.COMPLEXITY_THRESHOLD_BROWNFIELD_EASY &&
                recommendation.complexity <= TransitionRecommendation.COMPLEXITY_THRESHOLD_BROWNFIELD_COMPLEX) {
            recommendation.text = recommendTextMap.get('upgradeApproachBrownfieldComplex');
            recommendation.reasons.add(recommendTextMap.get('upgradeApproachBrownfieldComplexSummary'));
            String description = TransitionRecommendation.recommendationDescriptionMap.get('upgradeApproachBrownfieldComplexSummary');
            recommendation.descriptions.add(description == null ? '' : description);
            String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('upgradeApproachBrownfieldComplexSummary');
            recommendation.titles.add(title == null ? '' : title);
            recommendation.hasDescription.add(String.isNotBlank(description));
            recommendation.severity = TransitionRecommendationBase.SeverityLevel.WARNING;
        }

        //New Org
        else if (recommendation.complexity > TransitionRecommendation.COMPLEXITY_THRESHOLD_BROWNFIELD_COMPLEX) {
            recommendation.text = recommendTextMap.get('upgradeApproachGreenfield');
            recommendation.reasons.add(recommendTextMap.get('upgradeApproachGreenfieldSummary'));
            String description = TransitionRecommendation.recommendationDescriptionMap.get('upgradeApproachGreenfieldSummary');
            recommendation.descriptions.add(description == null ? '' : description);
            String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('upgradeApproachGreenfieldSummary');
            recommendation.titles.add(title == null ? '' : title);
            recommendation.hasDescription.add(String.isNotBlank(description));
            recommendation.severity = TransitionRecommendationBase.SeverityLevel.CRITICAL;
        }

        //Set License/Transition Status
        if(results!=null && results.installReadiness!=null){
            if (!results.installReadiness.isBaseLicensesAvailable) {
                recommendation.reasons.add(recommendTextMap.get('installReadinessLicenses'));
                String description = TransitionRecommendation.recommendationDescriptionMap.get('installReadinessLicenses');
                recommendation.descriptions.add(description == null ? '' : description);
                recommendation.hasDescription.add(String.isNotBlank(description));
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('installReadinessLicenses');
                recommendation.titles.add(title == null ? '' : title);
            }
            if (!results.installReadiness.isOrgInstallationReady) {
                recommendation.reasons.add(recommendTextMap.get('installReadinessTransition'));
                String description = TransitionRecommendation.recommendationDescriptionMap.get('installReadinessTransition');
                recommendation.descriptions.add(description == null ? '' : description);
                recommendation.hasDescription.add(String.isNotBlank(description));
                String title = TransitionRecommendation.recommendationDescriptionTitleMap.get('installReadinessTransition');
                recommendation.titles.add(title == null ? '' : title);
            }
        }       

        return recommendation;
    }


    /**
     * Private Helper Methods
     */

    /**
     * Assessment record loader
     */
    public static Assessment__c getAssessment(Id assessmentId) {
        if (assessment == null) {
            assessment = AssessmentService.queryAssessment(assessmentId);
        }
        return assessment;
    }

    /**
     * Method to convert JSON string into this data type
     * TODO move into ReadinessResults class if moved to separate class
     */
    public static ReadinessResults loadReadinessResults(Assessment__c assessment) {
        ReadinessResults results;
        //load existing results
        try {
            String jsonString = assessment.AnalysisDataJSON__c != null ? assessment.AnalysisDataJSON__c : '{}';
            results = (ReadinessResults) JSON.deserialize(jsonString, ReadinessResults.class);
        } catch (JSONException e) {
            SystemLogger.log(LoggingLevel.ERROR, e, assessment.Id);
            throw new UpgradeException('Invalid ReadinessResults.class JSON: ' + e.getMessage());
        }
        return results;
    }

    /**
     * Custom Exceptions
     */

    public class UpgradeException extends Exception {
    }


    /**
     * Wrapper Classes
     **/

    /**
     * Wrapper top level for all readiness results
     * Assessment Report Results
     */
    public class ReadinessResults {
        public String assessmentVersion { get; private set; }
        public Datetime dateRun { get; private set; }
        public Id orgId { get; private set; }
        public String orgEdition { get; private set; }
        public String orgVersion { get; private set; }
        public UpgradeType upgradeType { get; private set; }
        public InstallReadiness installReadiness { get; private set; }
        public TransitionRecommendation overallRecommendation { get; set; }
        public List<TransitionRecommendation> recommendations { get; private set; }
        public TransitionAnalysis analysis { get; private set; }

        public ReadinessResults(UpgradeType upgradeType) {
            this.upgradeType = upgradeType;
            this.dateRun = Datetime.now();
            this.orgId = TransitionReadinessUtility.INSTANCE_ID;
            this.orgEdition = TransitionReadinessUtility.INSTANCE_EDITION;
            this.assessmentVersion = TransitionReadinessUtility.assessmentVersion;
            this.orgVersion = ExternalUtilities.getOrgVersionName(); //this performs API callout
            this.installReadiness = new InstallReadiness();
            this.recommendations = new List<TransitionRecommendation>();
        }

        /**
         * Serialize into JSON
         */
        public override String toString() {
            return JSON.serialize(this);
        }
    }

    /**
     * Wrapper to represent overall package installation readiness
     */
    public class InstallReadiness {
        @AuraEnabled public Boolean isOrgInstallationReady;
        @AuraEnabled public Boolean isBaseLicensesAvailable;
        @AuraEnabled public Boolean isPNMLicenseAvailable;
        @AuraEnabled public Boolean isLicensesAvailable;
        @AuraEnabled public Boolean hasPackage;
        @AuraEnabled public Boolean hasLex;
        @AuraEnabled public Boolean hasPersonAccounts;
        @AuraEnabled public Boolean myDomainEnabled;
        @AuraEnabled public Boolean isChatterEnabled;
        @AuraEnabled public Boolean hasContactToMultipleAccounts;
        @AuraEnabled public Boolean hasAssignedHcLicense = false;
        @AuraEnabled public Boolean hasAssignedHcPlatformLicense = false;
        @AuraEnabled public Boolean hasAssignedPnmLicense = false;
        @AuraEnabled public List<String> statusReasons = new List<String>();
    }

    /**
     * Supported Industry Upgrade Types
     **/
    public Enum UpgradeType {
        AC
    }

    public Enum IndustryType {
        FSC_BANKING,
        FSC_WEALTH
        //FSC_MORTGAGE,
        //FSC_INSURANCE
    }
}