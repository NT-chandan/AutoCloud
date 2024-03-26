import { LightningElement, api } from 'lwc';

import UIProgressIndicatorAssistiveText from '@salesforce/label/c.UIProgressIndicatorAssistiveText';

export default class AssessmentProgressIndicator extends LightningElement {
    //Public
    @api 
    steps = [];
    @api
    currentStep; 
    @api
    type="base"
    @api
    variant="base"

    label = {
        UIProgressIndicatorAssistiveText
    };

    get currentProgress(){
        return (((parseInt(this.currentStep)-1)/(this.steps.length-1))*100);
    }

    get currentProgressStyle(){
        return 'width: '+this.currentProgress+'%;';
    }
}