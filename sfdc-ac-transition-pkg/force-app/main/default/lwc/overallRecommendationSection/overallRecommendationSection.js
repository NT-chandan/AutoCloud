import {api, LightningElement} from 'lwc';

export default class OverallRecommendationSection extends LightningElement {
    @api overallRecommendation;
    @api recommendations;
}