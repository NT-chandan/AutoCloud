/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public abstract class AsyncRequestProcessor implements Queueable, Database.AllowsCallouts, Finalizer {

    private Boolean skipQueryMoreRequests = false;
    private String currentAsyncType;
    private Id parentRequestId;

    protected AsyncRequest__c currentRequest;
    protected TransitionAppSettings appSettings = new TransitionAppSettings();
    private static Utilities.Warnings LIMIT_CHECK = new Utilities.Warnings();

    public static Id assessmentIdStatic;

    private static final String developerEditionErrMsg = 'DEVELOPER_EDITION_STACK_DEPTH_LIMIT';

    @TestVisible private static Boolean testChildContext = false;

    public AsyncRequestProcessor setAsyncType(String asyncType) {
        this.currentAsyncType = asyncType;
        return this;
    }

    public AsyncRequestProcessor setParentRequestId(Id parentRequestId) {
        this.parentRequestId = parentRequestId;
        return this;
    }

    public AsyncRequestProcessor setAsyncRequest(AsyncRequest__c asyncRequest) {
        this.currentRequest = asyncRequest;
        return this;
    }

    public void execute(QueueableContext qc) {
        
        if (!appSettings.asyncRequestsAreEnabled || isQueued(qc.getJobId(), currentAsyncType)) return;

        List<AsyncRequest__c> openRequests = getOpenRequests();

        if (openRequests.isEmpty()) return;

        currentRequest = openRequests.get(0);
        assessmentIdStatic = currentRequest.Assessment__c;

        try {
            LIMIT_CHECK.checkCpuTime(assessmentIdStatic, 'method AsyncRequestProcessor.execute()');
        }  catch (Utilities.CpuTimeoutException e) {
            // catch the excception so that we can end the apex transaction gracefully
            system.debug('AsyncRequestProcessor.execute(QueueableContext qc): ' + 'CpuTimeoutException: ' + e);
            return;
        }

        Type targetType = Type.forName(currentAsyncType);
        AsyncRequestProcessor finalizer = ((AsyncRequestProcessor) targetType.newInstance());
        finalizer.setAsyncRequest(currentRequest);

        System.attachFinalizer(finalizer);

        try {
            currentRequest.NumberOfAttempts__c++;
            currentRequest.LastExecutedBy__c = UserInfo.getUserId();

            processRequest(currentRequest);

            currentRequest.Error__c = false;
            currentRequest.ErrorMessage__c = null;

            List<AsyncRequest__c> childRequests = [
                    SELECT AsyncType__c
                    FROM AsyncRequest__c
                    WHERE ParentRequest__c = :currentRequest.Id
            ];

            if (currentRequest.isDependent__c || testingChildContext()) {
                List<AsyncRequest__c> completedRequests = setNextAsyncType(currentRequest);
                cleanUp(completedRequests);
            } else {
                if (!childRequests.isEmpty()) {
                    parentRequestId = currentRequest.Id;
                    currentAsyncType = childRequests.get(0).AsyncType__c;
                    deactivate(currentRequest);
                } else {
                    cleanUp(currentRequest);
                }
            }
        } catch (Exception ex) {
            currentRequest.ErrorMessage__c = ex.getMessage();
            currentRequest.NumberOfAttempts__c++;
            currentRequest.Error__c = true;
            SystemLogger.log(LoggingLevel.ERROR, ex, currentRequest.Id);

            update currentRequest;

            if (currentRequest.isDependent__c || testingChildContext()) setNextAsyncType(currentRequest);
        }

        if (!skipQueryMoreRequests && getMoreRequests().isEmpty()) return;

        try {
            if (!Test.isRunningTest()) enqueueJob(qc.getJobId(), parentRequestId, currentAsyncType);
        } catch (Exception ex) {
            if (ex.getMessage() == developerEditionErrMsg) {
                throw ex;
            } else {
                tryToQueue(qc.getJobId(), parentRequestId, currentAsyncType);
            }
        }
    }

    public virtual void execute(FinalizerContext ctx) {
        system.debug('AsyncRequestProcessor.execute(): CPU time remaining: ' + (Limits.getLimitCpuTime()-Limits.getCpuTime()));
        System.ParentJobResult result = ctx.getResult();
        if (result == ParentJobResult.UNHANDLED_EXCEPTION) {
            Exception ex = ctx.getException();
            SystemLogger.log(LoggingLevel.ERROR, ex);
        }
    }

    abstract void processRequest(AsyncRequest__c request);

    public static void enqueueJob(Id currentJobId, Id parentRequestId, String asyncType) {
        if (isQueued(currentJobId, asyncType)) return;   // Already have one queued that isn't this one.

        try {
            Type targetType = Type.forName(asyncType);
            AsyncRequestProcessor processor = ((AsyncRequestProcessor) targetType.newInstance());
            processor.setAsyncType(asyncType);
            processor.setParentRequestId(parentRequestId);

            if (Limits.getQueueableJobs() < Limits.getLimitQueueableJobs()) {
                System.enqueueJob(processor);
            } else {
                tryToQueue(currentJobId, parentRequestId, asyncType); // Future
            }
        } catch (Exception ex) {
            SystemLogger.log(LoggingLevel.ERROR, ex);
            if (ex.getMessage().toLowerCase().contains('maximum stack depth')) { // Developer Edition org
                throw new AsyncRequestProcessorException(developerEditionErrMsg);
            }
        }
    }

    /**
     * Insert Assessment__c with Object and FLS security checks
     */
    public static Database.SaveResult insertAsyncRequest(AsyncRequest__c request){
        Database.SaveResult result;
        try {
            // Strip fields that are not creatable and perform object create access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{request}, true);
            result = Database.insert(Test.isRunningTest() ? new List<SObject>{request} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object create access
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    public static List<Database.SaveResult> insertAsyncRequests(List<AsyncRequest__c> systemLogs){
        List<Database.SaveResult> result;
        try {
            // Strip fields that are not creatable and perform object create access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, (List<sObject>)systemLogs, true);
            result = Database.insert(Test.isRunningTest() ? (List<sObject>)systemLogs : decision.getRecords());
        } catch (System.NoAccessException e) {
            //No object create access
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    /**
     * Update Assessment__c with Object and FLS security checks
     */
    public static Database.SaveResult updateAsyncRequest(AsyncRequest__c request) {
        Database.SaveResult result;
        try {
            // Strip fields that are not updateable and perform object update access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<SObject>{request}, true);
            result = Database.update(Test.isRunningTest() ? new List<SObject>{request} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object update access
            SystemLogger.log(LoggingLevel.ERROR, e, request.Id);
        }
        return result;
    }

    public static List<Database.SaveResult> updateAsyncRequests(List<AsyncRequest__c> requests) {
        List<Database.SaveResult> result;
        try {
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, (List<sObject>)requests, true);
            result = Database.update(Test.isRunningTest() ? (List<sObject>)requests : decision.getRecords());
        } catch (System.NoAccessException e) {
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    protected List<AsyncRequest__c> getOpenRequests() {
        if (this.parentRequestId != null) return getOpenRequestsByParentId();

        return [
                SELECT Assessment__c, AsyncType__c, Params__c, StartDatetime__c, NumberOfAttempts__c,
                        ParentRequest__c, ParentRequest__r.AsyncType__c, IsDependent__c
                FROM AsyncRequest__c
                WHERE Error__c = FALSE
                AND (ParentRequest__c = NULL OR ParentRequest__r.StartDatetime__c = NULL)
                AND StartDatetime__c <= :Datetime.now()
                AND AsyncType__c = :currentAsyncType
                LIMIT 1
                FOR UPDATE
        ];
    }

    protected List<AsyncRequest__c> getOpenRequestsByParentId() {
        return [
                SELECT Assessment__c, AsyncType__c, Params__c, StartDatetime__c, NumberOfAttempts__c,
                        ParentRequest__c, ParentRequest__r.AsyncType__c, IsDependent__c
                FROM AsyncRequest__c
                WHERE Error__c = FALSE
                AND AsyncType__c = :currentAsyncType
                AND StartDatetime__c <= :Datetime.now()
                AND ParentRequest__c = :parentRequestId
                LIMIT 1
                FOR UPDATE
        ];
    }

    @TestVisible
    private static Boolean isQueued(Id currentJobId, String asyncType) {
        if (currentJobId == null) return isQueuedOrProcessing(asyncType);

        List<AsyncApexJob> jobs = [
                SELECT Id
                FROM AsyncApexJob
                WHERE JobType = 'Queueable'
                AND (Status = 'Holding' OR Status = 'Queued' OR Status = 'Processing')
                AND ApexClass.Name = :asyncType
                AND Id <> :currentJobId
                LIMIT 1
        ];

        return !jobs.isEmpty();
    }

    private static Boolean isQueuedOrProcessing(String asyncType) {
        List<AsyncApexJob> jobs = [
                SELECT Id
                FROM AsyncApexJob
                WHERE JobType = 'Queueable'
                AND (Status = 'Holding' OR Status = 'Queued' OR Status = 'Processing')
                AND ApexClass.Name = :asyncType
                LIMIT 1
        ];

        return !jobs.isEmpty();
    }

    protected List<AsyncRequest__c> getMoreRequests() {
        if (currentRequest.isDependent__c || testingChildContext()) return getMoreRequestsByParentId();

        return [
                SELECT Id
                FROM AsyncRequest__c
                WHERE Error__c = FALSE
                AND (ParentRequest__c = NULL OR ParentRequest__r.StartDatetime__c = NULL)
                AND AsyncType__c = :currentAsyncType
                AND StartDatetime__c <= :Datetime.now()
                LIMIT 1
        ];
    }

    protected List<AsyncRequest__c> getMoreRequestsByParentId() {
        return [
                SELECT Id
                FROM AsyncRequest__c
                WHERE Error__c = FALSE
                AND StartDatetime__c <= :Datetime.now()
                AND AsyncType__c = :currentAsyncType
                AND ParentRequest__c = :parentRequestId
                LIMIT 1
        ];
    }

    protected void cleanUp(AsyncRequest__c request) {
        cleanUp(new List<AsyncRequest__c>{request});
    }

    protected void cleanUp(List<AsyncRequest__c> requests) {
        deactivate(requests);
    }

    protected void deactivate(AsyncRequest__c request) {
        deactivate(new List<AsyncRequest__c>{request});
    }

    protected void deactivate(List<AsyncRequest__c> requests) {
        for (AsyncRequest__c request : requests)
            request.StartDatetime__c = null;

        // update requests;
        updateAsyncRequests(requests);
    }

    // protected void incinerate(List<AsyncRequest__c> requests) {
    //     delete requests;
    //     Database.emptyRecycleBin(requests);
    // }

    @Future
    public static void tryToQueue(Id currentJobId, Id parentRequestId, String asyncType) {
        try {
            if (Limits.getLimitQueueableJobs() - Limits.getQueueableJobs() > 0) {
                if (!Test.isRunningTest()) enqueueJob(currentJobId, parentRequestId, asyncType);
            }
        } catch (Exception ex) {
            SystemLogger.log(LoggingLevel.ERROR, ex);
        }
    }

    @TestVisible
    private List<AsyncRequest__c> setNextAsyncType(AsyncRequest__c currentRequest) {
        AsyncRequest__c parentRequest = [
                SELECT AsyncType__c, (
                        SELECT AsyncType__c
                        FROM ChildRequests__r
                        WHERE StartDatetime__c <> NULL AND Id <> :currentRequest.Id
                )
                FROM AsyncRequest__c
                WHERE Id = :currentRequest.ParentRequest__c
        ];

        if (parentRequest.ChildRequests__r.size() > 0) {
            parentRequestId = currentRequest.ParentRequest__c;
            currentAsyncType = parentRequest.ChildRequests__r.get(0).AsyncType__c;
            skipQueryMoreRequests = true;

            return new List<AsyncRequest__c>{currentRequest};
        } else {
            if (getMoreRequests().size() > 1) skipQueryMoreRequests = true;
            else currentAsyncType = currentRequest.ParentRequest__r.AsyncType__c;

            return new List<AsyncRequest__c>{currentRequest, parentRequest};
        }
    }

    private Boolean testingChildContext() {
        return Test.isRunningTest() && testChildContext && currentRequest.isDependent__c;
    }

    private class AsyncRequestProcessorException extends Exception {

    }
}