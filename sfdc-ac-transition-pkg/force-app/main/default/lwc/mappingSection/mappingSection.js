import { LightningElement, track, api } from 'lwc';
import { SystemLoggerService } from 'c/systemLoggerService';

import apexSetStatus from '@salesforce/apex/AssessmentService.setStatus';
import getOrgDef from '@salesforce/apex/MappingService.getOrgDefinition';
import getMapping from '@salesforce/apex/MappingService.getMappingForSection';
import getJSON from '@salesforce/apex/MappingService.getRecommendedJSON';
import saveMappingFile from '@salesforce/apex/MappingService.saveMapping';
import getDefaultRts from '@salesforce/apex/MappingService.getDefaultRecordTypes';
import UINextButtonText from '@salesforce/label/c.UINextButtonText';
import UIBackButtonText from '@salesforce/label/c.UIBackButtonText';
import UICancelButtonText from '@salesforce/label/c.UICancelButtonText';
import MappingObjectDest from '@salesforce/label/c.MappingObjectDest';
import MappingObjectSource from '@salesforce/label/c.MappingObjectSource';
import ComboboxNoneValue from '@salesforce/label/c.ComboboxNoneValue';

export default class MappingSection extends LightningElement {
    @api assessmentId;
    @api fscDefs;

    @track currentJSON;
    @track currentMappingData;
    @api mappingId = '';
    @api previousQuestion;
    @api hideDetails = false; //If true, hides the "Show Details" section from each mappingRow
    @api startAtEnd = false; //If true stars with the last mapping option first (used when going back rather than forward)
    @api indexOverride;
    @track sectionName = '';
    @track sectionHeaderText = '';
    @track sectionDescription = '';
    @track additionalInfo = null;

    @track orgSchema = [];
    @track objectCache = {};

    @track mappingData = [];

    label = {
        UIBackButtonText,
        UINextButtonText,
        UICancelButtonText,
        MappingObjectDest,
        MappingObjectSource,
        ComboboxNoneValue
    };

    @track mappingResult;

    @track isLoading = false;
    @track allAnswersList = [];
    @track answerList = [];
    @track mappingIndex = 0;

    systemLogger;

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    connectedCallback() {
        //Call function to retrieve object set by feature (or all if blank)
        this.isLoading = true;
        if (this.previousQuestion) {
            if (this.previousQuestion.AnswerValues) {
                this.previousQuestion.AnswerValues.forEach(answer => {
                    this.allAnswersList.push(answer.label);
                });
            }
            if (this.previousQuestion.ExcludeOptions) {
                this.previousQuestion.ExcludeOptions.forEach(answer => {
                    this.allAnswersList.push(answer);
                });
            }
        }

        //Get existing JSON
        getJSON({ assessmentId: this.assessmentId })
            .then(existingJSON => {
                if (existingJSON) {
                    this.currentJSON = existingJSON;
                }
                //Get Mapping
                getMapping({ sectionId: this.mappingId, hideDetails: true })
                    .then(mappingResult => {
                        this.mappingResult = mappingResult;
                        this.sectionName = mappingResult.sectionTitle;

                        var answerName;

                        //Single Select Answers
                        if (this.previousQuestion.SelectedAnswers && this.previousQuestion.SelectedAnswers.length > 0) {
                            //Multi Select Answers
                            answerName = this.previousQuestion.SelectedAnswers[0];
                            this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.SelectedAnswers[0] + '</b>');
                            this.previousQuestion.SelectedAnswers.forEach(answerValue => {
                                this.answerList.push(answerValue);
                            });

                            //If going backwards, start at last index
                            if (this.startAtEnd === true) {
                                this.mappingIndex = this.answerList.length - 1;
                                answerName = this.previousQuestion.SelectedAnswers[this.mappingIndex];
                                this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.SelectedAnswers[this.mappingIndex] + '</b>');
                            } else if (this.indexOverride) {
                                this.mappingIndex = this.indexOverride;
                                answerName = this.previousQuestion.SelectedAnswers[this.mappingIndex];
                                this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.SelectedAnswers[this.mappingIndex] + '</b>');
                                this.indexOverride = null;
                            }
                        } else if (this.previousQuestion.SelectedAnswer) {
                            if (this.previousQuestion.SelectedAnswer === 'Both') {
                                //Split answers values
                                answerName = this.previousQuestion.AnswerValues[0].label;
                                this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.AnswerValues[0].label + '</b>');
                                this.previousQuestion.AnswerValues.forEach(answerValue => {
                                    if (answerValue.label !== 'Both') {
                                        this.answerList.push(answerValue.label);
                                    }
                                });

                                //If going backwards, start at last index
                                if (this.startAtEnd === true) {
                                    this.mappingIndex = this.answerList.length - 1;
                                    answerName = this.previousQuestion.AnswerValues[this.mappingIndex].label;
                                    this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.AnswerValues[this.mappingIndex].label + '</b>');
                                } else if (this.indexOverride) {
                                    this.mappingIndex = this.indexOverride;
                                    answerName = this.previousQuestion.AnswerValues[this.mappingIndex].label;
                                    this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.AnswerValues[this.mappingIndex].label + '</b>');
                                    this.indexOverride = null;
                                }
                            } else {
                                answerName = this.previousQuestion.SelectedAnswer;
                                this.sectionDescription = mappingResult.sectionDescription.replace('{0}', '<b>' + this.previousQuestion.SelectedAnswer + '</b>');
                                this.answerList.push(this.previousQuestion.SelectedAnswer);
                            }
                        }

                        if (this.currentJSON) {
                            //Check if we should load previous values
                            var found = false;
                            var parsedJSON = JSON.parse(this.currentJSON);
                            parsedJSON.recommended.forEach(sectionInfo => {
                                if (sectionInfo.sectionName === answerName) {
                                    sectionInfo.mappingData.forEach(objectRow => {
                                        var oRow = {
                                            "source": objectRow.source, "destination": objectRow.destination, "fieldMapping": objectRow.fieldMapping, "recordTypeMapping": objectRow.recordTypeMapping, "childRelationships": objectRow.childRelationships,
                                            "childRelationshipDualboxValues": objectRow.childRelationshipDualboxValues, "label": this.fscDefs[objectRow.destination].formattedLabel
                                        };
                                        this.mappingData.push(oRow);
                                    });
                                    found = true;
                                }
                            });

                            if (found !== true) {
                                mappingResult.sectionMappings.forEach(objectRow => {
                                    var oRow = { "source": "", "destination": objectRow.sourceObject, "fieldMapping": [], "recordTypeMapping": [], "label": this.fscDefs[objectRow.sourceObject].formattedLabel };
                                    this.mappingData.push(oRow);
                                });
                            }
                        } else {
                            getDefaultRts({ sectionNames: this.answerList })
                                .then(result => {
                                    this.defaultRecordTypeMap = result;

                                    this.mappingData.forEach(objectRow => {
                                        if (this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination] && this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo) {
                                            this.additionalInfo = this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo;
                                        }
                                    });
                                })
                                .catch(error => {
                                    this.systemLogger.log(error, 'connectedCallback');
                                });
                            mappingResult.sectionMappings.forEach(objectRow => {
                                var oRow = { "source": "", "destination": objectRow.sourceObject, "fieldMapping": [], "recordTypeMapping": [], "label": this.fscDefs[objectRow.sourceObject].formattedLabel };
                                this.mappingData.push(oRow);
                            });

                        }

                        this.indexOverride = null;

                        apexSetStatus({ assessmentId: this.assessmentId, questionId: this.previousQuestion.QuestionId, index: this.previousQuestion.QuestionNumber, mappingIndex: this.mappingIndex, numberChange: '' })
                            .then(result => {
                                getOrgDef()
                                    .then(schemaResult => {
                                        this.orgSchema = [{ "value": "", "label": this.label.ComboboxNoneValue }];
                                        schemaResult.forEach(objectName => {
                                            if (objectName.startsWith('=')) {
                                                objectName = objectName.replace('=', '');
                                                this.orgSchema.push({ "value": objectName, "label": objectName, "type": 'category' });
                                            } else {
                                                this.orgSchema.push({ "value": objectName, "label": objectName });
                                            }
                                        });
                                        this.isLoading = false;
                                    })
                            })
                    })
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentId, 'mappingSection#connectedCallback');
            });
    }

    goPrevious() {
        this.additionalInfo = null;
        this.isLoading = true;
        if (this.mappingIndex == 0) {
            //Go back to previous question
            this.dispatchEvent(new CustomEvent("goback", {}));
        } else {
            //Go back to previous mapping
            this.mappingIndex--;
            var sectionName = this.answerList[this.mappingIndex];
            this.sectionDescription = this.mappingResult.sectionDescription.replace('{0}', '<b>' + sectionName + '</b>');

            var parsedJSON = JSON.parse(this.currentJSON);

            //Load previous sources (if any)
            this.mappingData = [];
            parsedJSON.recommended.forEach(sectionInfo => {
                if (sectionInfo.sectionName === sectionName) {
                    sectionInfo.mappingData.forEach(objectRow => {
                        var oRow = {
                            "source": objectRow.source, "destination": objectRow.destination, "fieldMapping": objectRow.fieldMapping, "recordTypeMapping": objectRow.recordTypeMapping, "childRelationships": objectRow.childRelationships,
                            "childRelationshipDualboxValues": objectRow.childRelationshipDualboxValues, "label": this.fscDefs[objectRow.destination].formattedLabel
                        };
                        this.mappingData.push(oRow);
                    });
                }
            });

            this.mappingData.forEach(objectRow => {
                if (this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination] && this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo) {
                    this.additionalInfo = this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo;
                }
            });

            apexSetStatus({ assessmentId: this.assessmentId, questionId: this.previousQuestion.QuestionId, index: this.previousQuestion.QuestionNumber, mappingIndex: this.mappingIndex, numberChange: '' })
                .then(result => {
                    this.isLoading = false;
                })
                .catch(error => {
                    this.systemLogger.log('Error', error, this.assessmentId, 'mappingSection#goPrevious');
                    this.error = error;
                });
        }
    }

    cancelAssessment() {
        this.dispatchEvent(new CustomEvent("closeassessment", {}));
    }

    selectRow(e) {
        try {
            var index = e.target.dataset.index;
            var value = e.detail.value;
            //If value changes, reset mapping sections
            if (value != this.mappingData[index].source) {
                if (this.mappingData[index].fieldMapping) {
                    this.mappingData[index].fieldMapping = [];
                }
                if (this.mappingData[index].recordTypeMapping) {
                    this.mappingData[index].recordTypeMapping = [];
                }
                if (this.mappingData[index].childRelationships) {
                    this.mappingData[index].childRelationships = [];
                    this.mappingData[index].childRelationshipDualboxValues = "";
                }
            }
            this.mappingData[index].source = value;
            if (!value) {
                delete this.mappingData[index].showDetails;
            } else {
                this.mappingData[index].showDetails = true;
            }
        } catch (e) {
            this.systemLogger.log('Error', error, this.assessmentId, 'mappingScren#selectRow');
        }

    }

    @api
    submitMapping() {
        this.isLoading = true;

        try {
            var mappingList = [];
            this.mappingData.forEach(mappingItem => {
                if (!mappingItem.fieldMapping) {
                    mappingItem.fieldMapping = [];
                }
                if (!mappingItem.recordTypeMapping) {
                    mappingItem.recordTypeMapping = [];
                }

                if (mappingItem.source) {
                    mappingItem.showDetails = true;
                }

                mappingList.push(mappingItem);
            });


            if (mappingList) {
                //Call Apex (updated function will parse and populate appropriate top-level layer)
                if (!this.currentJSON) {
                    //Create new structure
                    this.currentMappingData = { "recommended": [], "additional": [] };
                    //Add default
                    if (mappingList) {
                        mappingList.forEach(objectRow => {
                            if (this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination]) {
                                objectRow.recordTypeMapping.push({ "source": "Master", "destination": this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].apiName, "userGenerated": "true" });
                            }
                        });
                    }
                    this.currentMappingData.recommended.push({ "sectionName": this.answerList[this.mappingIndex], "mappingData": mappingList });
                    this.currentJSON = JSON.stringify(this.currentMappingData);
                } else {
                    this.currentMappingData = JSON.parse(this.currentJSON);

                    //Check if section already exists
                    var found = false;

                    for (let index = 0; index < this.currentMappingData.recommended.length; index++) {
                        if (this.currentMappingData.recommended[index].sectionName === this.answerList[this.mappingIndex]) {
                            this.currentMappingData.recommended[index] = { "sectionName": this.answerList[this.mappingIndex], "mappingData": mappingList };
                            found = true;
                        }
                        //If item not in selected answers list, delete it
                        if (!this.answerList.includes(this.currentMappingData.recommended[index].sectionName) && this.allAnswersList.includes(this.currentMappingData.recommended[index].sectionName)) {
                            this.currentMappingData.recommended.splice(index, 1);
                            index--;
                        }

                    }

                    if (found === false) {
                        //Add default
                        try {
                            if (mappingList) {
                                mappingList.forEach(objectRow => {
                                    if (this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination]) {
                                        objectRow.recordTypeMapping = [{ "source": "Master", "destination": this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].apiName, "userGenerated": "true" }];
                                    }
                                });
                            }
                        } catch (ex) {
                            this.systemLogger.log('Info', ex, this.assessmentId, 'mappingSection#submitMappingDefaultRT');
                        }

                        //Add to mapping
                        this.currentMappingData.recommended.push({ "sectionName": this.answerList[this.mappingIndex], "mappingData": mappingList });
                    }
                }
                saveMappingFile({ recordId: this.assessmentId, filename: 'mapping', filetype: 'json', filedata: JSON.stringify(this.currentMappingData), isEmpty: true })
                    .then(result => {
                        this.additionalInfo = null;

                        this.currentJSON = JSON.stringify(this.currentMappingData);

                        //If other mappings in loop, go to the next one. Else, go to next question
                        if (this.answerList.length > this.mappingIndex + 1) {
                            try {
                                this.mappingIndex++;
                                this.sectionDescription = this.mappingResult.sectionDescription.replace('{0}', '<b>' + this.answerList[this.mappingIndex] + '</b>');

                                this.mappingData = [];

                                var found = false;
                                var parsedJSON = JSON.parse(this.currentJSON);
                                parsedJSON.recommended.forEach(sectionInfo => {
                                    if (sectionInfo.sectionName === this.answerList[this.mappingIndex] || sectionInfo.sectionName === this.answerList[this.mappingIndex].label) {
                                        sectionInfo.mappingData.forEach(objectRow => {
                                            var oRow = {
                                                "source": objectRow.source, "destination": objectRow.destination, "fieldMapping": objectRow.fieldMapping, "recordTypeMapping": objectRow.recordTypeMapping, "childRelationships": objectRow.childRelationships,
                                                "childRelationshipDualboxValues": objectRow.childRelationshipDualboxValues, "label": this.fscDefs[objectRow.destination].formattedLabel
                                            };
                                            this.mappingData.push(oRow);
                                        });
                                        found = true;
                                    }
                                });
                                if (found !== true) {
                                    this.mappingResult.sectionMappings.forEach(objectRow => {
                                        var oRow = { "source": "", "destination": objectRow.sourceObject, "fieldMapping": objectRow.fieldMapping, "recordTypeMapping": objectRow.recordTypes, "label": this.fscDefs[objectRow.sourceObject].formattedLabel };
                                        this.mappingData.push(oRow);
                                    });
                                }

                                this.mappingData.forEach(objectRow => {
                                    if (this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination] && this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo) {
                                        this.additionalInfo = this.defaultRecordTypeMap[this.answerList[this.mappingIndex] + objectRow.destination].additionalInfo;
                                    }
                                });

                                apexSetStatus({ assessmentId: this.assessmentId, questionId: this.previousQuestion.QuestionId, index: this.previousQuestion.QuestionNumber, mappingIndex: this.mappingIndex, numberChange: '' })
                                    .then(result => {
                                        this.isLoading = false;
                                    })
                                    .catch(error => {
                                        this.systemLogger.log('Error', error, this.assessmentId, 'mappingSection#submitMapping1');
                                        this.error = error;
                                    });
                            } catch (e) {
                                this.systemLogger.log('Error', e, this.assessmentId, 'mappingSection#submitMapping1');
                            }

                        } else {
                            this.dispatchEvent(new CustomEvent("nextquestion", {}));
                        }
                    })
                    .catch(error => {
                        this.systemLogger.log('Error', error, this.assessmentId, 'mappingSection#submitMapping3');
                        this.isLoading = false;
                    });
            }
        } catch (ex) {
            this.systemLogger.log('Error', ex, this.assessmentId, 'mappingSection#submitMapping4');
        }
        this.isLoading = false;
    }

    get hasAdditionalInfo() {
        return this.additionalInfo !== null && this.additionalInfo !== undefined && this.additionalInfo !== '';
    }
}