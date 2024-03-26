trigger AsyncRequest on AsyncRequest__c (before insert, before update, before delete, after insert, after update, after delete, after undelete) {
    new AsyncRequestTriggerHandler().run();
}