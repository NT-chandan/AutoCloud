import { LightningElement, api } from 'lwc';

export default class AssessmentRecommendation extends LightningElement {
    @api recommendation;
    @api iconSizeOverride;

    get severityIconSize() {
        return (this.recommendation && this.recommendation.severityIcon.includes('action:')) ? this.iconSizeOverride : 'medium';//recommendation.severityIcon.indexOf()
    }

    get severityIconStyle() {
        switch(this.recommendation.severityIcon) {
            case 'utility:info':
                return 'icon-info';
            case 'utility:warning':
                return 'icon-warning';
        }
    }

    get shouldShowRecommendation(){
        return this.recommendation && this.recommendation.hasOwnProperty('severityIcon');
    }
}