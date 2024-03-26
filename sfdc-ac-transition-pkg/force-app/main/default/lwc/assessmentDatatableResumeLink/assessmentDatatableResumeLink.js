import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class AssessmentDatatableResumeLink extends NavigationMixin(LightningElement) {
    @api assessmentName;
    @api assessmentId;
    @api assessmentStatus;
    @api inProgressAssessment;

    fireResumeEvent(){
        this.dispatchEvent(new CustomEvent('resumeassessment', {bubbles: true, composed: true, detail: {
            assessmentId: this.assessmentId, 
            assessmentStatus: this.assessmentStatus
        }}));
    }

    navigateToRecordViewPage(evt) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: evt.target.dataset.id,
                actionName: 'view'
            }
        });
    }
}