trigger SystemLogEvent on System_Log_Event__e (after insert) {
    new SystemLogEventTriggerHandler().run();
}