import {LightningElement} from 'lwc';
import LightningDatatable from 'lightning/datatable';
import assessmentDataTableRichTextComponent from './assessmentDataTableRichTextComponent.html';
import assessmentDataTableSubTableComponent from './assessmentDataTableSubTableComponent.html';
import assessmentDatatableResumeLink from './assessmentDatatableResumeLink.html';

export default class AssessmentDatatable extends LightningDatatable {
    static customTypes = {
        richText: {
            template: assessmentDataTableRichTextComponent
        },
        subTable: {
            template: assessmentDataTableSubTableComponent,
            typeAttributes: ['subTableDataList', 'subTableColumnList', 'subTableTitleList', 'subTableIconList']
        },
        link: {
            template: assessmentDatatableResumeLink,
            typeAttributes: ['assessmentName', 'assessmentId', 'assessmentStatus', 'inProgressAssessment']
        }
    };
}