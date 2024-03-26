/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class SystemLogEventTriggerHandler extends TriggerHandler {

    public override void afterInsert() {
        SystemLoggerUtils.createSystemLogs(Trigger.new);
    }
}