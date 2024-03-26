/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class TransitionAppSettings {

    public static Set<String> asyncTypesToEnqueue = new Set<String>();
    public static Map<String, List<Id>> parentIdsByDependentTypes = new Map<String, List<Id>>();

    public Boolean collapseWelcomeSectionByDefault {
        get {
            return GetSettings().Collapse_Welcome_Section_By_Default__c;
        }
    }

    public Boolean asyncRequestsAreEnabled {
        get {
            return GetSettings().Async_Requests_Are_Enabled__c;
        }
    }

    public Boolean exclusionListActive {
        get {
            return GetSettings().Exclusion_List_Active__c;
        }
    }

    public String systemLogLevel {
        get {
            return GetSettings().System_Log_Level__c;
        }
    }

    public Decimal mdtComponentDependencyBatchSize {
        get {
            return GetSettings().MetadataComponentDependencyBatchSize__c;
        }
    }

    @TestVisible
    private static TransitionAppSettings__c testConfig = null;

    @TestVisible
    private TransitionAppSettings__c GetSettings() {
        if (Test.isRunningTest() && testConfig != null) return testConfig;

        TransitionAppSettings__c settings = TransitionAppSettings__c.getOrgDefaults();
        if(settings.SetupOwnerId == null) // No custom settings record yet
        {
            // settings = new TransitionAppSettings__c(
            //     SetupOwnerId = UserInfo.getOrganizationId()
            // );

            settings = new TransitionAppSettings__c(
                Collapse_Welcome_Section_By_Default__c = true,
                Async_Requests_Are_Enabled__c = true,
                SetupOwnerId = UserInfo.getOrganizationId(),
                System_Log_Level__c = 'Warn');

            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{settings}, true);

            if (!Test.isRunningTest()) insert decision.getRecords()[0];
            else testConfig = settings;
        }

        return settings;
    }

    public void updateCollapseWelcomeSectionByDefault(Boolean collapseWelcomeSectionByDefault) {
        TransitionAppSettings__c settings = GetSettings();
        settings.Collapse_Welcome_Section_By_Default__c = collapseWelcomeSectionByDefault;

        if (!Test.isRunningTest()) update settings;
    }

    public void updateSystemLogLevel(LoggingLevel loggingLevel) {
        TransitionAppSettings__c settings = GetSettings();
        settings.System_Log_Level__c = String.valueOf(loggingLevel);

        if (!Test.isRunningTest()) update settings;
    }

}