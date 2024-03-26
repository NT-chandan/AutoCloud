import { LightningElement } from 'lwc';
import {SystemLoggerService} from 'c/systemLoggerService';

//Apex
import getSettings from '@salesforce/apex/AssessmentResultsController.getCustomSettings';
import turnOffWelcome from '@salesforce/apex/AssessmentResultsController.disableWelcomeDefault';

//Custom Labels
import AssessmentReportWelcomeText from '@salesforce/label/c.AssessmentReportWelcomeText';
import AssessmentReportWelcomeCheckboxText from '@salesforce/label/c.AssessmentReportWelcomeCheckboxText';
import UIContinueButtonText from '@salesforce/label/c.UIContinueButtonText';

export default class AssessmentResultsDisclaimer extends LightningElement {

    showUserPrompt = false;
    dontShowSelected = false;
    systemLogger;

    label = {
        AssessmentReportWelcomeText,
        AssessmentReportWelcomeCheckboxText,
        UIContinueButtonText
    }

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    connectedCallback(){
        getSettings({})
        .then(result => {
            this.showUserPrompt = !result;
            if(this.showUserPrompt!==true){
                this.dispatchEvent(new CustomEvent("showreport"));
            }else{
                this.dispatchEvent(new CustomEvent("showwelcome"));
            }
        })
        .catch(error => {
            console.log(error);
            this.systemLogger.log('Error', error, undefined, 'assessmentResultsDisclaimer#connectedCallback');
        });
    }

    continueClicked(){
        if(this.dontShowSelected===true){
            turnOffWelcome({})
            .then(result => {
                this.showUserPrompt = false;
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, undefined, 'assessmentResultsDisclaimer#continueClicked');
            });
        }
        this.dispatchEvent(new CustomEvent("showreport"));
    }

    setDontShow(e){
        this.dontShowSelected = e.detail.checked;
    }

}