import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getMenuItems from '@salesforce/apex/HealthCloudMenuController.getMenuItems';
import getSection from '@salesforce/apex/HealthCloudMenuController.getSectionByGroupId';
import getOrgDef from '@salesforce/apex/MappingService.getOrgDefinition';
import saveMappingItems from '@salesforce/apex/HealthCloudMenuController.saveMapping';
import recordScreenIndex from '@salesforce/apex/HealthCloudMenuController.trackScreen';

import UINextButtonText from '@salesforce/label/c.UINextButtonText';
import UIBackButtonText from '@salesforce/label/c.UIBackButtonText';
import UICancelButtonText from '@salesforce/label/c.UICancelButtonText';
import UIPicklistPlaceholderText from '@salesforce/label/c.UIPicklistPlaceholderText';
import UICompleteAssessmentText from '@salesforce/label/c.UICompleteAssessmentText';
import UIStartAssessmentText from '@salesforce/label/c.UIStartAssessmentText';
import UISandboxDisclaimer from '@salesforce/label/c.AssessmentSandboxDisclaimer';
import UIOptionalDisclaimer from '@salesforce/label/c.AssessmentOptionalDisclaimer';
import UIQuestionDesc from '@salesforce/label/c.QuestionScreenDesc';
import MappingObjectDest from '@salesforce/label/c.MappingObjectDest';
import MappingObjectSource from '@salesforce/label/c.MappingObjectSource';
import ComboboxNoneValue from '@salesforce/label/c.ComboboxNoneValue';

import ToastTitleSuccess from '@salesforce/label/c.ToastTitleSuccess';
import ToastTitleSave from '@salesforce/label/c.ToastTitleSave';
import ToastTitleError from '@salesforce/label/c.ToastTitleError';
import ToastMessageMappingSaved from '@salesforce/label/c.ToastMessageMappingSaved';
import ToastMessageError from '@salesforce/label/c.ToastMessageError';
import updateRecord from '@salesforce/apex/AssessmentService.updateAssessmentRecords';

export default class QuestionMenu extends LightningElement {
    @api orgSchema = [];
    @api assessmentId;
    @track isLoading = false;
    menuItems = [];
    @track currentIndex = 0;
    finalIndex = 5;
    @api hcDefs;
    @api indexOverride;

    @track section = {};

    @track questionOne = [{ show: false, label: 'Care Programs', desc: '<p>The <b>Care Program</b> object in Health Cloud represents a set of activities, such as a patient therapy, financial assistance, education, wellness, or fitness plan, offered to participants by an employer or insurer. Please select an object (if any) to be mapped to the new HC object.</p>', destination: 'Care Program (HealthCloud__CareProgram__c)' },
    { show: false, label: 'Care Program Enrollees' }, { show: false, label: 'Care Program Team Member', desc: '<p>The <b>Care Program Team Member</b> object in Health Cloud Represents a person who delivers services under a program, such as a program manager or care coordinator. Please select an object (if any) to be mapped to the new HC object.</p>', destination: 'Care Program Team Member (HealthCloud__CareProgramTeamMember__c)' }, { show: false, label: 'Care Program Goal' }];
    questionTwo = [{ show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }, { show: false }];

    label = {
        UIBackButtonText,
        UINextButtonText,
        UICancelButtonText,
        UIPicklistPlaceholderText,
        UICompleteAssessmentText,
        UIStartAssessmentText,
        UISandboxDisclaimer,
        UIOptionalDisclaimer,
        UIQuestionDesc,
        MappingObjectDest,
        MappingObjectSource,
        ComboboxNoneValue,
        ToastTitleSuccess,
        ToastTitleSave,
        ToastTitleError,
        ToastMessageMappingSaved,
        ToastMessageError
    };

    connectedCallback() {
        this.isLoading = true;
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

                //get the side section data from apex class
                getMenuItems({ assessmentId: this.assessmentId })
                    .then(result => {
                        this.menuItems = JSON.parse(JSON.stringify(result));
                        this.finalIndex = this.menuItems.length - 1; //add this line to fix the indexing issue  
                        if (this.indexOverride) {
                            this.currentIndex = parseInt(this.indexOverride);
                        }
                        this.menuItems[this.currentIndex].selected = true;
                        //this.finalIndex = (this.menuItems.length === 6) ? 5 : 4;

                        this.getQuestionContent(this.menuItems[this.currentIndex].Id);
                    })
                    .catch(error => {
                        console.log("==ERR: ", error);
                    });
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#connectedCallback');
                this.isLoading = false;
            });
    }

    // get the question content section
    getQuestionContent(sectionId) {
        getSection({ assessmentId: this.assessmentId, groupId: sectionId, screenIndex: this.currentIndex })
            .then(result => {
                this.section = result;

                var questionIndex = 0
                //Check whether we need to add hide next question
                if (this.section.questions[questionIndex + 1]) {
                    var showNext = false;
                    this.section.questions[questionIndex].options.forEach(opt => {
                        if (opt.Show === true) {
                            showNext = true;
                        }
                    });
                    this.section.questions[questionIndex + 1].show = showNext;
                }

                this.isLoading = false;
            })
            .catch(error => {
                console.log("==ERR2: ", error);
            });
    }

    catSelected(e) {
        var index = parseInt(e.target.dataset.item);
        this.menuItems.forEach(menuItem => {
            menuItem.selected = false;
        });
        this.menuItems[index].selected = true;
    }

    optionSelected(e) {
        try {
            this.isLoading = true;
            var questionIndex = parseInt(e.target.dataset.question);
            var optionIndex = parseInt(e.target.dataset.item);
            var followUpIndex = parseInt(e.target.dataset.followup);

            var details = e.detail.checked;
            var label = e.target.label;
            if (details && (label === 'Vehicles' || label === 'Warranties')) {
                updateRecord({ assessmentId: this.assessmentId, isChecked: details, objName: label })
                    .then(result => {
                        if (result) {
                            // this.question = result;
                            this.assessmentid = result;
                            this.showQuestion = true;
                            // this.loadQuestionSection();
                        }
                        else {
                            this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.assessmentid }));
                        }
                    })
                    .catch(error => {
                        this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#startAssessment');
                        this.error = error;
                    });
            }
            if (Number.isInteger(followUpIndex)) {
                this.section.questions[questionIndex].options[optionIndex].followUp[followUpIndex].Show = !this.section.questions[questionIndex].options[optionIndex].followUp[followUpIndex].Show;
            } else {
                this.section.questions[questionIndex].options[optionIndex].Show = !this.section.questions[questionIndex].options[optionIndex].Show;
            }

            //Check whether we need to add hide next question
            if (this.section.questions[questionIndex + 1]) {
                var showNext = false;
                this.section.questions[questionIndex].options.forEach(opt => {
                    if (opt.Show === true) {
                        showNext = true;
                    }
                });
                this.section.questions[questionIndex + 1].show = showNext;
            }


            this.isLoading = false;
        } catch (e) {
            console.log('=E: ', e);
        }
    }

    twoSelected(e) {
        var index = parseInt(e.target.dataset.item) - 1;
        this.questionOne[index].show = true;
    }

    previousClicked() {
        try {
            this.isLoading = true;
            recordScreenIndex({ assessmentId: this.assessmentId, nextQuestionIndex: '' + (this.currentIndex - 1) })
                .then(result => {
                    this.currentIndex--;
                    this.menuItems.forEach(item => {
                        item.selected = false;
                    });
                    this.menuItems[this.currentIndex].selected = true;
                    this.getQuestionContent(this.menuItems[this.currentIndex].Id);
                    window.scrollTo({ top: 0 });
                })
                .catch(error => {
                    console.log("==ERR: ", error);
                });
        } catch (e) {
            console.log('==Err: ', e);
        }
    }

    recordMappings(goNext) {
        //Iterate through screen, and capture any mapping sections that are exposed
        try {
            var mappingJSON = [];
            var recordTypeMapping;
            var screenId = this.menuItems[this.currentIndex].Id;
            this.section.questions.forEach(question => {
                if (question.show === true) {
                    question.options.forEach(option => {
                        if (option.Show === true && option.MappedObjects && option.MappedObjects.length > 0) {
                            //Record this section
                            var mappingItem = {};
                            mappingItem.screenId = this.menuItems[this.currentIndex].Id;
                            mappingItem.sectionName = this.menuItems[this.currentIndex].MasterLabel + ' - ' + option.QuestionLabel;
                            mappingItem.mappingData = [];
                            option.MappedObjects.forEach(object => {
                                if (object.destinationLabel === 'Account') {
                                    recordTypeMapping = [
                                        {
                                            "userGenerated": "true",
                                            "destination": "Account",
                                            "source": ""
                                        }
                                    ]
                                } else if (object.destinationLabel === 'Case') {
                                    recordTypeMapping = [
                                        {
                                            "userGenerated": "true",
                                            "destination": "CarePlan",
                                            "source": ""
                                        }
                                    ];
                                }
                                else {
                                    recordTypeMapping = [];
                                }
                                if (object.source) {
                                    mappingItem.mappingData.push({
                                        "destination": object.destination,
                                        "showDetails": true,
                                        "source": object.source,
                                        "recordTypeMapping": recordTypeMapping,
                                        "fieldMapping": [],
                                        "destinationObjectMetaName": object.destinationObjectMetaName
                                    });
                                } else {

                                    mappingItem.mappingData.push({
                                        "destination": object.destination,
                                        "showDetails": false,
                                        "source": object.source,
                                        "recordTypeMapping": recordTypeMapping,
                                        "fieldMapping": [],
                                        "destinationObjectMetaName": object.destinationObjectMetaName
                                    });
                                }
                            });
                            mappingJSON.push(mappingItem);
                            //Record any follow-ups
                            if (option.followUp && option.followUp.length > 0) {
                                option.followUp.forEach(followUp => {
                                    if (followUp.Show === true) {
                                        var mappingItem2 = {};
                                        mappingItem2.screenId = this.menuItems[this.currentIndex].Id;
                                        mappingItem2.sectionName = this.menuItems[this.currentIndex].MasterLabel + ' - ' + followUp.QuestionLabel;

                                        mappingItem2.mappingData = [];
                                        followUp.MappedObjects.forEach(object => {
                                            if (object.destinationLabel === 'Account') {
                                                recordTypeMapping = [
                                                    {
                                                        "userGenerated": "true",
                                                        "destination": "Account",
                                                        "source": ""
                                                    }
                                                ]
                                            } else if (object.destinationLabel === 'Case') {
                                                recordTypeMapping = [
                                                    {
                                                        "userGenerated": "true",
                                                        "destination": "CarePlan",
                                                        "source": ""
                                                    }
                                                ];
                                            } else {
                                                recordTypeMapping = [];
                                            }
                                            if (object.source) {
                                                mappingItem2.mappingData.push({
                                                    "destination": object.destination,
                                                    "showDetails": true,
                                                    "source": object.source,
                                                    "recordTypeMapping": recordTypeMapping,
                                                    "fieldMapping": []
                                                });
                                            } else {
                                                mappingItem2.mappingData.push({
                                                    "destination": object.destination,
                                                    "showDetails": false,
                                                    "source": object.source,
                                                    "recordTypeMapping": recordTypeMapping,
                                                    "fieldMapping": []
                                                });
                                            }

                                        });
                                        mappingJSON.push(mappingItem2);
                                    }
                                });
                            }
                        } else if (option.Show === true) {
                            //Record any follow-ups
                            if (option.followUp && option.followUp.length > 0) {
                                option.followUp.forEach(followUp => {
                                    if (followUp.Show === true) {
                                        var mappingItem2 = {};
                                        mappingItem2.screenId = this.menuItems[this.currentIndex].Id;
                                        mappingItem2.sectionName = this.menuItems[this.currentIndex].MasterLabel + ' - ' + followUp.QuestionLabel;

                                        mappingItem2.mappingData = [];
                                        followUp.MappedObjects.forEach(object => {
                                            if (object.destinationLabel === 'Account') {
                                                recordTypeMapping = [
                                                    {
                                                        "userGenerated": "true",
                                                        "destination": "Account",
                                                        "source": ""
                                                    }
                                                ]
                                            } else if (object.destinationLabel === 'Case') {
                                                recordTypeMapping = [
                                                    {
                                                        "userGenerated": "true",
                                                        "destination": "CarePlan",
                                                        "source": ""
                                                    }
                                                ];
                                            } else {
                                                recordTypeMapping = [];
                                            }
                                            if (object.source) {
                                                mappingItem2.mappingData.push({
                                                    "destination": object.destination,
                                                    "showDetails": true,
                                                    "source": object.source,
                                                    "recordTypeMapping": recordTypeMapping,
                                                    "fieldMapping": []
                                                });
                                            } else {
                                                mappingItem2.mappingData.push({
                                                    "destination": object.destination,
                                                    "showDetails": false,
                                                    "source": object.source,
                                                    "recordTypeMapping": recordTypeMapping,
                                                    "fieldMapping": []
                                                });
                                            }
                                        });
                                        mappingJSON.push(mappingItem2);
                                    }
                                });
                            }
                        }
                    });
                }

            });
            var newIndex;
            if (goNext === true) {
                newIndex = ((this.currentIndex + 1) > this.finalIndex) ? this.finalIndex : this.currentIndex + 1;
            } else {
                newIndex = this.currentIndex;
            }
            saveMappingItems({ assessmentId: this.assessmentId, mappings: JSON.stringify(mappingJSON), screenId: screenId, nextQuestionIndex: '' + (newIndex) })
                .then(result => {
                    //Return or go to next screen
                    if (goNext === true) {
                        window.scrollTo({ top: 0 });
                        if (this.currentIndex === this.finalIndex) {
                            this.goToMapping();
                        } else {
                            this.currentIndex++;
                            this.menuItems.forEach(item => {
                                item.selected = false;
                            });
                            this.menuItems[this.currentIndex].selected = true;
                            this.getQuestionContent(this.menuItems[this.currentIndex].Id);
                        }
                    } else {
                        const evt = new ShowToastEvent({
                            title: this.label.ToastTitleSave,
                            variant: 'success',
                        });
                        this.dispatchEvent(evt);
                        this.isLoading = false;
                    }

                })
                .catch(error => {
                    console.log("==ERR: ", error);
                    this.isLoading = false;
                });
        } catch (e) {
            console.log('=E: ', e.getMessage());
        }

    }

    saveScreen() {
        this.isLoading = true;
        this.recordMappings(false);
    }

    nextClicked() {
        this.isLoading = true;
        this.recordMappings(true);
    }

    goToMapping() {
        this.dispatchEvent(new CustomEvent('gotomapping'));
    }

    selectRow(e) {
        try {
            var value = (e.detail.value) ? e.detail.value : '';
            var questionIndex = e.target.dataset.qindex;
            var optionIndex = e.target.dataset.oindex;
            var followUpSectionIndex = e.target.dataset.followup;
            var rowIndex = e.target.dataset.rindex;

            if (followUpSectionIndex) {
                //Follow-Ups
                this.section.questions[questionIndex].options[optionIndex].followUp[followUpSectionIndex].MappedObjects[rowIndex].source = value;
            } else {
                //Normal Option
                this.section.questions[questionIndex].options[optionIndex].MappedObjects[rowIndex].source = value;
            }

        } catch (e) {
            console.log("==E: ", e);
        }
    }

    cancelAssessment() {
        try {
            this.dispatchEvent(new CustomEvent('closeassessment'));
        } catch (e) {
            console.log('==ERR: ', e);
        }
    }

    handleToggleSection() {

    }

    get showPrevious() {
        return this.currentIndex !== 0;
    }

    get showItem2() {
        return this.currentIndex === 3;
    }
}