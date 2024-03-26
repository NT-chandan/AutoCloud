/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
/**
 * The purpose of this class is to facilitate generation of deployment package items that can be selected
 * for automatic deployment
 */
public with sharing class DeploymentChecklist {
    private static final String ASSESSMENT_FILE_DEPLOYMENT_LIST = 'deploymentList';
    private static final String PACKAGE_INSTALL_STATUS_PROCESSING = 'Generating Deployment Package';
    private static final String SECTION_RELATIONSHIPS = 'ChildRelationship';
    private static final String API_NAME_DUP_UNIQUE_SUFFIX = '_HC'; 

    /**
     * Custom label descriptions for each component type section
     */
    @TestVisible
    private static Map<String,String> SECTION_NAME_DESCRIPTION {
        get {
            if (SECTION_NAME_DESCRIPTION == null) {
                SECTION_NAME_DESCRIPTION = new Map<String,String>();
                String query = 'SELECT Title_Label__c, Description_Label__c FROM SFDC_Help__mdt WHERE Location__c = \'DeploymentChecklist\'';

                //Query Custom Metadata Type
                List<Object> metaRecords = ExternalUtilities.getCustomMetadata(new List<String>{query});
                List<SFDC_Help__mdt> helpMetadataList = (List<SFDC_Help__mdt>) JSON.deserialize(JSON.serialize(metaRecords[0]), List<SFDC_Help__mdt>.class);
                
                for(SFDC_Help__mdt helpMetadata : helpMetadataList) {
                    String descriptionText = ToolingService.customLabelMap.get(Utilities.namespaceUnderscore+helpMetadata.Description_Label__c);
                    SECTION_NAME_DESCRIPTION.put(helpMetadata.Title_Label__c, descriptionText);
                }
            }
            return SECTION_NAME_DESCRIPTION;
        }
        set;
    }

    /**
     * Generate list of deployable components from user defined mapping and Assessment migration analysis
     */
    @AuraEnabled(cacheable=true)
    public static List<DeploymentChecklistSection> generateDeploymentList(Id assessmentId) {
        List<DeploymentChecklistSection> deploymentSectionList = new List<DeploymentChecklistSection>();
        Map<String,DeploymentChecklistItem> idToItem = new Map<String,DeploymentChecklistItem>();
        //load user defined mapping
        MappingService.MappedComponents userMapping = MappingService.parseMappedComponents(assessmentId);
        
        System.debug('userMapping=======> ' + userMapping);
        //parse user defined mapping for new record types
        List<DeploymentChecklistItem>  deploymentItems = new List<DeploymentChecklistItem>();
        for (MappingService.RecordTypes recordTypeMapping : userMapping.recordTypeMappings) {
            if (recordTypeMapping.newMeta != null) {
                DeploymentChecklistItem checklistItem = new DeploymentChecklistItem();
                checklistItem.newMeta = (Map<String,Object>)JSON.deserializeUntyped(JSON.serialize(recordTypeMapping.newMeta));
                checklistItem.isNew = true;
                checklistItem.componentType = DependencyHelper.TYPE_RECORD_TYPE;
                checklistItem.componentName = recordTypeMapping.newMeta.apiName;
                checklistItem.componentLabel = checklistItem.componentName + ' (NEW)';
                checklistItem.componentId = recordTypeMapping.source;
                checklistItem.sourceObject = recordTypeMapping.sourceObject;
                checklistItem.targetObject = userMapping.sourceToDestinationRecordType.get(recordTypeMapping.sourceObject+'.'+recordTypeMapping.source)?.substringBefore('.');
                //target must not be same as source
                if (checklistItem.sourceObject != checklistItem.targetObject) {
                    deploymentItems.add(checklistItem);
                    idToItem.put(checklistItem.componentId, checklistItem);
                }
            }
        }
        if (!deploymentItems.isEmpty()) {
            deploymentSectionList.add(new DeploymentChecklistSection(DependencyHelper.TYPE_RECORD_TYPE, DependencyHelper.getTypeLabel(DependencyHelper.TYPE_RECORD_TYPE), deploymentItems));
        }
        
        //parse user defined mapping for new fields
        deploymentItems = new List<DeploymentChecklistItem>();
        for (MappingService.FieldMapping fieldMapping : userMapping.fieldMappings) {
            if (fieldMapping.newMeta != null) {
                DeploymentChecklistItem checklistItem = new DeploymentChecklistItem();
                fieldMapping.newMeta.apiName+='__c';
                checklistItem.newMeta = (Map<String,Object>)JSON.deserializeUntyped(JSON.serialize(fieldMapping.newMeta));
                checklistItem.isNew = true;
                checklistItem.componentType = DependencyHelper.TYPE_CUSTOM_FIELD;
                checklistItem.componentName = fieldMapping.newMeta.apiName;
                checklistItem.componentLabel = checklistItem.componentName + ' (NEW)';
                checklistItem.componentId = fieldMapping.source;
                checklistItem.sourceObject = fieldMapping.sourceObject;
                checklistItem.targetObject = userMapping.sourceToDestinationObject.containsKey(fieldMapping.sourceObject) ? userMapping.sourceToDestinationObject.get(fieldMapping.sourceObject) : fieldMapping.destination;
                //target must not be same as source
                if (checklistItem.sourceObject != checklistItem.targetObject) {
                    deploymentItems.add(checklistItem);
                    idToItem.put(checklistItem.componentId, checklistItem);
                }
            }
        }
        if (!deploymentItems.isEmpty()) {
            deploymentSectionList.add(new DeploymentChecklistSection(DependencyHelper.TYPE_CUSTOM_FIELD, DependencyHelper.getTypeLabel(DependencyHelper.TYPE_CUSTOM_FIELD), deploymentItems));
        }

        //parse user defined mapping for new child relationship fields
        deploymentItems = new List<DeploymentChecklistItem>();
        for (MappingService.ChildRelationship childRelation : userMapping.childRelationships) {
            if (childRelation.newMeta != null) {
                DeploymentChecklistItem checklistItem = new DeploymentChecklistItem();
                String originalFieldName = childRelation.newMeta.apiName;
                childRelation.newMeta.apiName = originalFieldName.substringBeforeLast('__').replaceAll('.*__','')+API_NAME_DUP_UNIQUE_SUFFIX+'__c'; //must have new API name
                childRelation.newMeta.childRelationshipName = childRelation.newMeta.childRelationshipName.substringBeforeLast('__').replaceAll('.*__','')+API_NAME_DUP_UNIQUE_SUFFIX; //remove namespace prefix and custom suffix
                checklistItem.newMeta = (Map<String,Object>)JSON.deserializeUntyped(JSON.serialize(childRelation.newMeta));
                checklistItem.isNew = true;
                checklistItem.componentType = DependencyHelper.TYPE_CUSTOM_FIELD;
                checklistItem.componentName = childRelation.newMeta.apiName;
                checklistItem.componentId =  originalFieldName;
                checklistItem.componentLabel = checklistItem.componentName + ' (NEW ' + childRelation.newMeta.dataType + ')';
                checklistItem.sourceObject = childRelation.sourceObject + ' -> ' + childRelation.source;
                checklistItem.targetObject = childRelation.sourceObject + ' -> ' + childRelation.newMeta.connectedObject;
                //target of new lookup/md relation must not be same as original
                if (childRelation.newMeta.connectedObject != childRelation.sourceObject) {
                    deploymentItems.add(checklistItem);
                    idToItem.put(checklistItem.componentId, checklistItem);
                }
            }
        }
        if (!deploymentItems.isEmpty()) {
            deploymentSectionList.add(new DeploymentChecklistSection(SECTION_RELATIONSHIPS, Label.DeploymentChecklistSectionChildRelation, deploymentItems));
        }
        
        //parse Migration Analysis for all other deployable components migrating to FSC objects as parent
        deploymentItems = new List<DeploymentChecklistItem>();
        Map<String,List<DeploymentChecklistItem>> typeToItems = new Map<String,List<DeploymentChecklistItem>>();
        TransitionAnalysis analysis = TransitionAnalysis.loadAnalysis(assessmentId);
        List<String> targets;
        if (analysis != null) {
            //loop top level object nodes
            for (TransitionAnalysis.MigrationAnalysisItem mai : analysis.migrationAnalysis) {
                String sourceObjectName = mai.fromComponentName;
                String targetObjectNameAll = mai.toComponentName;
                //Split per target object
                targets = targetObjectNameAll.split(', ');
                //target must not be same as source
                for (String targetObjectName : targets) {
                    if (sourceObjectName != targetObjectName) {
                        //loop each component type
                        for (TransitionAnalysis.MigrationAnalysisItem maiType : mai.children) {
                            if (maiType.fromComponentType != DependencyHelper.TYPE_RECORD_TYPE && 
                                maiType.fromComponentType != DependencyHelper.TYPE_CUSTOM_FIELD && 
                                TransitionAnalysis.COMPONENT_TYPES_DEPLOYABLE.contains(maiType.fromComponentType)) {
                                //add to deployment list for given type
                                for (TransitionAnalysis.MigrationAnalysisItem maiTypeComponent : maiType.children) {
                                    List<DeploymentChecklistItem> items = typeToItems.get(maiType.fromComponentType);
                                    if (items == null) { items = new List<DeploymentChecklistItem>(); }
                                    //if (!idToItem.containsKey(maiTypeComponent.fromComponentId)) {
                                        DeploymentChecklistItem checklistItem = new DeploymentChecklistItem(maiTypeComponent, sourceObjectName, targetObjectName);
                                        idToItem.put(checklistItem.componentId, checklistItem);
                                        items.add(checklistItem);
                                        typeToItems.put(maiType.fromComponentType, items);
                                    //}
                                    //check component child references
                                    for (TransitionAnalysis.MigrationAnalysisItem maiTypeComponentChild : maiTypeComponent.children) {
                                        items = typeToItems.get(maiTypeComponentChild.fromComponentType);
                                        if (items == null) { items = new List<DeploymentChecklistItem>(); }
                                        if (maiTypeComponentChild.fromComponentType != DependencyHelper.TYPE_CUSTOM_FIELD && //skip custom fields - handled section above
                                            !idToItem.containsKey(maiTypeComponentChild.fromComponentId) && //prevent duplicates
                                            TransitionAnalysis.COMPONENT_TYPES_DEPLOYABLE.contains(maiTypeComponentChild.fromComponentType)) { //supported type for deployment
                                            
                                            DeploymentChecklistItem checklistChildItem = new DeploymentChecklistItem(maiTypeComponentChild, sourceObjectName, targetObjectName);
                                            idToItem.put(checklistChildItem.componentId, checklistChildItem);
                                            items.add(checklistChildItem);
                                            typeToItems.put(maiType.fromComponentType, items);
                                        }
                                    }
                                }
                            }
                        }
                    } 
                }             
            }
            //add collected items by component type
            for (String typeName : typeToItems.keySet()) {
                deploymentSectionList.add(new DeploymentChecklistSection(typeName, DependencyHelper.getTypeLabel(typeName), typeToItems.get(typeName)));
            }

            //collect objects with new mappings
            Set<String> mappedObjectsNewTarget = new Set<String>();
            for (String sourceObj : userMapping.sourceToDestinationObject.keySet()) {
                String targetObj = userMapping.sourceToDestinationObject.get(sourceObj);
                if (String.isNotBlank(targetObj) && sourceObj != targetObj) {
                    mappedObjectsNewTarget.add(sourceObj);
                }
            }
            //get mapped and custom profiles
            Set<Id> mappedProfileIds = new Set<Id>();
            Set<Id> customProfileIds = new Set<Id>();
            for(AggregateResult permissionAgg : [
                SELECT ParentId parentId, Parent.ProfileId profileId, Parent.IsCustom isCustom, Parent.IsOwnedByProfile isProfile
                FROM ObjectPermissions
                WHERE SObjectType IN :mappedObjectsNewTarget
                GROUP BY ParentId, Parent.ProfileId, Parent.IsCustom, Parent.IsOwnedByProfile
            ]) {
                Id permissionComponentId = Boolean.valueOf(permissionAgg.get('isProfile')) ?
                                            (Id)permissionAgg.get('profileId') :
                                            (Id)permissionAgg.get('parentId');
                mappedProfileIds.add(permissionComponentId);
                if (Boolean.valueOf(permissionAgg.get('isCustom'))) {
                    customProfileIds.add(permissionComponentId);  
                }
            }
            //add custom profiles and permissionsets as deployment items
            List<DeploymentChecklistItem> profileItems = new List<DeploymentChecklistItem>();
            List<DeploymentChecklistItem> permissionSetItems = new List<DeploymentChecklistItem>();
            for (TransitionAnalysis.MigrationAnalysisItem profilePermItem : analysis.accessInfoResults) {
                DeploymentChecklistItem deploymentItem = new DeploymentChecklistItem(profilePermItem, '', '');
                //only include profile/perm set with mapped objects
                if (mappedProfileIds.contains(profilePermItem.fromComponentId)) {
                    if (profilePermItem.fromComponentType == DependencyHelper.TYPE_PROFILE) {
                        deploymentItem.isCustom = customProfileIds.contains(profilePermItem.fromComponentId);
                        profileItems.add(deploymentItem);
                    } else if (profilePermItem.fromComponentType == DependencyHelper.TYPE_PERMISSION_SET) {
                        permissionSetItems.add(deploymentItem);
                    }
                }
            }
            if (!profileItems.isEmpty()) {
                deploymentSectionList.add(new DeploymentChecklistSection(DependencyHelper.TYPE_PROFILE, DependencyHelper.getTypeLabel(DependencyHelper.TYPE_PROFILE), profileItems));
            }
            if (!permissionSetItems.isEmpty()) {
                deploymentSectionList.add(new DeploymentChecklistSection(DependencyHelper.TYPE_PERMISSION_SET,  DependencyHelper.getTypeLabel(DependencyHelper.TYPE_PERMISSION_SET), permissionSetItems));
            }
        }

        return deploymentSectionList;
    }

    /**
     * Save results file and callout to external service to generate deployment package .zip
     * and save back so SF as ContentDocument related to assessmentId. Update Assessment Status for processing.
     */
    @AuraEnabled
    public static Boolean generateDeploymentPackage(Id assessmentId, Id deploymentFileId) {
        Boolean isProcessing = ExternalUtilities.requestGenerateDeploymentPackage(assessmentId, deploymentFileId);
        if (isProcessing) {
            AssessmentService.updateAssessment(new Assessment__c(Id = assessmentId, Sub_Status__c = PACKAGE_INSTALL_STATUS_PROCESSING));
        }
        return isProcessing;
    }

    /**
     * Save selected checkist items into a File for use with deployment package generation
     */
    @AuraEnabled
    public static Id saveDeploymentChecklist(Id assessmentId, String itemsToDeployJson) {
        Map<String,Object> deploymentMap = new Map<String,Object> {
            'mapping' => MappingService.parseMappedComponents(assessmentId),
            'deployment' => JSON.deserializeUntyped(itemsToDeployJson)
        };
        return FileUtility.writeFileData(assessmentId, ASSESSMENT_FILE_DEPLOYMENT_LIST, 'json', JSON.serialize(deploymentMap, true)); //suppress nulls
    }

    /**
     * Wrapper class for component section with list components for checkbox selection data table
     */
    public class DeploymentChecklistSection {
        @AuraEnabled public String sectionName;
        @AuraEnabled public String sectionLabel;
        @AuraEnabled public String sectionDescription;
        @AuraEnabled public List<DeploymentChecklistItem> components = new List<DeploymentChecklistItem>();

        public DeploymentChecklistSection(String sectionName, String sectionLabel, List<DeploymentChecklistItem> components) {
            this.sectionName = sectionName;
            this.sectionLabel = sectionLabel;
            this.components = components;
            this.sectionDescription = SECTION_NAME_DESCRIPTION.get(this.sectionName);
            this.postProcessItems();
        }

        /**
         * Perform specific post processing task on component section types
         */
        public void postProcessItems() {
            switch on sectionName {
                when 'CompactLayout', 'Layout' {
                    //special handling PersonAccount
                    for (DeploymentChecklistItem itm : components) {
                        if (itm.sourceObject == 'Contact' && itm.targetObject ==  DependencyHelper.TYPE_ACCOUNT) {
                            itm.targetObject = DependencyHelper.TYPE_PERSON_ACCOUNT;
                        }
                    }
                }
                when 'EmailTemplate' {
                    //get folder names
                    Set<String> templateNames = new Set<String>();
                    for (DeploymentChecklistItem itm : components) {
                        templateNames.add(itm.componentName);
                    }
                    Map<Id, EmailTemplate> templateMap = new Map<Id, EmailTemplate>([
                        SELECT Id, FolderName
                        FROM EmailTemplate
                        WHERE DeveloperName IN :templateNames
                    ]);
                    for (DeploymentChecklistItem itm : components) {
                        String folderName = templateMap.get(itm.componentId)?.FolderName;
                        folderName = folderName == 'Unfiled Public Classic Email Templates' ? 'unfiled$public' : folderName;
                        itm.componentName = folderName + '/' + itm.componentName;
                    }
                }
                when 'ListView' {
                    //remove system views
                    for (Integer i=0; i<components.size(); i++) {
                        if (components[i].componentName.startsWith('Recently Viewed')) {
                            components.remove(i);
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Wrapper class for checkbox selection data table
     */
    public class DeploymentChecklistItem {
        @AuraEnabled public String componentId;
        @AuraEnabled public String componentName;
        @AuraEnabled public String componentLabel;
        @AuraEnabled public String componentType;
        @AuraEnabled public String componentUrl;
        @AuraEnabled public String sourceObject;
        @AuraEnabled public String targetObject;
        @AuraEnabled public Boolean isNew;
        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public Map<String,Object> newMeta;

        public DeploymentChecklistItem() {}

        public DeploymentChecklistItem(TransitionAnalysis.MigrationAnalysisItem mai, String sourceObject, String targetObject) {
            this.componentId = mai.fromComponentId;
            this.componentType = mai.fromComponentType;
            this.componentName = mai.fromComponentName;
            this.componentLabel = mai.fromComponentName;
            this.componentUrl = mai.fromComponentUrl;
            this.sourceObject = sourceObject;
            this.targetObject = targetObject;
        }
    }
}