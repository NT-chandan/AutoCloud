/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class TransitionAppSettingsTest {
    @IsTest static void testSetting() {
        TransitionAppSettings settings = new TransitionAppSettings();

        Boolean collapseWelcomeTextByDefault = settings.collapseWelcomeSectionByDefault;
        settings.updateCollapseWelcomeSectionByDefault(collapseWelcomeTextByDefault);

        Boolean asyncRequestsAreEnabled = settings.asyncRequestsAreEnabled;
        settings.updateCollapseWelcomeSectionByDefault(asyncRequestsAreEnabled);

        String systemLogLevel = settings.systemLogLevel;
        settings.updateSystemLogLevel(LoggingLevel.ERROR);

        System.assertNotEquals(null, settings);
    }

}