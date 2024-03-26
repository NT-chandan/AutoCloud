/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@isTest
private class PostInstallScriptTest
{
    static testMethod void installTest()
    {
        PostInstallScript postinstall = new PostInstallScript();
        Test.testInstall(postinstall, new Version(1, 0), true);
    }
}