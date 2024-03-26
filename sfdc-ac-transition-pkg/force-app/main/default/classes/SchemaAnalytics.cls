/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class SchemaAnalytics {

    private static final String QUERY_WITH_RECORD_TYPE = 'SELECT COUNT(Id) recordCount, RecordTypeId FROM {0} GROUP BY RecordTypeId';
    private static final String QUERY_WITHOUT_RECORD_TYPE = 'SELECT COUNT(Id) recordCount FROM {0}';

    @TestVisible
    private static final String MASTER_RECORD_TYPE = 'MASTER';
    static final String EXTERNAL_OBJECT_SUFFIX = '__x';

    @AuraEnabled
    public static Map<String, Integer> getRecordCountByRecordType(String sObjectApiName){
        if(sObjectApiName.endsWith(EXTERNAL_OBJECT_SUFFIX) == true) {
            return new Map<String, Integer> {
                MASTER_RECORD_TYPE => 0
            };
        }

        Boolean hasRecordTypes = SchemaService.getRecordTypeMap(sObjectApiName).keySet().size() > 1;

        String baseQueryString = QUERY_WITHOUT_RECORD_TYPE;
        String queryString;

        if(hasRecordTypes){
            baseQueryString = QUERY_WITH_RECORD_TYPE;
        }

        queryString = String.format(baseQueryString, new List<String>{
            String.escapeSingleQuotes(sObjectApiName.toLowerCase().substringBefore(' where '))
        });
        Map<String, Integer> recordTypeIdToCount = new Map<String, Integer>();

        List<AggregateResult> recordTypeAggregates = (List<AggregateResult>)Database.query(queryString);

        for(AggregateResult countResult : recordTypeAggregates){
            if(hasRecordTypes){
                recordTypeIdToCount.put( (String)countResult.get('RecordTypeId'), (Integer)countResult.get('recordCount'));
            } else {
                recordTypeIdToCount.put(MASTER_RECORD_TYPE, (Integer)countResult.get('recordCount'));
            }
        }

        return recordTypeIdToCount;
    }
}