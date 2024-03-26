/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public class TestProcessor extends AsyncRequestProcessor {
    public static Id currentAsyncRequestId;

    private void processRequest(AsyncRequest__c asyncRequest) {
        if (asyncRequest.Params__c == 'TestProcessorException')
            throw new TestProcessorException('TestProcessorException');
    }

    private class TestProcessorException extends Exception {}
}