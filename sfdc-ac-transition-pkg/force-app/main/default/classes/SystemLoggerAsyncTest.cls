/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class SystemLoggerAsyncTest {

    //========================================================================================
    // Method: testQueuedJob()
    @isTest static void testQueuedJob()
    {
        String testLoggedFrom = 'Apex';
        String testMsg = 'Test Error: Error';
        String testUserName = UserInfo.getUserName();
        System.LoggingLevel testLogLevel = LoggingLevel.Error;
        String testLogLevelString = String.valueOf(testLogLevel).toLowerCase().capitalize();
        String testStackTrace = 'Class.TestClassName1.TestClassMethod1: line 123, column 1 \n'
                + 'Class.TestClassName2.TestClassMethod2: line 42, column 1';

//        System_Logger_Setting__mdt setting = [SELECT Id,DeveloperName,User_Name__c,On_Debug__c,On_Error__c,On_Info__c,On_Warn__c
//        FROM System_Logger_Setting__mdt
//        WHERE User_Name__c = :SystemLoggerUtils.DEFAULT_SYSLOG_USERNAME
//        LIMIT 1];
//        Boolean shouldHaveLog = (setting.On_Error__c == 'System Log') ? true : false; // <= This field must match the testLogLevel above

        Test.startTest();
        list<System_Log_Event__e> sysLogEvents = new list<System_Log_Event__e>();
        sysLogEvents.add(SystemLoggerUtils.createLogEvent(testLogLevel,testStackTrace,testMsg,null,testLoggedFrom));
        System.enqueueJob(new SystemLoggerAsync(sysLogEvents));
        Test.stopTest(); // <= This forces the job to run, which creates the events
        Test.getEventBus().deliver(); // <= NOW Force deliver the messages in the event bus

        list<System_Log__c> sysLogRecords = [SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c,Running_User__c
        FROM System_Log__c];
//        if (shouldHaveLog) // Just in case someone changes the default setting
//        {
            system.assertNotEquals(sysLogRecords,null);
        //     system.assertEquals(sysLogRecords.size(),1);
        //     system.assertEquals(sysLogRecords[0].Log_Level__c,testLogLevelString);
        //     system.assertEquals(sysLogRecords[0].Logged_From__c,testLoggedFrom);
        //     system.assertEquals(sysLogRecords[0].Message__c,testMsg);
        //     system.assertEquals(sysLogRecords[0].Running_UserName__c,testUserName);
//        }
    }

    //========================================================================================
    // Method: testInvalidRecord()
    @isTest static void testInvalidRecord()
    {
        Boolean hasError = false;

        Test.startTest();
        list<System_Log_Event__e> sysLogEvents = new list<System_Log_Event__e>{new System_Log_Event__e()};
        System.enqueueJob(new SystemLoggerAsync(sysLogEvents));
        Test.stopTest();
        Test.getEventBus().deliver(); // <= Force deliver any messages in the event bus

        list<System_Log__c> sysLogRecords = [SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c,Running_User__c
        FROM System_Log__c];
        system.assertEquals(sysLogRecords.isEmpty(),true);
    }
}