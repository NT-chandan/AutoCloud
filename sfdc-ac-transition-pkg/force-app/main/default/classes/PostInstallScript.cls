/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
global class PostInstallScript implements InstallHandler {
    global void onInstall(InstallContext context) {
        ApexClass cls = [SELECT Name, NamespacePrefix FROM ApexClass WHERE Name = 'PostInstallScript' 
        AND (NamespacePrefix LIKE 'HCTransition%' OR NamespacePrefix LIKE 'FSCTransition%' OR NamespacePrefix LIKE 'HealthCloudTA%' OR NamespacePrefix LIKE 'ACTransition%' OR NamespacePrefix LIKE 'AutoTADev%' OR NamespacePrefix LIKE 'AutomotiveCloudTA%' OR NamespacePrefix = '') 
        ORDER BY CreatedDate DESC LIMIT 1];
        String nameSpacePrefix = cls.NamespacePrefix;
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name LIKE '%Transition_Assistant' AND NamespacePrefix =: nameSpacePrefix].Id;
        List<PermissionSetAssignment> existingPSAList = [SELECT AssigneeId, PermissionSet.Name, PermissionSetId FROM PermissionSetAssignment WHERE PermissionSetId =: permissionSetId AND AssigneeId =: context.installerId()];
        
        PermissionSetAssignment psa = new PermissionSetAssignment(
            AssigneeId = context.installerId(),
            PermissionSetId = permissionSetId
        );

        if(existingPSAList.size() <= 0) {
            insert psa;
        }

        //initialize custom settings
        //TransitionAppSettings settings = new TransitionAppSettings();
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
                System_Log_Level__c = 'Warn',
                Hide_Report_Summary__c = true);

            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{settings}, true);

            insert decision.getRecords()[0];
        }
    }
}