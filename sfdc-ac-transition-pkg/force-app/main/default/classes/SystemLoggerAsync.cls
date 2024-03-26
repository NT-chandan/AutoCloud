/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public class SystemLoggerAsync implements Queueable {
    private list<System_Log_Event__e> systemLogEvents;
 
    //=================================================================================
    // Constructor: SystemLoggerAsync (ShareRequestWrapper requestWrapper)
    public SystemLoggerAsync (list<System_Log_Event__e> logEvents)
    {
        systemLogEvents = logEvents;
    }

    //=================================================================================
    // Method: execute (QueueableContext context)
    public void execute (QueueableContext context) 
    {
        if(systemLogEvents != null){
            // NOTE: The EventBus.publish() method doesn’t throw exceptions caused by an unsuccessful publish operation. Hence processing the saveresult.
            List<Database.SaveResult> srList = EventBus.publish(systemLogEvents);
           
            for (Integer i=0; i < srList.size(); i++)
            {
                if (!srList[i].isSuccess()) 
                {              
                    for (Database.Error err : srList[i].getErrors()) 
                    {system.debug(LoggingLevel.ERROR,'SystemLoggerAsync.execute() - Oh the irony!! Error publishing System Log Event record: ' + systemLogEvents[i] + ' - ERROR: ' + err.getMessage() + ' - FIELDS: ' + err.getFields());}
                }
            }
    	}
    }
}