import { LightningElement, api, track, wire } from 'lwc';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { SystemLoggerService } from 'c/systemLoggerService';

import getNamespacedObject from '@salesforce/apex/Utilities.getNamespacedObject';
import getOrgType from '@salesforce/apex/AssessmentService.isInSandbox';
import getVerticals from '@salesforce/apex/AssessmentService.getOrgVerticals';
import getStartingQuestion from '@salesforce/apex/AssessmentService.getStartingQuestion';
import getAssessment from '@salesforce/apex/AssessmentService.getCurrentAssessmentQuestion';
import saveQuestionApex from '@salesforce/apex/AssessmentService.saveQuestion';
import apexSetStatus from '@salesforce/apex/AssessmentService.setStatus';
import getMapping from '@salesforce/apex/AssessmentService.getMappingSection';
import deleteSection from '@salesforce/apex/MappingService.deleteMappingSection';
import previousQuestion from '@salesforce/apex/AssessmentService.getPreviousQuestion';

import UINextButtonText from '@salesforce/label/c.UINextButtonText';
import UIBackButtonText from '@salesforce/label/c.UIBackButtonText';
import UICancelButtonText from '@salesforce/label/c.UICancelButtonText';
import UIPicklistPlaceholderText from '@salesforce/label/c.UIPicklistPlaceholderText';
import UICompleteAssessmentText from '@salesforce/label/c.UICompleteAssessmentText';
import UIStartAssessmentText from '@salesforce/label/c.UIStartAssessmentText';
import UISandboxDisclaimer from '@salesforce/label/c.AssessmentSandboxDisclaimer';
import UIOptionalDisclaimer from '@salesforce/label/c.AssessmentOptionalDisclaimer';
import UIOptionalDesc from '@salesforce/label/c.AssessmentOptionDesc';
import UIQuestionDesc from '@salesforce/label/c.QuestionScreenDesc';

export default class QuestionScreen extends LightningElement {
    @api assessmentid;
    @api industryname;
    @api fscDefs;

    @track isSandbox = false;
    @track verticalId;
    @track verticalList;
    @track question;
    @track showStart = false;
    @track showVerticals;
    @track showQuestion;
    @track showNext;
    @track showBack;
    verticalCount = 0;
    picklistFields;
    currentQuestionRequired;
    systemLogger;

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
        UIOptionalDesc
    };

    questionNumberChange = '';

    //Mapping variables
    @track lastQuestion;
    @track nextQuestion;
    @track lastMappableQuestion;
    @track startAtEndOfMap = false;
    @track overrideMappingIndex;
    @track currentMappingId;

    @track currentScreenIndex;

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    @wire(getNamespacedObject, {
        objectName: 'Assessment__c'
    })
    assessmentNamespaced;

    @wire(getObjectInfo, {
        objectApiName: '$assessmentNamespaced.data'
    })
    assessmentMetadata;

    @wire(getPicklistValuesByRecordType, {
        objectApiName: '$assessmentNamespaced.data',
        recordTypeId: '$assessmentMetadata.data.defaultRecordTypeId'
    })
    picklistValues({ error, data }) {
        if (data) {
            this.picklistFields = data;
            if (this.assessmentid) {
                this.loadAssessment();
            }
            else {
                getVerticals({ industryName: 'Automotive_Cloud' })
                    .then(result => {
                        this.verticalList = JSON.parse(JSON.stringify(result));
                        this.showVerticals = true;
                        this.dispatchEvent(new CustomEvent("stoploading", {}));
                    })
                    .catch(error => {
                        this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#getPicklistValuesByRecordType');
                        this.error = error;
                    });
            }
        }
    }

    @wire(getOrgType, {})
    orgType({ error, data }) {
        this.isSandbox = data;
    }

    loadAssessment() {
        getAssessment({ assessmentId: this.assessmentid })
            .then(result => {
                this.question = result;
                if (result === 'MAP') {
                    this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.assessmentid }));
                    // const questionData = this.prepQuestionForSave();
                    // const preparedQuestion = JSON.stringify(questionData);
                    // saveQuestionApex({currentQuestionJson: preparedQuestion})
                    // .then(questionResult => {
                    //     getMapping({currentQuestionJson: preparedQuestion})
                    //     .then(mappingResult => {
                    //         if(mappingResult) {
                    //             //Mapping(s), get mapping before going to next question
                    //             this.addPicklistValues();
                    //             this.startAtEndOfMap = false;
                    //             this.showQuestion = false;
                    //             this.overrideMappingIndex = result.CurrentMappingIndex;
                    //             this.currentMappingId = mappingResult;
                    //             if(questionResult){
                    //                 this.nextQuestion = questionResult;
                    //             }else{
                    //                 this.nextQuestion = null
                    //             }
                    //         }
                    //         else {
                    //             //No mappings; load next question
                    //             this.question = result;
                    //             this.loadQuestionSection();
                    //         }
                    //         this.dispatchEvent(new CustomEvent("stoploading", {}));
                    //     })
                    // })
                    // .catch(error => {
                    //     this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#loadAssessment');
                    //     this.error = error;
                    // });  
                } else {
                    this.currentScreenIndex = result;
                    this.showQuestion = true;
                }
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#loadAssessment');
                this.error = error;
            });
    }

    startAssessment() {
        this.showVerticals = false;
        this.dispatchEvent(new CustomEvent("gotoquestionnaire", { detail: this.assessmentid }));
        getStartingQuestion({ verticalList: this.verticalList })
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

    // loadQuestionSection() {
    //     // if(!this.question){
    //     //     apexSetStatus({assessmentId: this.assessmentid, questionId: 'MAP', index: '', mappingIndex: '', numberChange: ''})
    //     //     .then(statusResult => {
    //     //         this.questionNumberChange = '';
    //     //         this.dispatchEvent(new CustomEvent("assessmentcomplete", {detail: this.assessmentid}));
    //     //     })
    //     //     .catch(error => {
    //     //         this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#loadQuestionSection');
    //     //         this.error = error;
    //     //     });
    //     // }
    //     // else{
    //     if(this.assessmentid){
    //         apexSetStatus({assessmentId: this.assessmentid, questionId: this.question.QuestionId, index: this.question.QuestionNumber, mappingIndex: '', numberChange: this.questionNumberChange})
    //         .then(statusResult => {
    //             this.questionNumberChange = '';
    //             this.showNext = !this.question.IsRequired;
    //             this.showBack = this.question.QuestionNumber > 1;
    //             this.currentQuestionRequired = this.question.IsRequired;
    //             this.addPicklistValues();
    //             this.showQuestion = true;
    //             this.dispatchEvent(new CustomEvent("stoploading", {}));
    //         })
    //         .catch(error => {
    //             this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#loadQuestionSection2');
    //             this.error = error;
    //         });
    //     }else{
    //         this.questionNumberChange = '';
    //         this.showNext = !this.question.IsRequired;
    //         this.showBack = this.question.QuestionNumber > 1;
    //         this.currentQuestionRequired = this.question.IsRequired;
    //         this.addPicklistValues();
    //         this.showQuestion = true;
    //     }

    //     // }

    // }

    submitQuestion() {
        const questionData = this.prepQuestionForSave();
        const preparedQuestion = JSON.stringify(questionData);

        saveQuestionApex({ currentQuestionJson: preparedQuestion })
            .then(result => {
                if (result) {
                    if (!this.assessmentid) {
                        this.assessmentid = result.AssessmentId;
                    }
                    //Mapping check
                    if (questionData.SelectedAnswer || (questionData.SelectedAnswers && questionData.SelectedAnswers.length > 0)) {
                        getMapping({ currentQuestionJson: preparedQuestion })
                            .then(mappingResult => {
                                if (mappingResult) {
                                    //Mapping(s), get mapping before going to next question
                                    this.startAtEndOfMap = false;
                                    this.overrideMappingIndex = null;
                                    this.showQuestion = false;
                                    this.currentMappingId = mappingResult;
                                    this.nextQuestion = result;
                                }
                                else {
                                    //No mappings; load next question
                                    var allAnswersList = this.combineAnswerList();

                                    deleteSection({ assessmentId: this.assessmentid, answerValues: allAnswersList })
                                        .then((deleteResult) => {
                                            //load next question
                                            this.question = result;
                                            this.nextQuestion = null;
                                            this.questionNumberChange = 'next';
                                            this.loadQuestionSection();
                                        })
                                        .catch(error => {
                                            this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion');
                                            this.error = error;
                                        });
                                }
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion2');
                                this.error = error;
                            });
                    } else {
                        //No mappings

                        //Delete any existing mappings for this section
                        var allAnswersList = this.combineAnswerList();

                        deleteSection({ assessmentId: this.assessmentid, answerValues: allAnswersList })
                            .then((deleteResult) => {
                                //load next question
                                this.question = result;
                                this.nextQuestion = null;
                                this.questionNumberChange = 'next';
                                this.loadQuestionSection();
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion3');
                                this.error = error;
                            });
                    }
                }
                else {
                    //Mapping check (scenario where no next question exists)
                    if (questionData.SelectedAnswer || (questionData.SelectedAnswers && questionData.SelectedAnswers.length > 0)) {
                        getMapping({ currentQuestionJson: preparedQuestion })
                            .then(mappingResult => {
                                if (mappingResult) {
                                    //Mapping(s), get mapping before going to next question
                                    this.startAtEndOfMap = false;
                                    this.showQuestion = false;
                                    this.currentMappingId = mappingResult;
                                    this.nextQuestion = null;
                                }
                                else {
                                    //No mappings; next screen
                                    var allAnswersList = this.combineAnswerList();

                                    deleteSection({ assessmentId: this.assessmentid, answerValues: allAnswersList })
                                        .then((deleteResult) => {
                                            //Set status and progress to mapping
                                            apexSetStatus({ assessmentId: this.assessmentid, questionId: 'MAP', index: this.question.QuestionNumber, mappingIndex: '', numberChange: '' })
                                                .then(statusResult => {
                                                    this.questionNumberChange = '';
                                                    this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.assessmentid }));
                                                })
                                        })
                                        .catch(error => {
                                            this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion4');
                                            this.error = error;
                                        });
                                }
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion5');
                                this.error = error;
                            });
                    } else {
                        //No mappings; next screen

                        //Delete any existing mappings for this section
                        var allAnswersList = this.combineAnswerList();

                        deleteSection({ assessmentId: this.assessmentid, answerValues: allAnswersList })
                            .then((deleteResult) => {
                                //Set status and progress to mapping
                                apexSetStatus({ assessmentId: this.assessmentid, questionId: 'MAP', index: this.question.QuestionNumber, mappingIndex: '', numberChange: '' })
                                    .then(statusResult => {
                                        this.questionNumberChange = '';
                                        this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.assessmentid }));
                                    })
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion6');
                                this.error = error;
                            });
                    }
                }
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentid, 'questionScreen#submitQuestion7');
                this.error = error;
            });
    }

    prevQuestion() {
        try {
            if (this.question.QuestionNumber === 1) {
                this.currentMappingId = null;
                this.loadQuestionSection();
            } else {
                const preparedQuestion = JSON.stringify(this.prepQuestionForSave());

                previousQuestion({ currentQuestionJson: preparedQuestion })
                    .then(result => {
                        if (result) {
                            if (this.showQuestion === true && (result.SelectedAnswer || (result.SelectedAnswers && result.SelectedAnswers.length > 0))) {
                                getMapping({ currentQuestionJson: JSON.stringify(this.prepQuestionForSave(result)) })
                                    .then(mappingResult => {
                                        if (mappingResult) {
                                            //Mapping(s), get mapping before going to next question
                                            this.overrideMappingIndex = null;
                                            this.startAtEndOfMap = true;
                                            this.showQuestion = false;
                                            this.currentMappingId = mappingResult;
                                            if (result.IsPicklist === true || result.IsMultiSelect === true) {
                                                result.AnswerValues = this.findPicklistValuesByFieldName(result.AnswerFieldAPIName);
                                            }
                                            this.nextQuestion = this.question;
                                            this.question = result;
                                        }
                                    })
                                    .catch(error => {
                                        this.error = error;
                                        this.systemLogger.log('Error', error, this.assessmentid, 'prevQuestion');
                                    });
                            } else {
                                this.question = result;
                                this.showQuestion = true;
                                this.currentMappingId = null;
                                this.questionNumberChange = 'back';
                                this.loadQuestionSection();
                            }


                        }
                    })
                    .catch(error => {
                        this.systemLogger.log('Error', error, this.assessmentid, 'prevQuestion2');
                        this.error = error;
                    });
            }
        } catch (e) {
            this.systemLogger.log('Error', e, this.assessmentid, 'prevQuestion3');
        }
    }

    cancelAssessment() {
        this.dispatchEvent(new CustomEvent("closequestionscreen", {}));
    }

    addPicklistValues() {
        if (this.question.IsPicklist === true || this.question.IsMultiSelect === true) {
            this.question.AnswerValues = this.findPicklistValuesByFieldName(this.question.AnswerFieldAPIName);
            if (this.question.ExcludeOptions && this.question.ExcludeOptions.length) {
                let answersAfterExclusion = [];
                let excludeSet = new Set(this.question.ExcludeOptions);
                for (let index = 0; index < this.question.AnswerValues.length; index++) {
                    if (excludeSet.has(this.question.AnswerValues[index].label) == false) {
                        answersAfterExclusion.push(this.question.AnswerValues[index]);
                    }
                }
                this.question.AnswerValues = answersAfterExclusion;

                if (this.question.SelectedAnswer && excludeSet.has(this.question.SelectedAnswer)) {
                    this.question.SelectedAnswer = '';
                }

                if (this.question.SelectedAnswers && this.question.SelectedAnswers.length) {
                    let selectedAnswersAfterExclusion = [];
                    for (let index = 0; index < this.question.SelectedAnswers.length; index++) {
                        if (excludeSet.has(this.question.SelectedAnswers[index]) == false) {
                            selectedAnswersAfterExclusion.push(this.question.SelectedAnswers[index]);
                        }
                    }
                    this.question.SelectedAnswers = selectedAnswersAfterExclusion;
                }
            }
        }
    }

    prepQuestionForSave(qOverride) {
        var question = (qOverride) ? qOverride : this.question;
        let clonedQuestion = JSON.parse(JSON.stringify(question));
        delete clonedQuestion.AnswerValues;
        if (clonedQuestion.IsMultiSelect === true) {
            clonedQuestion.SelectedAnswer = clonedQuestion.SelectedAnswers.join(';');
        }
        delete clonedQuestion.SelectedAnswers;
        return clonedQuestion;
    }

    findPicklistValuesByFieldName(fieldName) {
        return this.picklistFields.picklistFieldValues[fieldName].values;
    }

    handleCombobox(event) {
        this.question.SelectedAnswer = event.detail.value;
        if (this.currentQuestionRequired && this.question.SelectedAnswer) {
            this.showNext = true;
        }
        else if (this.currentQuestionRequired) {
            this.showNext = false;
        }
    }

    handleCheckboxGroup(event) {
        this.question.SelectedAnswers = event.detail.value;
        if (this.currentQuestionRequired && this.question.SelectedAnswers.length > 0) {
            this.showNext = true;
        }
        else if (this.currentQuestionRequired) {
            this.showNext = false;
        }
    }

    handleToggle(event) {
        this.question.SelectedCheckbox = this.template.querySelector("[data-index='0']").checked;
        if (this.currentQuestionRequired && this.question.SelectedCheckbox) {
            this.showNext = true;
        }
        else if (this.currentQuestionRequired) {
            this.showNext = false;
        }
    }

    handleVerticalSelection(event) {
        this.verticalList[event.currentTarget.dataset.index].VerticalSelected = this.template.querySelector("[data-index='" + event.currentTarget.dataset.index + "']").checked;
        if (this.verticalList[event.currentTarget.dataset.index].VerticalSelected) {
            this.verticalCount++;
        }
        else {
            this.verticalCount--;
        }

        this.showStart = this.verticalCount > 0;
    }

    nextQuestionFromMapping(e) {
        this.currentMappingId = null;
        this.question = this.nextQuestion;
        this.nextQuestion = null;
        this.questionNumberChange = 'next';
        this.loadQuestionSection();
    }

    previousQuestionFromMapping(e) {
        this.currentMappingId = null;
        this.questionNumberChange = 'back';
        this.loadQuestionSection();
    }

    combineAnswerList() {
        var allAnswersList = [];
        this.question.AnswerValues.forEach(answerOption => {
            allAnswersList.push(answerOption.value);
        });
        this.question.ExcludeOptions.forEach(excludeOption => {
            allAnswersList.push(excludeOption);
        });
        return allAnswersList;
    }

    goMapping(e) {
        apexSetStatus({ assessmentId: this.assessmentid, questionId: 'MAP', index: 4, mappingIndex: '', numberChange: '' })
            .then(statusResult => {
                this.questionNumberChange = '';
                this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.assessmentid }));
            })
    }

    goHome(e) {
        this.cancelAssessment();
    }

    get showMapping() {
        return this.currentMappingId;
    }

}