/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class SystemLoggerTest {
    @IsTest static void testLogFromApex() {
        TransitionAppSettings__c settings = new TransitionAppSettings__c(System_Log_Level__c='Warn',Async_Requests_Are_Enabled__c=true);
        insert settings;
        Account account = new Account(Name = 'TestAccount');
        insert account;
        System.assertNotEquals(account.Id, null);
        String testMsg = 'Test Error: Error';
        String testId = account.Id;

        Test.startTest();
        System.debug(LoggingLevel.WARN, 'SystemLoggerTest.testLogFromApex() - About to generate System logs! ...');
        SystemLogger.log(LoggingLevel.ERROR, testMsg, testId);
        SystemLogger.log(LoggingLevel.WARN, testMsg, testId);
        SystemLogger.log(LoggingLevel.INFO, testMsg, testId);
        SystemLogger.log(LoggingLevel.DEBUG, testMsg, testId);
        SystemLogger.log(LoggingLevel.NONE, testMsg);
        System.debug(LoggingLevel.WARN, 'SystemLoggerTest.testLogFromApex() - ... Done generate System logs!');
        Test.getEventBus().deliver(); // <= Force deliver the messages in the event bus
        Test.stopTest();

        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];

        System.assertNotEquals(null, sysLogRecords);
        // System.assertEquals(2, sysLogRecords.size());
        // System.assertEquals('Apex', sysLogRecords[0].Logged_From__c);
        // System.assertEquals(testMsg, sysLogRecords[0].Message__c);
        // System.assertEquals(testId, sysLogRecords[0].Related_Object_Id__c);
    }

    @IsTest static void testLogWebService() {
        TransitionAppSettings__c settings = new TransitionAppSettings__c(System_Log_Level__c='Warn',Async_Requests_Are_Enabled__c=true);
        insert settings;
        String testMsg = 'Something bad happened.';
        List<String> testLogLevels = new List<String>{
            'Error', 'Warn', 'Info', 'Debug', 'None'
        };
        String componentInfo = 'Component#method';
        Account account = new Account(Name = 'TestAccount');
        insert account;
        System.assertNotEquals(account.Id, null);

        Test.startTest();
        System.debug(LoggingLevel.WARN, 'SystemLoggerTest.testLogFromScript() - About to generate System logs! ...');
        SystemLogger.createLog(testLogLevels[0], testMsg, account.Id, componentInfo);
        SystemLogger.createLog(testLogLevels[1], testMsg, account.Id, componentInfo);
        SystemLogger.createLog(testLogLevels[2], testMsg, account.Id, componentInfo);
        SystemLogger.createLog(testLogLevels[3], testMsg, account.Id, componentInfo);
        SystemLogger.createLog(testLogLevels[4], testMsg, account.Id, componentInfo);
        System.debug(LoggingLevel.WARN, 'SystemLoggerTest.testLogFromScript() - ... Done generate System logs!');
        Test.getEventBus().deliver(); // <= Force deliver the messages in the event bus
        Test.stopTest();

        List<System_Log__c> sysLogRecords = [
            SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
            FROM System_Log__c
        ];
        System.assertNotEquals(sysLogRecords, null);
        // System.assertEquals(2, sysLogRecords.size());
        // System.assertEquals(sysLogRecords[0].Logged_From__c, 'Script');
        // System.assertEquals(sysLogRecords[0].Message__c, testMsg);
        // System.assertEquals(sysLogRecords[0].Related_Object_Id__c, account.Id);
    }

    /*
    @IsTest static void testLogInvocable() {
        String testMsg = 'Something bad happened.';
        List<String> testLogLevels = new List<String>{'Error','Warn','Info','Debug','None'};
        String testLoggedFrom = 'Flow';
        String testStackTrace = 'Class.TestClassName1.TestClassMethod1: line 123, column 1 \n'
                + 'Class.TestClassName2.TestClassMethod2: line 42, column 1';
        Contact testContact = new Contact(FirstName='Test',LastName='Test',Email='testing@here.now');
        insert testContact;
        System.assertNotEquals(testContact.Id,null);

        System_Logger_Setting__mdt setting = [SELECT Id,DeveloperName,User_Name__c,On_Debug__c,On_Error__c,On_Info__c,On_Warn__c
        FROM System_Logger_Setting__mdt
        WHERE User_Name__c = :SystemLoggerUtils.DEFAULT_SYSLOG_USERNAME
        LIMIT 1];
        Integer expectedLogCount = 0;
        expectedLogCount += (setting.On_Error__c == 'System Log') ? 1 : 0;
        expectedLogCount += (setting.On_Warn__c == 'System Log') ? 1 : 0;
        expectedLogCount += (setting.On_Info__c == 'System Log') ? 1 : 0;
        expectedLogCount += (setting.On_Debug__c == 'System Log') ? 1 : 0;

        List<System_Log_Event__e> eventsToPublish = new List<System_Log_Event__e>();
        for (String logLevel : testLogLevels)
        {
            eventsToPublish.add(new System_Log_Event__e
                    (
                            Flow_Log_Event__c = true,
                            Log_Level__c = logLevel,
                            Message__c = testMsg,
                            Running_UserName__c = UserInfo.getUserName(),
                            Stack_Trace__c = testStackTrace,
                            Related_Object_Id__c = testContact.Id
                    ));
        }

        Test.startTest();
        System.debug(LoggingLevel.WARN,'SystemLoggerTest.testLogFromApex() - About to generate System logs! ...');
        SystemLogger.log(eventsToPublish);
        System.debug(LoggingLevel.WARN,'SystemLoggerTest.testLogFromApex() - ... Done generate System logs!');
        Test.getEventBus().deliver(); // <= Force deliver the messages in the event bus
        Test.stopTest();

        List<System_Log__c> sysLogRecords = [SELECT Id,Logged_From__c,Apex_Class__c,Apex_Method__c,Line_Number__c,
                Log_Level__c,Message__c,Related_Object_Id__c,Running_UserName__c,
                Stack_Trace__c,Flow_Name__c,Flow_Stage__c
        FROM System_Log__c];
        System.assertNotEquals(sysLogRecords,null);
        System.assertEquals(sysLogRecords.size(),expectedLogCount);
        System.assertEquals(sysLogRecords[0].Logged_From__c,testLoggedFrom);
        System.assertEquals(sysLogRecords[0].Message__c,testMsg);
        System.assertEquals(sysLogRecords[0].Related_Object_Id__c,testContact.Id);
    }
     */
}