/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class ToolingService {

    static final String EXTERNAL_STRING_QUERY = 'SELECT Id, Name, Value, Language FROM ExternalString WHERE NamespacePrefix = \''+Utilities.namespace+'\'';
    static final String EXTERNAL_STRING_LOCALIZATION_QUERY = 'SELECT ExternalStringId, Value, Language FROM ExternalStringLocalization';
    static final String INSTALLED_PACKAGE_QUERY = 'SELECT SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber FROM InstalledSubscriberPackage';
    static final String SUBSCRIBER_CUSTOM_OBJECT_QUERY = 'SELECT Id, DeveloperName FROM CustomObject WHERE NamespacePrefix = null';
    static final String SUBSCRIBER_CUSTOM_FIELD_QUERY = 'SELECT DurableId, QualifiedApiName, EntityDefinition.QualifiedApiName FROM FieldDefinition';

    // Tooling API queries for the Report Summary
    static final String APEX_CLASS_COUNT_QUERY = 'SELECT COUNT() FROM ApexClass';
    static final String APEX_TRIGGER_COUNT_QUERY = 'SELECT COUNT() FROM ApexTrigger';
    static final String PROFILE_COUNT_QUERY = 'SELECT COUNT() FROM Profile';
    static final String PERMISSION_SET_COUNT_QUERY = 'SELECT COUNT() FROM PermissionSet';
    static final String FLOW_COUNT_QUERY = 'SELECT COUNT() FROM Flow WHERE ProcessType = \'Flow\'';
    static final String PROCESS_BUILDER_COUNT_QUERY = 'SELECT COUNT() FROM Flow WHERE ProcessType = \'Workflow\'';
    static final String WORKFLOW_COUNT_QUERY = 'SELECT COUNT() FROM WorkflowRule';
    static final String CUSTOM_OBJECT_COUNT_QUERY = 'SELECT COUNT() FROM EntityDefinition WHERE KeyPrefix LIKE \'a0%\' AND IsCustomSetting = false';
    static final String CUSTOM_APPLICATION_COUNT_QUERY = 'SELECT COUNT() FROM CustomApplication';

    //Platform Cache Keys
    static final String CACHE_PARTITION = (String.isNotBlank(Utilities.namespace) ? Utilities.namespace : 'local')+'.TransitionCache';
    static final Cache.OrgPartition CACHE_ORG = Cache.Org.getPartition(CACHE_PARTITION);
    static final String CACHE_KEY_CUSTOM_LABELS = 'customLabelMap';
    static final Integer CACHE_DURATION_HOUR = 3600;

    @TestVisible
    static String userLanguage  {
        get {
            if(userLanguage == null) {
                userLanguage = UserInfo.getLanguage();
            }
            return userLanguage;
        }
        set; 
    }

    public static Map<String, String> customLabelMap {
        get {
            //try platform cache under user language
            if (customLabelMap == null) {
                String cacheKey = CACHE_KEY_CUSTOM_LABELS + userLanguage.replaceAll('_', '');
                customLabelMap = (Map<String, String>)CACHE_ORG.get(cacheKey);
            }
            //build new
            if(customLabelMap == null) {
                customLabelMap = new Map<String, String>();
                String response = getExternalStringResponse();
                if(response != null) {
                    System.debug('response=====> ' + response);
                    List<ExternalString> labelList = parseExternalStringResponse(response).records;
                    if(labelList != null) {
                        for(ExternalString label : labelList) {
                            customLabelMap.put(Utilities.namespaceUnderscore+label.Name, label.Value);
                            if(userLanguage != label.Language) {
                                List<ExternalStringLocalization> translations = customLabelTranslationMap.get(label.Id);
                                if(translations != null) {
                                    for(ExternalStringLocalization translation : translations) {
                                        if(userLanguage == translation.Language) {
                                            customLabelMap.put(Utilities.namespaceUnderscore+label.Name, translation.Value);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        //Cache by language for repeated calls
                        String cacheKey = CACHE_KEY_CUSTOM_LABELS + userLanguage.replaceAll('_', '');
                        CACHE_ORG.put(cacheKey, customLabelMap, CACHE_DURATION_HOUR, Cache.Visibility.NAMESPACE, true);
                    }
                }
            }
            return customLabelMap;
        }
        set;
    }

    @TestVisible
    static Map<String, List<ExternalStringLocalization>> customLabelTranslationMap {
        get {
            if(customLabelTranslationMap == null) {
                customLabelTranslationMap = new Map<String, List<ExternalStringLocalization>>();
                String response = getExternalStringLocalizationResponse();
                if(response != null) {
                    List<ExternalStringLocalization> labelList = parseExternalStringLocalizationResponse(response).records;
                    if(labelList != null) {
                        for(ExternalStringLocalization label : labelList) {
                            List<ExternalStringLocalization> currentList = customLabelTranslationMap.get(label.ExternalStringId);
                            if(currentList == null) {
                                customLabelTranslationMap.put(label.ExternalStringId, new List<ExternalStringLocalization>{label});
                            }
                            else {
                                currentList.add(label);
                            }
                        }    
                    }
                }
            }
            return customLabelTranslationMap;
        }
        set;
    }

    public static Map<String, InstalledSubscriberPackage> fscPackageMap {
        get {
            if(fscPackageMap == null) {
                fscPackageMap = new Map<String, InstalledSubscriberPackage>();
                String response = getFSCPackageResponse();
                if(response != null) {
                    List<InstalledSubscriberPackage> packageList = parseInstalledSubscriberPackageResponse(response).records;
                    if(packageList != null) {
                        for(InstalledSubscriberPackage installedPackage : packageList) {
                            fscPackageMap.put(installedPackage.SubscriberPackage.Name, installedPackage);
                        }
                    }
                }
            }
            return fscPackageMap;
        }
        set;
    }

    public static Map<String, InstalledSubscriberPackage> installedPackageMap {
        get {
            if(installedPackageMap == null) {
                installedPackageMap = new Map<String, InstalledSubscriberPackage>();
                String response = getInstalledSubscriberPackageResponse();
                if(response != null) {
                    List<InstalledSubscriberPackage> packageList = parseInstalledSubscriberPackageResponse(response).records;
                    if(packageList != null) {
                        for(InstalledSubscriberPackage installedPackage : packageList) {
                            installedPackageMap.put(installedPackage.SubscriberPackage.NamespacePrefix, installedPackage);
                        }
                    }
                }
            }
            return installedPackageMap;
        }
        private set;
    }

    public static Map<String, String> customObjectNameIdMap {
        get {
            if(customObjectNameIdMap == null) {
                customObjectNameIdMap = new Map<String, String>();
                String response = getSubscriberCustomObjectResponse();
                if(response != null) {
                    List<CustomObject> responseList = parseCustomObjectResponse(response).records;
                    if(responseList != null) {
                        for(CustomObject customObject : responseList) {
                            customObjectNameIdMap.put(customObject.DeveloperName, customObject.Id);
                        }
                    }
                }
            }
            return customObjectNameIdMap;
        }
        private set;
    }

    @TestVisible
    private static Map<String, CustomField> customFieldByFieldApiName;

    public static String nonAdminMessage {
        get {
            if (String.isBlank(nonAdminMessage)) {
                nonAdminMessage = customLabelMap.get(Utilities.namespaceUnderscore + 'NonAdminMessage');
            }
            return nonAdminMessage;
        }
        private set;
    }

    public static String getSubscriberCustomObjectResponse(){
        return ExternalUtilities.executeToolingQuery(SUBSCRIBER_CUSTOM_OBJECT_QUERY);
    }
    public static String getSubscriberCustomFieldResponse(Map<String,Set<String>> fieldsByObject){
        String result = '';
        String whereClause = buildCustomFieldWhereClause(fieldsByObject);
        String query = SUBSCRIBER_CUSTOM_FIELD_QUERY;

        if (String.isNotBlank(whereClause)) {
            query += whereClause;
            result = ExternalUtilities.executeToolingQuery(query);
        }
        return result;
    }

    @TestVisible
    private static String buildCustomFieldWhereClause(Map<String,Set<String>> fieldsByObject) {
        String whereClause = '';

        if (fieldsByObject != null) {
            Set<String> fields = new Set<String>();
            Set<String> objects = new Set<String>();
            for (String objectName : fieldsByObject.keySet()) {
                objects.add(String.escapeSingleQuotes(objectName));
                for (String theField : fieldsByObject.get(objectName)) {
                    fields.add(String.escapeSingleQuotes(theField));
                }
            }

            List<String> objectNames = new List<String>(objects);
            String objectNamesString = '\'' + String.join(objectNames,'\',\'') + '\'';
            List<String> fieldNames = new List<String>(fields);
            String fieldNamesString = '\'' + String.join(fieldNames,'\',\'') + '\'';
            whereClause += ' WHERE EntityDefinition.QualifiedApiName IN (' + objectNamesString + ')';
            whereClause += ' AND QualifiedApiName IN (' + fieldNamesString + ')';
        }
        return whereClause;
    }

    public static String getExternalStringResponse(){
        return ExternalUtilities.executeToolingQuery(EXTERNAL_STRING_QUERY);
    }

    public static String getExternalStringLocalizationResponse(){
        return ExternalUtilities.executeToolingQuery(EXTERNAL_STRING_LOCALIZATION_QUERY);
    }

    public static String getInstalledSubscriberPackageResponse(){
        return ExternalUtilities.executeToolingQuery(INSTALLED_PACKAGE_QUERY);
    }

    public static String getFSCPackageResponse(){
        return ExternalUtilities.executeFSCToolingQuery(INSTALLED_PACKAGE_QUERY);
    }

    /**
     * Dependency API Tooling Query
     */
    public static List<MetadataComponentDependency> queryDependencies(String queryString) {
        ToolingMetadataComponentDependencyResponse toolingResponse = parseMetadataComponentDependencyResponse(
            ExternalUtilities.executeToolingQuery(queryString)
        );
        return toolingResponse != null ? toolingResponse.records : null;
    }

    /**
     * JSON Parse to data types
     */

    public static ToolingCustomObjectResponse parseCustomObjectResponse(String jsonStr) {
        return (ToolingCustomObjectResponse)JSON.deserialize(
            jsonStr, 
            ToolingCustomObjectResponse.class
        );
    }

    public static ToolingCustomFieldResponse parseCustomFieldResponse(String jsonStr) {
        return (ToolingCustomFieldResponse)JSON.deserialize(
                jsonStr,
                ToolingCustomFieldResponse.class
        );
    }

    @TestVisible
    static ToolingExternalStringResponse parseExternalStringResponse(String jsonStr) {
        System.debug('jsonSTR=====> ' + jsonStr);
        return (ToolingExternalStringResponse)JSON.deserialize(
            jsonStr, 
            ToolingExternalStringResponse.class
        );    
    }

    public static ToolingExternalStringLocalizationResponse parseExternalStringLocalizationResponse(String jsonStr) {
        return (ToolingExternalStringLocalizationResponse)JSON.deserialize(
            jsonStr, 
            ToolingExternalStringLocalizationResponse.class
        );
    }

    public static ToolingInstalledSubscriberPackageResponse parseInstalledSubscriberPackageResponse(String jsonStr) {
        return (ToolingInstalledSubscriberPackageResponse)JSON.deserialize(
            jsonStr, 
            ToolingInstalledSubscriberPackageResponse.class
        );
    }

    public static ToolingMetadataComponentDependencyResponse parseMetadataComponentDependencyResponse(String jsonStr) {
        return (ToolingMetadataComponentDependencyResponse)JSON.deserialize(
            jsonStr, 
            ToolingMetadataComponentDependencyResponse.class
        );
    }

    public static List<MetadataComponentDependency> parseMetadataComponentDependencyList(String jsonStr) {
        return (List<MetadataComponentDependency>)JSON.deserialize(
            jsonStr, 
            List<MetadataComponentDependency>.class
        );
    }

    // Methods to retrieve records counts via the Tooling API for the Report Summary
    public static String getApexClassCountResponse(){
        ReportSummaryOverviewCount apexCountResponse = parseReportSummaryOverviewCount(
            ExternalUtilities.executeToolingQuery(APEX_CLASS_COUNT_QUERY)
        );

        return apexCountResponse.size != null ? String.valueOf(apexCountResponse.size) : nonAdminMessage;
    }

    public static String getApexTriggerCountResponse(){
        ReportSummaryOverviewCount apexTriggerCountResponse = parseReportSummaryOverviewCount(
            ExternalUtilities.executeToolingQuery(APEX_TRIGGER_COUNT_QUERY)
        );

        return apexTriggerCountResponse.size != null ? String.valueOf(apexTriggerCountResponse.size) : nonAdminMessage;
    }

    public static String getProfileCountResponse(){
        ReportSummaryOverviewCount profileCountResponse = parseReportSummaryOverviewCount(
            ExternalUtilities.executeToolingQuery(PROFILE_COUNT_QUERY)
        );

        return profileCountResponse.size != null ? String.valueOf(profileCountResponse.size) : nonAdminMessage;
    }

    public static String getPermissionSetCountResponse(){
        ReportSummaryOverviewCount permissionSetCountResponse = parseReportSummaryOverviewCount(
            ExternalUtilities.executeToolingQuery(PERMISSION_SET_COUNT_QUERY)
        );

        return permissionSetCountResponse.size != null ? String.valueOf(permissionSetCountResponse.size) : nonAdminMessage;
    }

    public static ReportSummaryOverviewCount parseReportSummaryOverviewCount(String jsonStr) {
        ReportSummaryOverviewCount summaryOverviewCount;
        if (jsonStr != null) {
            summaryOverviewCount = (ReportSummaryOverviewCount)JSON.deserialize(
                jsonStr,
                ReportSummaryOverviewCount.class
            );
        } else {
            summaryOverviewCount = new ReportSummaryOverviewCount();
        }
        return summaryOverviewCount;
    }    

    /**
     * CustomObject Tooling Query Response
     */
    public class ToolingCustomObjectResponse {
        public Integer size;
        public Integer totalSize;
        public List<CustomObject> records;
    }

    /**
     * CustomField Tooling Query Response
     */
    public class ToolingCustomFieldResponse {
        public Integer size;
        public Integer totalSize;
        public List<CustomField> records;
    }

    /**
     * ExternalString Tooling Query Response
     */
    public class ToolingExternalStringResponse {
        public Integer size {get;set;} 
        public Integer totalSize {get;set;} 
        public Boolean done {get;set;} 
        public Object queryLocator {get;set;} 
        public String entityTypeName {get;set;} 
        public List<ExternalString> records {get;set;} 
    }

    /**
     * ExternalStringLocalization Tooling Query Response
     */
    public class ToolingExternalStringLocalizationResponse {
        public Integer size {get;set;} 
        public Integer totalSize {get;set;} 
        public Boolean done {get;set;} 
        public Object queryLocator {get;set;} 
        public String entityTypeName {get;set;} 
        public List<ExternalStringLocalization> records {get;set;} 
    }

    /**
     * InstalledSubscriberPackage Tooling Query Response
     */
    public class ToolingInstalledSubscriberPackageResponse {
        public Integer size;
        public Integer totalSize;
        public List<InstalledSubscriberPackage> records;
    }

    /**
     * Dependency API Tooling Query Response
     */
    public class ToolingMetadataComponentDependencyResponse {
        public Integer size;
        public Integer totalSize;
        public List<MetadataComponentDependency> records;
    }

    /**
     * Custom Object Tooling Data Type
     */
    public class CustomObject {
        public String Id {get;set;}
        public String DeveloperName {get;set;}
    }

    /**
     * Custom Object Tooling Data Type
     */
    public class CustomField {
        public String DurableId {get;set;}
        public String QualifiedApiName {get;set;}
        public EntityDefinition EntityDefinition {get;set;}
    }

    public class EntityDefinition {
        public String QualifiedApiName {get;set;}
    }

    /**
     * Custom Label Tooling Data Type
     */
    public class ExternalString {
        public String Id {get;set;}
        public String Name {get;set;}
        public String Language {get;set;}
        public String Value {get;set;}
    }

    /**
     * Custom Label Translation Tooling Data Type
     */
    public class ExternalStringLocalization {
        public String ExternalStringId {get;set;}
        public String Value {get;set;}
        public String Language {get;set;}
    }

    /**
     * InstalledSubscriberPackage Data Type
     */
    public class InstalledSubscriberPackage {
        public SubscriberPackage SubscriberPackage {get;set;}
        public SubscriberPackageVersion SubscriberPackageVersion {get;set;}
    }

    /**
     * Dependency API Tooling Data Type
     */
    public class MetadataComponentDependency {
        public String MetadataComponentId;
        public String MetadataComponentType;
        public String MetadataComponentName;
        public String MetadataComponentNamespace;
        public String RefMetadataComponentId;
        public String RefMetadataComponentType;
        public String RefMetadataComponentNamespace;
        public String RefMetadataComponentName;
    }

    /**
     * SubscriberPackage Data Type
     */
    public class SubscriberPackage {
        public String Name {get;set;}
        public String NamespacePrefix {get;set;}
    }

    /**
     * SubscriberPackageVersion Data Type
     */
    public class SubscriberPackageVersion {
        public String Id {get;set;}
        public String Name {get;set;}
        public String MajorVersion {get;set;}
        public String MinorVersion {get;set;}
        public String PatchVersion {get;set;}
        public String BuildNumber {get;set;}
    }

    /**
     * Report Summary Metadata Count Data Type
     */
    public class ReportSummaryOverviewCount {
        public Integer size {get;set;}
    }



}