import { LightningElement, api } from 'lwc';

export default class AssessmentProgressIndicatorStep extends LightningElement {
    //Public
    @api
    label = '';
    @api
    description = '';
    @api
    value = '';
    @api
    currentStep = '';

    get isCompleted(){
        return parseInt(this.value) < parseInt(this.currentStep);
    }

    get isCurrentStep(){
        return parseInt(this.value) === parseInt(this.currentStep);
    }

    get itemClass(){
        if(this.isCompleted===true){
            return 'slds-progress__item slds-is-completed container';
        }else if(this.isCurrentStep===true){
            return 'slds-progress__item slds-is-active container';
        }else{
            return 'slds-progress__item container';
        }
    }

    get textSectionClass(){
        return (this.isCurrentStep===true) ? 'textSection activeText' : 'textSection';
    }

    get buttonClass(){
        if(this.isCompleted===true){
            return 'slds-button slds-button_icon slds-progress__marker slds-progress__marker_icon';
        }else if(this.isCurrentStep===true){
            return 'slds-button slds-progress__marker';
        }else{
            return 'slds-button slds-progress__marker';
        }
    }
}