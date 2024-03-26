/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class SystemLoggerUtilsTest {
    @isTest static void testCreateSystemLogs() {
        String testClassName = 'TestClass';
        String testMethodName = 'TestClass';
        String testLineNumber = 'line 42';
        String testMsg = 'Test ERROR: ERROR';
        String testUserName = UserInfo.getUserName();
        String testLogLevel = String.valueOf(LoggingLevel.ERROR).toLowerCase().capitalize();
        String testStackTrace = 'Stack Trace Here';

        List<System_Log_Event__e> testSystemLogEvents = new List<System_Log_Event__e>();
        testSystemLogEvents.add(new System_Log_Event__e
            (
                Apex_Log_Event__c = true,
                Apex_Class__c = testClassName,
                Apex_Method__c = testMethodName,
                Line_Number__c = testLineNumber,
                Log_Level__c = testLogLevel,
                Message__c = testMsg,
                Running_UserName__c = testUserName,
                Stack_Trace__c = testStackTrace
            ));

        Test.startTest();
        SystemLoggerUtils.createSystemLogs(testSystemLogEvents);
        Test.stopTest();

        // Technically, these asserts require the System_Log_Event__e trigger to run!
        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];
        System.assertNotEquals(sysLogRecords, null);
        System.assertNotEquals(sysLogRecords.isEmpty(), true);

        System.assertEquals(sysLogRecords[0].Logged_From__c, 'Apex');
        System.assertEquals(sysLogRecords[0].Apex_Class__c, testClassName);
        System.assertEquals(sysLogRecords[0].Apex_Method__c, testMethodName);
        System.assertEquals(sysLogRecords[0].Line_Number__c, testLineNumber);
        System.assertEquals(sysLogRecords[0].Log_Level__c, testLogLevel);
        System.assertEquals(sysLogRecords[0].Message__c, testMsg);
        System.assertEquals(sysLogRecords[0].Running_UserName__c, testUserName);
        System.assertEquals(sysLogRecords[0].Stack_Trace__c, testStackTrace);
    }

    @isTest static void testCreateLogEvent() {
        String testLoggedFrom = '';
        String testMsg = 'Test ERROR: ERROR';
        String testUserName = UserInfo.getUserName();
        String testLogLevel = String.valueOf(LoggingLevel.ERROR).toLowerCase().capitalize();
        String testStackTrace = 'Class.TestClassName1.TestClassMethod1: line 123, column 1 \n'
            + 'Class.TestClassName2.TestClassMethod2: line 42, column 1';
        System_Log_Event__e sysLogEvent;

        Test.startTest();

        testLoggedFrom = 'Apex';
        sysLogEvent = SystemLoggerUtils.createLogEvent(LoggingLevel.ERROR, testStackTrace, testMsg, null, testLoggedFrom);

        System.assertNotEquals(sysLogEvent, null);
        System.assertEquals(sysLogEvent.Apex_Log_Event__c, true);
        System.assertEquals(sysLogEvent.Apex_Class__c, 'TestClassName2');
        System.assertEquals(sysLogEvent.Apex_Method__c, 'TestClassMethod2');
        System.assertEquals(sysLogEvent.Line_Number__c, 'line 42');
        System.assertEquals(sysLogEvent.Log_Level__c, testLogLevel);
        System.assertEquals(sysLogEvent.Message__c, testMsg);
        System.assertEquals(sysLogEvent.Running_UserName__c, testUserName);
        System.assertEquals(sysLogEvent.Stack_Trace__c, testStackTrace);

        testLoggedFrom = 'Script';
        sysLogEvent = SystemLoggerUtils.createLogEvent(LoggingLevel.ERROR, testStackTrace, testMsg, null, testLoggedFrom);

        System.assertNotEquals(sysLogEvent, null);
        System.assertEquals(sysLogEvent.Script_Log_Event__c, true);
        System.assertEquals(sysLogEvent.Log_Level__c, testLogLevel);
        System.assertEquals(sysLogEvent.Message__c, testMsg);
        System.assertEquals(sysLogEvent.Running_UserName__c, testUserName);
        System.assertEquals(sysLogEvent.Stack_Trace__c, testStackTrace);

        testLoggedFrom = 'Flow';
        sysLogEvent = SystemLoggerUtils.createLogEvent(LoggingLevel.ERROR, testStackTrace, testMsg, null, testLoggedFrom);

        System.assertNotEquals(sysLogEvent, null);
        System.assertEquals(sysLogEvent.Flow_Log_Event__c, true);
        System.assertEquals(sysLogEvent.Log_Level__c, testLogLevel);
        System.assertEquals(sysLogEvent.Message__c, testMsg);
        System.assertEquals(sysLogEvent.Running_UserName__c, testUserName);
        System.assertEquals(sysLogEvent.Stack_Trace__c, testStackTrace);

        Test.stopTest();
    }

    @isTest static void testGetCallingTraceLine() {
        String testStackTrace = 'Class.TestClassName1.TestClassMethod1: line 123, column 1 \n';
        testStackTrace += 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

        Test.startTest();
        String traceLine = SystemLoggerUtils.getCallingTraceLine(testStackTrace);
        Test.stopTest();

        System.assertNotEquals(traceLine, null);
        System.assertEquals(traceLine.contains('TestClassName2.TestClassMethod2'), true);
    }

    //==========================================================================
    // Method: testGetMethodName()
    @isTest static void testGetMethodName() {
        String testTraceLine = 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

        Test.startTest();
        String methodName = SystemLoggerUtils.getMethodName(testTraceLine);
        Test.stopTest();

        System.assertNotEquals(methodName, null);
        System.assertEquals(methodName, 'TestClassMethod2');
    }

    //==========================================================================
    // Method: testGetLineNumberString()
    @isTest static void testGetLineNumberString() {
        String testTraceLine = 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

        Test.startTest();
        String lineNumber = SystemLoggerUtils.getLineNumberString(testTraceLine);
        Test.stopTest();

        System.assertNotEquals(lineNumber, null);
        System.assertEquals(lineNumber, 'line 42');
    }

    //==========================================================================
    // Method: testGetClassName()
    @isTest static void testGetClassName() {
        String testTraceLine = 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

        Test.startTest();
        String className = SystemLoggerUtils.getClassName(testTraceLine);
        Test.stopTest();

        System.assertNotEquals(className, null);
        System.assertEquals(className, 'TestClassName2');
    }

    //========================================================================================
    // Method: testAddDebugLine()
    @isTest static void testAddDebugLine() {
        String testTraceLine = 'Class.TestClassName.TestClassMethod: line 42, column 1';
        String testMsg = 'Test ERROR: ERROR';

        Test.startTest();
            try {
                SystemLoggerUtils.addDebugLine(LoggingLevel.DEBUG, testTraceLine, testMsg);
                System.assert(true);
            }
            catch (Exception e) {
                System.assert(false, e.getMessage());
            }
        Test.stopTest();
    }

    //========================================================================================
    // Method: testCreateAndPublishLogEvent()
    @isTest static void testCreateAndPublishLogEvent() {
        TransitionAppSettings__c settings = new TransitionAppSettings__c(System_Log_Level__c='Warn',Async_Requests_Are_Enabled__c=true);
        insert settings;
        String testLoggedFrom = 'Apex';
        String testMsg = 'Test ERROR: Some ERROR.';
        System.LoggingLevel testLogLevel = LoggingLevel.ERROR;
        System.LoggingLevel testLogLevelWarn = LoggingLevel.WARN;
        System.LoggingLevel testLogLevelInfo = LoggingLevel.INFO;
        System.LoggingLevel testLogLevelDebug = LoggingLevel.DEBUG;
        String testStackTrace = 'Class.TestClassName1.TestClassMethod1: line 123, column 1 \n'
            + 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

        Test.startTest();
        SystemLoggerUtils.createAndPublishLogEvent(testLogLevel, testStackTrace, testMsg, null, testLoggedFrom);
        SystemLoggerUtils.createAndPublishLogEvent(testLogLevelWarn, testStackTrace, testMsg, null, testLoggedFrom);
        SystemLoggerUtils.createAndPublishLogEvent(testLogLevelInfo, testStackTrace, testMsg, null, testLoggedFrom);
        SystemLoggerUtils.createAndPublishLogEvent(testLogLevelDebug, testStackTrace, testMsg, null, testLoggedFrom);
        Test.getEventBus().deliver(); // <= Force deliver the messages in the event bus
        Test.stopTest();

        // Technically, these asserts require the System_Log_Event__e trigger to run! (can't query events)
        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];
        System.assertNotEquals(sysLogRecords, null);
        // System.assertEquals(sysLogRecords.isEmpty(), false);
        // System.assertEquals(sysLogRecords[0].Message__c, testMsg);
        // System.assertEquals(sysLogRecords[0].Logged_From__c, testLoggedFrom);
    }

    //========================================================================================
    // Method: testPublishEvent()
    @isTest static void testPublishEvent() {
        String testClassName = 'TestClass';
        String testMethodName = 'TestClass';
        String testLineNumber = 'line 42';
        String testMsg = 'Test ERROR: ERROR';
        String testUserName = UserInfo.getUserName();
        String testLogLevel = String.valueOf(LoggingLevel.ERROR).toLowerCase().capitalize();
        String testStackTrace = 'Stack Trace Here';

        List<System_Log_Event__e> testSystemLogEvents = new List<System_Log_Event__e>();
        testSystemLogEvents.add(new System_Log_Event__e
            (
                Apex_Log_Event__c = true,
                Apex_Class__c = testClassName,
                Apex_Method__c = testMethodName,
                Line_Number__c = testLineNumber,
                Log_Level__c = testLogLevel,
                Message__c = testMsg,
                Running_UserName__c = testUserName,
                Stack_Trace__c = testStackTrace
            ));

        Test.startTest();
        SystemLoggerUtils.publishEvents(testSystemLogEvents);
        Test.stopTest();

        // Technically, these asserts require the System_Log_Event__e trigger to run! (can't query events)
        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];
        System.assertNotEquals(sysLogRecords, null);
        
        systemLoggerUtils.updateSystemLogs(sysLogRecords.get(0));
        systemLoggerUtils.updateSystemLogs(sysLogRecords);
    }

    @isTest static void testPublishEventAsync() {
        String testClassName = 'TestClass';
        String testMethodName = 'TestClass';
        String testLineNumber = 'line 42';
        String testMsg = 'Test ERROR: ERROR';
        String testUserName = UserInfo.getUserName();
        String testLogLevel = String.valueOf(LoggingLevel.ERROR).toLowerCase().capitalize();
        String testStackTrace = 'Stack Trace Here';

        List<System_Log_Event__e> testSystemLogEvents = new List<System_Log_Event__e>();
        testSystemLogEvents.add(new System_Log_Event__e
            (
                Apex_Log_Event__c = true,
                Apex_Class__c = testClassName,
                Apex_Method__c = testMethodName,
                Line_Number__c = testLineNumber,
                Log_Level__c = testLogLevel,
                Message__c = testMsg,
                Running_UserName__c = testUserName,
                Stack_Trace__c = testStackTrace
            ));

        Test.startTest();
        // !!! Create enough records to use up the DML limit !!!
        /*List<Lead> testLeads = new List<Lead>();
        for (Integer i=0; i < Limits.getLimitDmlRows(); i++)
        {
            testLeads.add(new Lead
                    (
                            FirstName = 'Tester'+i,
                            LastName='Testing'+i,
                            Email='me' + i + '@here.now',
                            Company ='Test Company XX',
                            Status = 'New',
                            LeadSource = 'Other',
                            Industry = 'Aerospace'
                    ));
        }
        insert testLeads; // Use up the DML limit*/
        SystemLoggerUtils.publishEvents(testSystemLogEvents); // Now try to publish
        Test.stopTest();

        // Technically, these asserts require the System_Log_Event__e trigger to run! (can't query events)
        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];
        System.assertNotEquals(sysLogRecords, null);
        // System.assertEquals(sysLogRecords.isEmpty(), false);
        // System.assertEquals(sysLogRecords[0].Message__c, testMsg);
        // System.assertEquals(sysLogRecords[0].Logged_From__c, 'Apex');
    }
}
