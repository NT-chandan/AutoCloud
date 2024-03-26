/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public class SystemLoggerUtils {
    private static TransitionAppSettings appSettings = new TransitionAppSettings();

    // Given a LoggingLevel, Stack Trace string, and a message string, creates
    // and publishes a System Log Event record. Called by SystemLogger.
    public static void createAndPublishLogEvent(LoggingLevel logLevel, String stackTraceString, String msg, String relatedObjectId, String loggedFrom) {
        Boolean publishEvent = false;

        switch on String.valueOf(logLevel).toLowerCase().capitalize() {
            when 'Error' {
                switch on appSettings.systemLogLevel {
                    when 'Error','Warn','Debug','Info' {
                        publishEvent = true;
                    }
                }
            }
            when 'Warn' {
                switch on appSettings.systemLogLevel {
                    when 'Warn', 'Debug', 'Info' {
                        publishEvent = true;
                    }
                }
            }
            when 'Debug' {
                switch on appSettings.systemLogLevel {
                    when 'Debug', 'Info' {
                        publishEvent = true;
                    }
                }
            }
            when 'Info' {
                switch on appSettings.systemLogLevel {
                    when 'Info' {
                        publishEvent = true;
                    }
                }
            }
            when else {
                System.debug('log level not in use by System Logger');
            }
        }

        if (publishEvent) {
            System_Log_Event__e newLogEvent = createLogEvent(logLevel, stackTraceString, msg, relatedObjectId, loggedFrom);
            System.debug('@@newLogEvent' + newLogEvent);
            publishEvents(new List<System_Log_Event__e>{
                newLogEvent
            });
        }
    }

    // Given a list of System Log Event records, creates and inserts associated
    // System Log records. Called by SystemLogEventAfterInsertHandler.
    public static void createSystemLogs(List<System_Log_Event__e> newSystemLogEvents) {
        List<System_Log__c> newSysLogs = new List<System_Log__c>();
        Set<String> userNames = new Set<String>();

        if (newSystemLogEvents != null) {
            for (System_Log_Event__e sle : newSystemLogEvents) {
                userNames.add(sle.Running_UserName__c);
            }

            for (System_Log_Event__e sle : newSystemLogEvents) {
                String loggedFrom = (sle.Apex_Log_Event__c) ? 'Apex' : ((sle.Flow_Log_Event__c) ? 'Flow' : ((sle.Script_Log_Event__c) ? 'Script' : 'Unknown'));
                Id recordTypeId = getRecordTypeId(loggedFrom);
                String logLevelString = capitalizeFirst(sle.Log_Level__c);
                System_Log__c systemLog = new System_Log__c
                    (
                        Logged_From__c = loggedFrom,
                        RecordTypeId = recordTypeId,
                        Apex_Class__c = sle.Apex_Class__c,
                        Apex_Method__c = sle.Apex_Method__c,
                        Line_Number__c = sle.Line_Number__c,
                        Log_Level__c = logLevelString,
                        Message__c = sle.Message__c,
                        Related_Object_Id__c = sle.Related_Object_Id__c,
                        Running_UserName__c = sle.Running_UserName__c,
                        Stack_Trace__c = sle.Stack_Trace__c,
                        Flow_Name__c = sle.Flow_Name__c,
                        Flow_Stage__c = sle.Flow_Stage__c,
                        Script_Name__c = sle.Script_Name__c
                    );

                Id relatedObjectId;
                if (sle.Related_Object_Id__c != null) {
                    try {
                        relatedObjectId = (Id) sle.Related_Object_Id__c;
                        if (relatedObjectId.getSobjectType() == Assessment__c.SObjectType)
                            systemLog.Assessment__c = relatedObjectId;
                    } catch (Exception ex) {
                        System.debug(ex.getMessage());
                    }
                }
                newSysLogs.add(systemLog);
            }
            try {
                //insert newSysLogs;
                insertSystemLogs(newSysLogs);
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, 'SystemLoggerUtils.createSystemLogs() - ERROR inserting System Log record(s). ERROR: ' + e + ' - Record(s): ' + newSysLogs);
            }
        }
    }

    /**
     * Insert System_Log__c with Object and FLS security checks
     */
    public static Database.SaveResult insertSystemLogs(System_Log__c systemLog){
        Database.SaveResult result;
        try {
            // Strip fields that are not creatable and perform object create access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<SObject>{systemLog}, true);
            result = Database.insert(Test.isRunningTest() ? new List<SObject>{systemLog} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object create access
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    public static List<Database.SaveResult> insertSystemLogs(List<System_Log__c> systemLogs){
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
     * Update System_Log__c with Object and FLS security checks
     */
    public static Database.SaveResult updateSystemLogs(System_Log__c systemLog) {
        Database.SaveResult result;
        try {
            // Strip fields that are not updateable and perform object update access check
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<SObject>{systemLog}, true);
            result = Database.update(Test.isRunningTest() ? new List<SObject>{systemLog} : decision.getRecords())[0];
        } catch (System.NoAccessException e) {
            //No object update access
            SystemLogger.log(LoggingLevel.ERROR, e, systemLog.Id);
        }
        return result;
    }

    public static List<Database.SaveResult> updateSystemLogs(List<System_Log__c> systemLogs) {
        List<Database.SaveResult> result;
        try {
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, (List<sObject>)systemLogs, true);
            result = Database.update(Test.isRunningTest() ? (List<sObject>)systemLogs : decision.getRecords());
        } catch (System.NoAccessException e) {
            SystemLogger.log(LoggingLevel.ERROR, e);
        }
        return result;
    }

    // Called by SystemLogger.
    public static void addDebugLine(LoggingLevel logLevel, String traceLine, String msg) {
        String logMsg = '** ' + SystemLoggerUtils.getClassName(traceLine) + '.' + SystemLoggerUtils.getMethodName(traceLine)
            + '() - ' + SystemLoggerUtils.getLineNumberString(traceLine) + ' - ' + msg;
        System.debug('@@logLevel' + logLevel + logMsg);
    }

    // Called by SystemLogger and method createAndPublishLogEvent().
    public static void publishEvents(List<System_Log_Event__e> newLogEvents) {
        Boolean hasDML = (Limits.getLimitDmlRows() > (Limits.getDmlRows() + newLogEvents.size())) && (Limits.getLimitDmlStatements() > Limits.getDmlStatements());
        if (hasDML) {
            // The EventBus.publish() method does not throw exceptions caused by an unsuccessful publish operation. Hence processing the saveresult.
            List<Database.SaveResult> srList = EventBus.publish(newLogEvents);
            for (Integer i = 0; i < srList.size(); i++) {
                if (!srList[i].isSuccess()) {
                    for (Database.ERROR err : srList[i].getERRORs()) {
                        System.debug(LoggingLevel.ERROR, 'SystemLogger.publishEvents() - ERROR publishing System Log Event record: ' + newLogEvents[i] + ' - ERROR: ' + err.getMessage() + ' - FIELDS: ' + err.getFields());
                    }
                }
            }
        } else {
            try {
                System.enqueueJob (new SystemLoggerAsync(newLogEvents));
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, 'SystemLogger.publishEvents() - ERROR enqueueing System Log Event records. ERROR: ' + e + ' - Records: ' + newLogEvents);
            }
        }
    }

    // Given a LoggingLevel, Stack Trace string, and a message string
    // returns a valid System Log Event record.
    @TestVisible private static System_Log_Event__e createLogEvent(LoggingLevel logLevel, String stackTraceString, String msg, String relatedObjectId, String loggedFrom) {
        String traceLine = getCallingTraceLine(stackTraceString);
        Integer stackTraceFieldLength = System_Log_Event__e.Stack_Trace__c.getDescribe().getLength();
        Integer messageFieldLength = System_Log_Event__e.Message__c.getDescribe().getLength();
        Integer relatedObjectIdFieldLength = System_Log_Event__e.Related_Object_Id__c.getDescribe().getLength();
        String loggedFromPretty = capitalizeFirst(loggedFrom);
        System_Log_Event__e newLogEvent = new System_Log_Event__e
            (
                Flow_Log_Event__c = (loggedFromPretty == 'Flow') ? true : false,
                Script_Log_Event__c = (loggedFromPretty == 'Script') ? true : false,
                Script_Name__c = (loggedFromPretty == 'Script') ? stackTraceString : null,
                Apex_Log_Event__c = (loggedFromPretty == 'Apex') ? true : false,
                Apex_Class__c = (loggedFromPretty == 'Apex') ? getClassName(traceLine) : null,
                Apex_Method__c = (loggedFromPretty == 'Apex') ? getMethodName(traceLine) : null,
                Line_Number__c = (loggedFromPretty == 'Apex' || loggedFromPretty == 'Script') ? getLineNumberString(traceLine) : null,
                Log_Level__c = capitalizeFirst(String.valueOf(logLevel)),
                Message__c = msg.left(messageFieldLength),
                Running_UserName__c = UserInfo.getUserName(),
                Stack_Trace__c = stackTraceString.left(stackTraceFieldLength),
                Related_Object_Id__c = (relatedObjectId != null) ? relatedObjectId.left(relatedObjectIdFieldLength) : null
            );
        return newLogEvent;
    }

    // Method: getCallingTraceLine (String stackTraceString) => String
    @TestVisible private static String getCallingTraceLine(String stackTraceString) {
        return stackTraceString.substringAfter('\n').substringBefore('\n');
    }

    // Method: getMethodName (String traceLine) => String
    @TestVisible private static String getMethodName(String traceLine) {
        return traceLine.substringBefore(':').substringAfterLast('.');
    }

    // Method: getLineNumberString (String traceLine) => String
    @TestVisible private static String getLineNumberString(String traceLine) {
        return traceLine.substringAfter(':').trim().substringBefore(',');
        // <= Ditch the column number - it's always 1.
    }

    // Method: getClassName (String traceLine) => String
    @TestVisible private static String getClassName(String traceLine) {
        return traceLine.startsWith('Class.') ? traceLine.substringAfter('Class.').substringBefore(':').substringBeforeLast('.')
            : traceLine.substringBefore(':').substringBeforeLast('.');
    }

    // Method: capitalizeFirst (String str) => String
    @TestVisible private static String capitalizeFirst(String str) {
        return String.isBlank(str) ? '' : str.toLowerCase().capitalize();
    }

    @TestVisible private static Id getRecordTypeId(String loggedFrom) {
        switch on loggedFrom {
            when 'Apex' {
                return Schema.SObjectType.System_Log__c.getRecordTypeInfosByDeveloperName().get('Apex').getRecordTypeId();
            }
            when 'Script' {
                return Schema.SObjectType.System_Log__c.getRecordTypeInfosByDeveloperName().get('Script').getRecordTypeId();
            }
            when 'Flow' {
                return Schema.SObjectType.System_Log__c.getRecordTypeInfosByDeveloperName().get('Flow').getRecordTypeId();
            }
        }
        return null;
    }
}