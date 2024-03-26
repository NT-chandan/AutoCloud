/*
* Copyright (c) 2023, Salesforce, Inc.
* All rights reserved.
* SPDX-License-Identifier: Apache 2.0 Clause
* For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
*/
public inherited sharing class ApexShareReferenceScanQueueable extends AsyncRequestProcessor {
    private static final Integer DEFAULT_BATCH_SIZE = 10;
    private static final String APEX_CLASS_QUERY = 'SELECT Id, Name FROM ApexClass WHERE Status = \'Active\' AND NamespacePrefix = null And LengthWithoutComments < 500000 ';
    private Id assessmentId;
    private Set<String> classNames;
    private Boolean hasReferenceToShare = false;
    private Boolean hasReferenceToShareOnCDS = false;
    private MappingService.MappedComponents mapping = MappingService.parseMappedComponents(assessmentId);
    private List<TransitionAnalysis.MigrationAnalysisItem> migrationAnalysisItems = new List<TransitionAnalysis.MigrationAnalysisItem>();
    
    private void processRequest(AsyncRequest__c request) {
        this.assessmentId = request.Assessment__c;
        this.classNames = new Set<String>(request.Params__c.split('\\|'));
        
        scanClass();
    }
    
    private void scanClass() {
        String shareStr = '__share';
        String accountShareStr = 'accountshare';
        String oppShareStr = 'opportunityshare';
        Integer subStrThreshold = 100;	// look 100 characters before and after the shareStr to create substring of the class to do the pattern match on to avoid hitting the Regex too complex error
        Pattern shareObjectReference = Pattern.compile('(?mi)([\\w]+__share)');
        //Only Account and Opportunity are supported by CDS currently.
        Pattern cdsPattern = Pattern.compile('(?mi)(AccountShare|OpportunityShare)');
        Matcher patternMatcher;
        Matcher cdsMatcher;	
        Set<String> sharesFound = new Set<String>();
        
        List<ApexClass> apexClasses = [SELECT Id, Name, LengthWithoutComments, Body From ApexClass Where Name In :this.classNames AND NamespacePrefix = null];
        Map<String, ApexClass> apexClassMap = new Map<String, ApexClass>();
        
        for (ApexClass apexClass : apexClasses) {
            apexClassMap.put(apexClass.Name, apexClass);
        }
        
        if(Test.isRunningTest()){
            String mockClass = '\n/* AccountShare[] share = new AccountShare(UserOrGroupId = requestor.Manager__c, ParentId = tor.Id, AccessLevel = \'Read\') | OpportunityShare[] share = new OpportunityShare(UserOrGroupId = requestor.Manager__c, ParentId = tor.Id, AccessLevel = \'Read\') | Test_Object__Share share = new Test_Object__Share(UserOrGroupId = requestor.Manager__c, ParentId = tor.Id, AccessLevel = \'Read\') */';
            ApexClass apexClass = new ApexClass();
            apexClass.Body = mockclass;
            apexClassMap.put('test', apexClass);
        }
        
        for (String apexClassName : apexClassMap.keySet()) {
            ApexClass apexClass = apexClassMap.get(apexClassName);
            string body = apexClass.Body.toLowerCase();
            Integer classBodyLength = body.length();
            System.debug('apexClass: ' + apexClass.Name + ', Length: ' + body.length());
            
            // look for a share reference in the class body
            Integer indexOfShareRef = body.indexOf(shareStr);
            System.debug('initial indexOfShareRef: ' + indexOfShareRef);
            Integer indexOfAccShareRef = body.indexOf(accountShareStr);
            System.debug('initial indexOfAccShareRef: ' + indexOfAccShareRef);
            Integer indexOfOppShareRef = body.indexOf(oppShareStr);
            System.debug('initial indexOfAccShareRef: ' + indexOfAccShareRef);
            
            while(indexOfShareRef > -1) {
                Integer startIdx = indexOfShareRef - subStrThreshold <= 0 ? 0 : indexOfShareRef - subStrThreshold;
                Integer endIdx = indexOfShareRef + shareStr.length() + subStrThreshold >= classBodyLength ? classBodyLength : indexOfShareRef + shareStr.length() + subStrThreshold;
                Integer newStartIdx = indexOfShareRef + shareStr.length() >= classBodyLength ? classBodyLength : indexOfShareRef + shareStr.length();
                string region = body.substring(startIdx, endIdx);
                //System.debug('region: '+ 'region' + ' | startIdx: '+ startIdx + ' | endIdx: '+ endIdx + ' | newStartIdx: '+ newStartIdx);
                patternMatcher = shareObjectReference.matcher(region);
                
                //Check for references to a Custom Object Share
                while (patternMatcher.find()) {
                    System.debug('patternMatcher found: '+ patternMatcher.group());
                    String relatedCustomObjectApiName = patternMatcher.group().replaceAll('(?i)(__share)', '__c');
                    
                    if (!sharesFound.contains(patternMatcher.group().toLowerCase())
                        && (this.mapping.mappedObjects.contains(relatedCustomObjectApiName) || this.mapping.mappedObjects.contains(relatedCustomObjectApiName.toLowerCase()))
                       ) {
                           hasReferenceToShare = true;
                           TransitionAnalysis.MigrationAnalysisItem migrationAnalysisItem = createMigrationAnalysisItem(apexClass, patternMatcher.group(), Label.SharingSettingsApexReason);
                           migrationAnalysisItems.add(migrationAnalysisItem);
                           
                           sharesFound.add(patternMatcher.group().toLowerCase());
                       }
                }
                
                indexOfShareRef = body.indexOf(shareStr, newStartIdx);
                //System.debug('next indexOfShareRef: '+ indexOfShareRef);
            }
            
            while(indexOfAccShareRef > -1 || indexOfOppShareRef > -1) {
                Integer shareIdx = indexOfAccShareRef > -1 ? indexOfAccShareRef : indexOfOppShareRef;
                String shareOrStr = indexOfAccShareRef > -1 ? accountShareStr : oppShareStr;
                Integer startIdx = shareIdx - subStrThreshold <= 0 ? 0 : shareIdx - subStrThreshold;
                Integer endIdx = shareIdx + shareOrStr.length() + subStrThreshold >= classBodyLength ? classBodyLength : shareIdx + shareOrStr.length() + subStrThreshold;
                Integer newStartIdx = shareIdx + shareOrStr.length() >= classBodyLength ? classBodyLength : shareIdx + shareOrStr.length();
                string region = body.substring(startIdx, endIdx);
                cdsMatcher = cdsPattern.matcher(region);
                
                //Check for references to CDS Object share
                while (cdsMatcher.find()) {
                    System.debug('cdsMatcher found: '+ cdsMatcher.group());
                    String standardCustomObjectApiName = cdsMatcher.group().replaceAll('(?i)(share)', '');
                    
                    if (!sharesFound.contains(cdsMatcher.group().toLowerCase())
                        && (this.mapping.mappedObjects.contains(standardCustomObjectApiName) || this.mapping.mappedObjects.contains(standardCustomObjectApiName.toLowerCase()))
                       ) {
                           hasReferenceToShareOnCDS = true;
                           
                           TransitionAnalysis.MigrationAnalysisItem migrationAnalysisItem = createMigrationAnalysisItem(apexClass, cdsMatcher.group(), Label.SharingSettingsCDSReason);
                           migrationAnalysisItems.add(migrationAnalysisItem);
                           
                           sharesFound.add(cdsMatcher.group().toLowerCase());
                       }
                }
                
                //body = body.substring(newStartIdx);
                indexOfAccShareRef = body.indexOf(accountShareStr, newStartIdx);
                indexOfOppShareRef = body.indexOf(oppShareStr, newStartIdx);
                shareIdx = indexOfAccShareRef > -1 ? indexOfAccShareRef : indexOfOppShareRef;
            }
        }
    }
    
    private TransitionAnalysis.MigrationAnalysisItem createMigrationAnalysisItem(ApexClass apexClass, String shareObjectName, String reasonText) {
        TransitionAnalysis.MigrationAnalysisItem migrationAnalysisItem = new TransitionAnalysis.MigrationAnalysisItem();
        migrationAnalysisItem.fromComponentName = shareObjectName;
        migrationAnalysisItem.fromComponentType = Label.SharingManualShare;
        migrationAnalysisItem.fromComponentUrl = new DependencyHelper.MetadataComponent(DependencyHelper.TYPE_APEX_CLASS, null, null, null).componentUrl;
        migrationAnalysisItem.children = new List<TransitionAnalysis.MigrationAnalysisItem>();
        
        TransitionAnalysis.MigrationAnalysisItem childMigrationAnalysisItem = new TransitionAnalysis.MigrationAnalysisItem();
        childMigrationAnalysisItem.fromComponentName = apexClass.Name;
        childMigrationAnalysisItem.fromComponentType = DependencyHelper.getTypeLabel(DependencyHelper.TYPE_APEX_CLASS);
        childMigrationAnalysisItem.fromComponentUrl = new DependencyHelper.MetadataComponent(DependencyHelper.TYPE_APEX_CLASS, apexClass.Id, null, null).componentUrl;
        childMigrationAnalysisItem.toComponentName = shareObjectName;
        childMigrationAnalysisItem.reasonText = reasonText;
        
        migrationAnalysisItem.children.add(childMigrationAnalysisItem);
        
        return migrationAnalysisItem;
    }
    
    /**
*
* @param hasApexSharing If object has a Custom Apex Share Reason
* @param isScanComplete If all items have been scanned
*/
    private void updateAssessment(Boolean hasApexSharing, Boolean hasReferenceToShareOnCDS, Boolean isScanComplete, List<TransitionAnalysis.MigrationAnalysisItem> migrationAnalysisItems) {
        Assessment__c assessment = [
            Select Id, Has_Apex_Sharing__c, Has_Apex_Sharing_on_CDS_Object__c, Apex_Sharing_Scan_Complete__c,
            ApexShareAnalysisJSON__c
            FROM Assessment__c
            Where Id = :currentRequest.Assessment__c
            LIMIT 1
        ];
        
        if (!migrationAnalysisItems.isEmpty()) {
            List<TransitionAnalysis.MigrationAnalysisItem> finalItems;
            //Get existing analysis items (if any)
            if (!String.isBlank(assessment.ApexShareAnalysisJSON__c)) {
                finalItems = (List<TransitionAnalysis.MigrationAnalysisItem>) JSON.deserialize(assessment.ApexShareAnalysisJSON__c, TransitionAnalysis.MigrationAnalysisItem.class);
                finalItems.addAll(migrationAnalysisItems);
            } else {
                finalItems = migrationAnalysisItems;
            }
            
            assessment.ApexShareAnalysisJSON__c = JSON.serialize(finalItems);
        }
        if (hasApexSharing) {
            assessment.Has_Apex_Sharing__c = true;
        }
        if (hasReferenceToShareOnCDS) {
            assessment.Has_Apex_Sharing_on_CDS_Object__c = true;
        }
        if (isScanComplete) {
            assessment.Apex_Sharing_Scan_Complete__c = true;
        }
        AssessmentService.updateAssessment(assessment);
    }
    
    public override void execute(FinalizerContext ctx) {
        System.ParentJobResult result = ctx.getResult();
        if (result == ParentJobResult.UNHANDLED_EXCEPTION) {
            Exception ex = ctx.getException();
            SystemLogger.log(LoggingLevel.ERROR, ex);
            List<Assessment__c> assessments = new List<Assessment__c>();
            if(!Test.isRunningTest()){
                deactivate([SELECT Id FROM AsyncRequest__c WHERE AsyncType__c = :ApexShareReferenceScanQueueable.class.getName() And Assessment__c = :currentRequest.Assessment__c]);
                assessments = [SELECT Id FROM Assessment__c WHERE Id = :currentRequest.Assessment__c LIMIT 1];
            }
            Assessment__c assessment = (assessments.size() == 1) ? assessments.get(0) : null;
            
            if (assessment != null) {
                assessment.Apex_Sharing_Scan_Complete__c = true;
                update assessment;
            }
        } else {
            if ([SELECT COUNT()
                 FROM AsyncRequest__c
                 WHERE StartDatetime__c != NULL
                 AND AsyncType__c = :ApexShareReferenceScanQueueable.class.getName()
                 AND Assessment__c = :assessmentId] == 0)
            {
                if(!Test.isRunningTest()){
                    updateAssessment(hasReferenceToShare, hasReferenceToShareOnCDS, true, migrationAnalysisItems);
                }
            } else if (hasReferenceToShare || hasReferenceToShareOnCDS) {
                updateAssessment(hasReferenceToShare, hasReferenceToShareOnCDS, false, migrationAnalysisItems);
            }
        }
    }
    
    public static void createAsyncRequest(Id assessmentId, Id parentRequestId) {
        List<AsyncRequest__c> requests = new List<AsyncRequest__c>();
        List<ApexClass> classesToScan = Database.query(APEX_CLASS_QUERY);
        System.debug('classesToScan======> ' + classesToScan);
        List<String> classParams = new List<String>();
        
        for (ApexClass apexClass : classesToScan) {
            if (classParams.size() < DEFAULT_BATCH_SIZE) {
                classParams.add(apexClass.Name);
            } else {
                requests.add(new AsyncRequest__c(
                    Assessment__c = assessmentId,
                    AsyncType__c = ApexShareReferenceScanQueueable.class.getName(),
                    ParentRequest__c = parentRequestId,
                    Params__c = String.join(classParams, '|')
                ));
                
                classParams.clear();
            }
        }
        
        if (!classParams.isEmpty()) {
            requests.add(new AsyncRequest__c(
                Assessment__c = assessmentId,
                AsyncType__c = ApexShareReferenceScanQueueable.class.getName(),
                ParentRequest__c = parentRequestId,
                Params__c = String.join(classParams, '|')
            ));
        }
        
        if (requests.isEmpty()) {
            List<Assessment__c> assessments = [SELECT Id FROM Assessment__c WHERE Id = :assessmentId LIMIT 1];
            Assessment__c assessment = (assessments.size() == 1) ? assessments.get(0) : null;
            
            if (assessment != null) {
                assessment.Apex_Sharing_Scan_Complete__c = true;
                AssessmentService.updateAssessment(assessment);
                TransitionReadinessUtility.processScanResultsCallback(new List<Id>{assessment.Id});
            }
        } else {
            AsyncRequestProcessor.insertAsyncRequests(requests);
        }
    }
}