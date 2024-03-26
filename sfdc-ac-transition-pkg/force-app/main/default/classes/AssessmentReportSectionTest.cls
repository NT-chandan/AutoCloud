/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
@IsTest
private class AssessmentReportSectionTest {

    static final String EXTERNAL_STRING_RESPONSE = '{"size":10,"totalSize":10,"done":true,"queryLocator":null,"entityTypeName":"ExternalString","records":[]};';

    @isTest static void testGetConfigsForAssessment() {
        Assessment__c assessment = new Assessment__c();
        insert assessment;

        MockResponse setupResponses = new MockResponse(
            ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS,
            '',
            MockCalloutDefinitions.SECTION_METADATA_RESPONSE,
            new Map<String, String>()
        );

        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.SUBSECTION_METADATA_RESPONSE);
        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, EXTERNAL_STRING_RESPONSE);

        //Call 2
        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.SECTION_METADATA_RESPONSE);
        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, MockCalloutDefinitions.SUBSECTION_METADATA_RESPONSE);
        setupResponses.addResponse(ExternalUtilities.HTTP_RESPONSE_CODE_SUCCESS, EXTERNAL_STRING_RESPONSE);

        Test.setMock(HttpCalloutMock.class, setupResponses);

        Test.startTest();

        List<AssessmentReportSection.MdtConfig> mdtConfigs = AssessmentReportSection.getConfigsForAssessment(assessment.Id);

        System.assert(!mdtConfigs.isEmpty());
        System.assert(AssessmentReportSection.configsCachedByAssessmentId.containsKey(assessment.Id));

        List<AssessmentReportSection.MdtConfig> mdtConfigsCached = AssessmentReportSection.getConfigsForAssessment(assessment.Id);
        System.assertEquals(mdtConfigs, mdtConfigsCached);

        Test.stopTest();
    }
}