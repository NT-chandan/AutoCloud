import { api, track, wire, LightningElement } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { getFieldValue } from 'lightning/uiRecordApi';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { subscribe, onError } from 'lightning/empApi';
import { refreshApex } from '@salesforce/apex';
import { SystemLoggerService } from 'c/systemLoggerService';

//custom apex
import getResults from '@salesforce/apex/AssessmentResultsController.getAssessmentResults';
import getObjectMapping from '@salesforce/apex/MappingService.getObjectMappingForAssessment';
import getReportStructure from '@salesforce/apex/AssessmentResultsController.getAssessmentReportStructure';
import getNamespacedObject from '@salesforce/apex/Utilities.getNamespacedObject';
import getVehicleFlag from '@salesforce/apex/AssessmentService.getVehicleRecord';
import getPageStateNamespace from '@salesforce/apex/Utilities.getPageStateNamespace';
import getNamespaceUnderscore from '@salesforce/apex/Utilities.getNamespaceUnderscore';
import getConfig from '@salesforce/apex/AssessmentConfigController.getReportConfig';
import getUnmappedRequiredFields from '@salesforce/apex/AssessmentResultsController.getUnmappedRequiredFields';
import getDataTypeMisMatchedFields from '@salesforce/apex/AssessmentResultsController.getDataTypeMisMatchedFields';
// custom settings
import getFullCustomSettings from '@salesforce/apex/AssessmentResultsController.hideReportSummary'

//custom labels
import stillScanningWelcome from '@salesforce/label/c.AssessmentReportScanningTitle'
import stillScanningText from '@salesforce/label/c.AssessmentReportScanningDesc'
import scanningAssistText from '@salesforce/label/c.AssessmentReportScanningAssist'
import assessmentResultsEmptyTable from '@salesforce/label/c.AssessmentResultsEmptyTable'
import ObjectRelationshipText from '@salesforce/label/c.ObjectRelationshipText'
import assessmentTableFeature from '@salesforce/label/c.AssessmentReportTableFeature'
import assessmentTablePriority from '@salesforce/label/c.AssessmentReportTablePriority'
import assessmentTableRecommendation from '@salesforce/label/c.AssessmentReportTableRecommendation'
import assessmentTableTransitionFrom from '@salesforce/label/c.AssessmentReportTableTransitionFrom'
import assessmentTableTransitionTo from '@salesforce/label/c.AssessmentReportTableTransitionTo'
import assessmentTableComponentType from '@salesforce/label/c.AssessmentReportTableComponentType'
import assessmentTableComponentName from '@salesforce/label/c.AssessmentReportTableComponentName'
import assessmentTableUsersAssigned from '@salesforce/label/c.AssessmentReportTableUsersAssigned'
import assessmentTableSharingInternal from '@salesforce/label/c.AssessmentReportTableSharingInternal'
import assessmentTableSharingExternal from '@salesforce/label/c.AssessmentReportTableSharingExternal'
import assessmentTableRecordCount from '@salesforce/label/c.AssessmentReportTableRecordCount'
import assessmentTableFieldCount from '@salesforce/label/c.AssessmentReportTableFieldCount'
import assessmentTableEncryptionType from '@salesforce/label/c.AssessmentReportTableEncryptionType'
import assessmentTableArchiveAfterMonths from '@salesforce/label/c.AssessmentReportTableArchiveAfterMonths'
import assessmentTableArchiveRetentionYears from '@salesforce/label/c.AssessmentReportTableArchiveRetentionYears'
import fieldAnalysisIntro from '@salesforce/label/c.FieldAnalysisIntro'
import fieldAnalysisTracking from '@salesforce/label/c.FieldAnalysisTracking'
import fieldAnalysisHeadingEncryption from '@salesforce/label/c.FieldAnalysisHeadingEncryption'
import fieldAnalysisHeadingFieldAudit from '@salesforce/label/c.FieldAnalysisHeadingFieldAudit'
import mappingDisclaimer from '@salesforce/label/c.ReportMappingFileDisclaimer'
import nonAdminErrorMessage from '@salesforce/label/c.NonAdminErrorMessage'
import UnmappedReqFieldDescriptionText from '@salesforce/label/c.UnmappedReqFieldDescriptionText'
import MismatchedDatatypeFieldDescriptionText from '@salesforce/label/c.MismatchedDatatypeFieldDescriptionText'
import SummaryLevelAnalysisDescriptionText from '@salesforce/label/c.SummaryLevelAnalysisDescriptionText'

//assessment record fields
import ID_FIELD from '@salesforce/schema/Assessment__c.Id';
import NAME_FIELD from '@salesforce/schema/Assessment__c.Name';
import CREATED_BY_FIELD from '@salesforce/schema/Assessment__c.CreatedBy.Name';
import CREATED_BY_ID_FIELD from '@salesforce/schema/Assessment__c.CreatedBy.Id';
import CREATED_DATE_FIELD from '@salesforce/schema/Assessment__c.CreatedDate';
import STATUS_FIELD from '@salesforce/schema/Assessment__c.Status__c';
import MAPPING_DATA_FIELD from '@salesforce/schema/Assessment__c.HasMappingData__c';
import REPORT_DATE_FIELD from '@salesforce/schema/Assessment__c.Report_Date__c';
import PDF_GENERATION_COMPLETE_FIELD from '@salesforce/schema/Assessment__c.PDF_Generation_Complete__c';
import RS_PDF_GENERATION_COMPLETE_FIELD from '@salesforce/schema/Assessment__c.Report_Summary_PDF_Generation_Complete__c';
import IS_NON_ADMIN_USER_FIELD from '@salesforce/schema/Assessment__c.Is_Non_Admin_User__c';

const ASSESSMENT_FIELDS = [ID_FIELD, NAME_FIELD, CREATED_BY_FIELD, CREATED_BY_ID_FIELD, CREATED_DATE_FIELD, STATUS_FIELD, MAPPING_DATA_FIELD, PDF_GENERATION_COMPLETE_FIELD, RS_PDF_GENERATION_COMPLETE_FIELD, IS_NON_ADMIN_USER_FIELD, REPORT_DATE_FIELD];
const ASSESSMENT_STATUS_REVIEW = 'Review';
const ASSESSMENT_STATUS_MAPPING = 'Mapping';

export default class AssessmentResults extends NavigationMixin(LightningElement) {
    @api recordId;
    // Declare the currentPageReference variable in order to track it
    currentPageReference;
    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        this.currentPageReference = currentPageReference;
    }

    // fullCustomSettings;
    @track hideReportSummary = false;

    @track excludedSections = [];
    @track objectRelationshipData = [];
    assessmentResults = {};
    @track reportSections = [];
    resultsData;
    analysisData;
    accessData;
    systemLogger;
    sharingSettingData;
    encryptionData;
    fieldAuditData;
    reportSummaryData;
    vehicleFlag;
    resultsLoaded;
    sectionNames = [];
    activeSectionNames = [];
    activeSectionNamesTop = ["welcome"];
    channelName = '/data/Assessment__ChangeEvent';

    reportSummarySection;
    reportSummarySubsections = [];

    @track pdfMode = 'full';

    @track preSalesItems;
    unmappedFields_Required
    totalApexClassesAffected;
    totalRecordTypesAffected;
    totalPageLayoutsAffected
    totalMappedObjects;
    totalUnmappedObjects;
    misMatchedDataTypeFields;
    /**
     * Custom labels
     */

    label = {
        stillScanningText,
        stillScanningWelcome,
        scanningAssistText,
        assessmentResultsEmptyTable,
        ObjectRelationshipText,
        assessmentTableFeature,
        assessmentTablePriority,
        assessmentTableRecommendation,
        assessmentTableTransitionFrom,
        assessmentTableTransitionTo,
        assessmentTableComponentType,
        assessmentTableComponentName,
        assessmentTableUsersAssigned,
        assessmentTableSharingInternal,
        assessmentTableSharingExternal,
        assessmentTableRecordCount,
        assessmentTableFieldCount,
        assessmentTableEncryptionType,
        assessmentTableArchiveAfterMonths,
        assessmentTableArchiveRetentionYears,
        fieldAnalysisIntro,
        fieldAnalysisTracking,
        fieldAnalysisHeadingEncryption,
        fieldAnalysisHeadingFieldAudit,
        mappingDisclaimer,
        nonAdminErrorMessage,
        UnmappedReqFieldDescriptionText,
        MismatchedDatatypeFieldDescriptionText,
        SummaryLevelAnalysisDescriptionText
    };

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    /**
     * GETTERS for conditional display
     */
    get objectFields() {
        if (this.unmappedFields_Required) {
            return Object.keys(this.unmappedFields_Required).map(key => {
                return { objectType: key, fields: this.unmappedFields_Required[key] };
            });
        }
    }

    get misMatchedFields() {
        if (this.misMatchedDataTypeFields) {
            return Object.keys(this.misMatchedDataTypeFields).map(key => {
                return { objectType: key, fields: this.misMatchedDataTypeFields[key] };
            });
        }
    }

    get status() {
        return getFieldValue(this.assessment.data, STATUS_FIELD);
    }

    get isPdfGenerationComplete() {
        return getFieldValue(this.assessment.data, PDF_GENERATION_COMPLETE_FIELD);
    }

    get isReportSummaryPdfGenerationComplete() {
        return getFieldValue(this.assessment.data, RS_PDF_GENERATION_COMPLETE_FIELD);
    }

    get isScanning() {
        return (!this.isLoading && this.assessment && this.assessment.data && this.status !== ASSESSMENT_STATUS_REVIEW);
    }

    get isLoading() {
        return !this.resultsLoaded || !this.reportSections.length;
    }

    get hasSharingSettingData() {
        return this.sharingSettingData && this.sharingSettingData.length > 0;
    }
    get hasAccessData() {
        return this.accessData && this.accessData.length > 0;
    }
    get hasAnalysisData() {
        return this.analysisData && this.analysisData.length > 0;
    }
    get hasEncryptionData() {
        return this.encryptionData && this.encryptionData.length > 0;
    }
    get hasFieldAuditData() {
        return this.fieldAuditData && this.fieldAuditData.length > 0;
    }
    get isNonAdminUser() {
        return getFieldValue(this.assessment.data, IS_NON_ADMIN_USER_FIELD);
    }

    resultsColumns = [
        { label: this.label.assessmentTableFeature, fieldName: 'replaceWithFscUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'replaceWithFsc' } } },
        { label: this.label.assessmentTablePriority, fieldName: 'recommendText', wrapText: true, type: 'text' },
        { label: this.label.assessmentTableRecommendation, fieldName: 'featureText', type: 'text', wrapText: true, typeAttributes: { linkify: true } }
    ];
    analysisColumns = [
        { label: this.label.assessmentTableTransitionFrom, fieldName: 'fromComponentUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'fromComponentName' } } },
        { label: this.label.assessmentTableComponentType, fieldName: 'fromComponentType', type: 'text' },
        { label: this.label.assessmentTableRecordCount, fieldName: 'fromComponentSize', type: 'number', cellAttributes: { alignment: 'left' } },
        { label: this.label.assessmentTableTransitionTo, fieldName: 'toComponentName', type: 'text' },
        { label: this.label.assessmentTableRecommendation, fieldName: 'reasonText', type: 'text', wrapText: true, typeAttributes: { linkify: true } }
    ];
    accessInfoColumns = [
        { label: this.label.assessmentTableComponentName, fieldName: 'fromComponentUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'fromComponentName' } } },
        { label: this.label.assessmentTableComponentType, fieldName: 'fromComponentType', type: 'text' },
        { label: this.label.assessmentTableUsersAssigned, fieldName: 'reasonText', type: 'text', wrapText: true }
    ];
    sharingSettingColumns = [
        { label: this.label.assessmentTableTransitionFrom, fieldName: 'fromComponentUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'fromComponentName' } } },
        { label: this.label.assessmentTableComponentType, fieldName: 'fromComponentType', type: 'text' },
        { label: this.label.assessmentTableSharingInternal, fieldName: 'fromComponentInternalSharing', type: 'text' },
        { label: this.label.assessmentTableSharingExternal, fieldName: 'fromComponentExternalSharing', type: 'text' },
        { label: this.label.assessmentTableRecommendation, fieldName: 'reasonText', type: 'text', wrapText: true }
    ];
    encryptionColumns = [
        { label: this.label.assessmentTableComponentName, fieldName: 'fromComponentUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'fromComponentName' } } },
        { label: this.label.assessmentTableEncryptionType, fieldName: 'fromComponentType', type: 'text' },
        { label: this.label.assessmentTableFieldCount, fieldName: 'fromComponentSize', type: 'number', cellAttributes: { alignment: 'left' } }
    ];
    fieldAuditColumns = [
        { label: this.label.assessmentTableComponentName, fieldName: 'fromComponentUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'fromComponentName' } } },
        { label: this.label.assessmentTableFieldCount, fieldName: 'fromComponentSize', type: 'number', cellAttributes: { alignment: 'left' } },
        { label: this.label.assessmentTableArchiveAfterMonths, fieldName: 'fromComponentArchiveAfterMonths', type: 'number', cellAttributes: { alignment: 'left' } },
        { label: this.label.assessmentTableArchiveRetentionYears, fieldName: 'fromComponentArchiveRetentionYears', type: 'number', cellAttributes: { alignment: 'left' } }

    ];

    /**
     * Wires
     */

    @wire(getRecord, { recordId: '$recordId', fields: ASSESSMENT_FIELDS })
    assessment;

    //No __c due to ChangeEvents not needing it
    @wire(getNamespacedObject, { objectName: 'Assessment' })
    handleNamespace(response) {
        if (response && response.data) {
            this.channelName = '/data/' + response.data + '__ChangeEvent';
            //Subscribe to record changes
            this.registerErrorListener();
            this.handleSubscribe();
        }
    }

    @wire(getFullCustomSettings)
    wiredSettings(result) {
        this.hideReportSummary = result.data;
        // this.fullCustomSettings = result;
    }

    /**
     * Component Loaded
     */
    connectedCallback() {
        if (!this.resultsLoaded)
            this.getUnmappedRequiredFields();
        this.getmisMatchedDataTpyeFields()
        getVehicleFlag({ assessmentId: this.recordId })
            .then(res => {
                this.vehicleFlag = res;
            })
        getResults({ assessmentId: this.recordId })
            .then(result => {
                let apexClassesAffected = [];
                let recordTypesAffected = [];
                let pageLayoutsAffected = [];
                this.assessmentResults = result;
                this.resultsData = this.assessmentResults.analysis.assessmentResults || [];
                // this.preSalesItems = this.assessmentResults.analysis.assessmentResultsListItems || [];
                if (this.assessmentResults.analysis.assessmentResultsListItems) {
                    const preSalesRecord = this.assessmentResults.analysis.assessmentResultsListItems;
                    const tempList = [];
                    preSalesRecord.forEach(salesRecord => {
                        if (this.vehicleFlag) {
                            if (salesRecord.replaceWithFsc !== 'NoVehicleText') {
                                tempList.push(salesRecord);
                            }
                        }
                        else {
                            tempList.push(salesRecord);
                        }
                    })
                    this.preSalesItems = tempList;
                }
                else {
                    this.preSalesItems = []
                }

                this.analysisData = this.adjustTreeGridChildren(this.assessmentResults.analysis.migrationAnalysis) || [];
                this.transitionApproach = this.assessmentResults.analysis.transitionApproach || [];
                this.accessData = this.adjustTreeGridChildren(this.assessmentResults.analysis.accessInfoResults) || [];
                this.sharingSettingData = this.adjustTreeGridChildren(this.assessmentResults.analysis.sharingSettingResults) || [];
                this.encryptionData = this.adjustTreeGridChildren(this.assessmentResults.analysis.encryptionResults) || [];
                this.fieldAuditData = this.adjustTreeGridChildren(this.assessmentResults.analysis.fieldAuditResults) || [];
                this.totalMappedObjects = this.assessmentResults.analysis.reportSummaryResults.mappedObjectsCount;
                this.totalUnmappedObjects = this.assessmentResults.analysis.reportSummaryResults.totalObjectsCount - this.totalMappedObjects;
                for (var i in this.assessmentResults.analysis.migrationAnalysis) {
                    for (var j in this.assessmentResults.analysis.migrationAnalysis[i]._children) {
                        if (this.assessmentResults.analysis.migrationAnalysis[i]._children[j].fromComponentType == 'ApexClass') {
                            for (var k in this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children) {
                                if (!apexClassesAffected.includes(this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName)) {
                                    apexClassesAffected.push(this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName);
                                }
                            }
                        }
                        if (this.assessmentResults.analysis.migrationAnalysis[i]._children[j].fromComponentType == 'Layout') {
                            for (var k in this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children) {
                                if (!pageLayoutsAffected.includes(this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName)) {
                                    pageLayoutsAffected.push(this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName);
                                }
                            }
                        }
                        if (this.assessmentResults.analysis.migrationAnalysis[i]._children[j].fromComponentType == 'RecordType') {
                            for (var k in this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children) {
                                if (!recordTypesAffected.includes(this.assessmentResults.analysis.migrationAnalysis[i].fromComponentName + '_' + this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName)) {
                                    recordTypesAffected.push(this.assessmentResults.analysis.migrationAnalysis[i].fromComponentName + '_' + this.assessmentResults.analysis.migrationAnalysis[i]._children[j]._children[k].fromComponentName);
                                }
                            }
                        }
                    }
                }
                try {
                    this.totalApexClassesAffected = apexClassesAffected.length;
                    this.totalRecordTypesAffected = recordTypesAffected.length;
                    this.totalPageLayoutsAffected = pageLayoutsAffected.length;
                    this.reportSummaryData = JSON.parse(JSON.stringify(this.assessmentResults.analysis.reportSummaryResults)) || [];
                    // Get a few data points that are not generated on the Report Summary by Apex
                    this.reportSummaryData.recommendedSettings = JSON.parse(JSON.stringify(this.assessmentResults.installReadiness));
                    this.reportSummaryData.overallRecommendation = JSON.parse(JSON.stringify(this.assessmentResults.overallRecommendation));
                    this.reportSummaryData.recommendations = JSON.parse(JSON.stringify(this.assessmentResults.recommendations));
                } catch (e) {
                    console.log(e);
                }

                this.resultsLoaded = true;
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#connectedCallback');
            });
        if (!this.reportSections.length)
            getConfig()
                .then(result => {
                    this.excludedSections = new Set([...result.ExcludedSections]);
                    getReportStructure({ assessmentId: this.recordId })
                        .then(result => {
                            if (result && result.sections) {
                                var sectionList = [...result.sections];
                                sectionList.forEach(section => {
                                    if (!this.excludedSections.has(section.name)) {
                                        this.reportSections.push(section);
                                    }
                                });
                                //this.reportSections = result.sections;
                                this.sectionNames = [];

                                for (const section of this.reportSections) {
                                    this.sectionNames.push(section.name);

                                    switch (section.name.toLowerCase()) {
                                        case ('welcome'):
                                            section.isWelcomeSection = true;
                                            section.isTopLevel = true;
                                            break;
                                        case ('reportsummary'):
                                            section.isReportSummarySection = true;
                                            section.isTopLevel = true;

                                            var filteredSubsections = [];
                                            for (let subsection of section.subsections) {

                                                // Default all subsections to show their full content from their labels
                                                subsection.showContent = true;

                                                switch (subsection.name.toLowerCase()) {
                                                    case ('reportsummaryunderstandingthisreport'):
                                                        subsection.isUnderstandingThisReportSection = true;
                                                        subsection.showContent = false;
                                                        break;
                                                    case ('reportsummarytoc'):
                                                        subsection.isTOCSection = true;
                                                        break;
                                                    case ('reportsummarysystemoverview'):
                                                        subsection.isSystemOverviewSubsection = true;
                                                        break;
                                                    case ('reportsummarytransitionapproach'):
                                                        subsection.isTransitionApproachSubsection = true;
                                                        break;
                                                    case ('reportsummaryusedobjects'):
                                                        subsection.isNotableUsedObjectsSubsection = true;
                                                        break;
                                                    case ('reportsummaryrecommendedsettings'):
                                                        subsection.isRecommendedSettingsSubsection = true;
                                                        break;
                                                    case ('reportsummarybasisofassessment'):
                                                        subsection.isBasisOfAssessmentSubsection = true;
                                                        break;
                                                    case ('reportsummarypermissions'):
                                                        subsection.isPermissionsSubsection = true;
                                                        break;
                                                    case ('reportsummarymigrationanalysis'):
                                                        subsection.isMigrationAnalysisSubsection = true;
                                                        break;
                                                    case ('reportsummaryconsiderations'):
                                                        subsection.isConsiderationsSubsection = true;
                                                        break;
                                                    default:
                                                        subsection.isDefaultSection = true;
                                                }

                                                if (!this.excludedSections.has(subsection.name)) {
                                                    filteredSubsections.push(subsection);
                                                }
                                            }

                                            section.subsections = filteredSubsections;

                                            this.reportSummarySection = section;

                                            break;
                                        case ('overallrecommendation'):
                                            section.isOverallRecommendationSection = true;
                                            break;
                                        case ('migrationanalysis'):
                                            section.isMigrationAnalysisSection = true;
                                            break;
                                        case ('assessmentresults'):
                                            section.isAssessmentResultsSection = true;
                                            break;
                                        case ('profileanalysis'):
                                            section.isProfileAnalysisSection = true;
                                            break;
                                        case ('sharingsettinganalysis'):
                                            section.isSharingSettingAnalysisSection = true;
                                            break;
                                        case ('fieldanalysis'):
                                            section.isFieldAnalysisSection = true;
                                            break;
                                        default:
                                            section.isDefaultSection = true;
                                    }

                                    for (const subsection of section.subsections) {
                                        // needed for moustache templates being leveraged for pdf generation
                                        subsection.subtitle = subsection.title ? subsection.title : '';

                                        if (subsection.isImage) {
                                            subsection.style = '';

                                            if (subsection.imageHeight)
                                                subsection.style = "height:" + subsection.imageHeight + ';';

                                            if (subsection.imageWidth)
                                                subsection.style += "width:" + subsection.imageWidth + ';';

                                            subsection.assetAbsoluteUrl = window.location.origin + subsection.body;
                                        }
                                    }
                                }
                            }
                        })
                        .catch(error => {
                            this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#connectedCallback');
                        });
                })
                .catch(error => {
                    this.isLoading = false;
                });
    }

    // Ensure unstyled icons are set to the correct colors after rendering
    renderedCallback() {
        let icons = this.template.querySelectorAll('lightning-icon');
        for (let icon of icons) {
            if (icon.classList.contains('slds-icon-utility-info')) {
                icon.classList.add('icon-info');
            }
            if (icon.classList.contains('slds-icon-utility-warning')) {
                icon.classList.add('icon-warning');
            }
        }

        getObjectMapping({ assessmentId: this.recordId, populateSourceDef: false })
            .then(result => {
                const recommended = result.recommended;
                let myObjMap = new Map();
                recommended.forEach(rcData => {
                    const mappingData = rcData.mappingData;
                    mappingData.forEach(mapData => {
                        const destObjName = mapData.destination;
                        const fieldMap = mapData.destinationDef.fieldMapping
                        let fieldRefObjList = [];
                        fieldMap.forEach(field => {
                            if (field.type === 'Lookup Relationship' || field.type === 'Master-Detail Relationship') {
                                let fieldRefObj = field.currentMeta.connectedObject;
                                if (fieldRefObj.indexOf('User') !== -1 || fieldRefObj.indexOf('Individual') !== -1) {
                                }
                                else {
                                    if (fieldRefObj.indexOf('(') !== -1 || fieldRefObj.indexOf('(') !== -1) {
                                        fieldRefObj = fieldRefObj.replace('(', '');
                                        fieldRefObj = fieldRefObj.replace(')', '');
                                        if (fieldRefObj !== destObjName) {
                                            fieldRefObjList.push(fieldRefObj);
                                        }
                                    }
                                }
                            }
                        })
                        myObjMap.set(destObjName, fieldRefObjList);
                    })

                })

                this.objectRelationshipData = [];
                const listOfObj = Array.from(myObjMap.keys());
                myObjMap.forEach((value, key) => {
                    let newObj = value.filter(obj => !listOfObj.includes(obj))
                    if (newObj.length > 0 && key !== 'User' && key !== 'Address') {
                        const value = `Review these Target Objects (${key}) for Mandatory Lookups & other MD Objects which are not mapped with any Source. Consider mapping these or establish new relationships while migrating the data`;
                        const objRecord = { objectName: key, value }
                        this.objectRelationshipData.push(objRecord);
                    }
                })
            })
    }

    /**
     * Adjust children list from Apex wrapper to _children list expected by lightning-tree-grid
     */
    adjustTreeGridChildren(datalist) {
        if (datalist && Array.isArray(datalist)) {
            let self = this;
            datalist.forEach(function (row) {
                if (row.hasOwnProperty('children') && Array.isArray(row.children) && row.children.length > 0) {
                    row['_children'] = self.adjustTreeGridChildren(JSON.parse(JSON.stringify(row.children)));
                }
                delete row.children;
            });
        }
        return datalist;
    }

    /**
     * Navigate to Salesforce Record
     */
    navigateToRecord(event) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: event.target.getAttribute("data-record-id"),
                actionName: 'view'
            }
        });
    }

    goToMapping() {

        getNamespaceUnderscore().then(namespaceUnderscoreResult => {
            let apiNamevalue = namespaceUnderscoreResult + "Assessments";

            getPageStateNamespace().then(result => {
                let pagereference = {
                    type: 'standard__navItemPage',
                    attributes: {
                        apiName: apiNamevalue
                    },
                    state: {}
                };

                let recordIdprop = result + "Id";
                pagereference.state[recordIdprop] = this.recordId;
                this[NavigationMixin.Navigate](pagereference);
            })
                .catch(error => {
                    this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#goToMapping');
                });
        })
            .catch(error => {
                this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#goToMapping');
            });;
    }

    /**
     * Subscribe to Assessment ChangeEvent
     */
    handleSubscribe() {
        // Callback invoked whenever a new event message is received
        const recordId = this.recordId;
        const messageCallback = (response) => {
            //If changed Assessment is this one, update status
            if (response &&
                response.data.payload &&
                response.data.payload.ChangeEventHeader.recordIds &&
                response.data.payload.ChangeEventHeader.recordIds.includes(recordId)) {

                if (response.data.payload[STATUS_FIELD.fieldApiName] === ASSESSMENT_STATUS_MAPPING) {
                    this.goToMapping();
                } else if (response.data.payload[STATUS_FIELD.fieldApiName] === ASSESSMENT_STATUS_REVIEW) {
                    refreshApex(this.reportStructureMap);
                    refreshApex(this.assessment);
                    this.resultsLoaded = false;
                    this.reportSections = [];
                    this.connectedCallback();
                } else if (!this.isPdfGenerationComplete && (response.data.payload[PDF_GENERATION_COMPLETE_FIELD.fieldApiName] || response.data.payload[RS_PDF_GENERATION_COMPLETE_FIELD.fieldApiName])) {
                    //Update the Download PDF button or show notification that PDF Generation is complete to user
                    this.handleDownloadButtonStatus();
                }
            }
        };

        // Invoke subscribe method of empApi. Pass reference to messageCallback
        subscribe(this.channelName, -1, messageCallback);
    }

    /**
     * empApi Error Listener
     */
    registerErrorListener() {
        // Invoke onError empApi method
        onError(error => {
            console.log('Received error from server: ', JSON.stringify(error));
        });
    }

    /**
     * Handle CDC Event when PDF Generation Complete Checkbox is ticked TRUE
     */
    handleDownloadButtonStatus() {
        this.template.querySelector('c-assessment-results-header').updateDownloadButtonStatus();
    }

    /**
     * Handle the clicking of the Report Summary download button by clearing this.pdfMode and setting it to summary
     */
    handleReportSummaryDownload() {
        this.pdfMode = '';
        this.pdfMode = 'summary';
        var headerComponent = this.template.querySelector('c-assessment-results-header');
        headerComponent.pdfMode = this.pdfMode;
        headerComponent.downloadPdf();
    }

    /** Welcome Section Event Handler **/
    showreport() {
        this.activeSectionNames = [];
        this.activeSectionNames.push(...this.sectionNames.map(obj => obj));
        this.activeSectionNames.shift(); // deactivate Welcome Section
        this.activeSectionNamesTop = [];
        this.activeSectionNamesTop.push(...this.sectionNames.map(obj => obj));
        this.activeSectionNamesTop.push("fullReport");
        this.activeSectionNamesTop.shift();

    }

    showwelcome() {
        if (this.sectionNames) {
            this.activeSectionNamesTop = this.sectionNames[0];
        }
    }

    /**
     * Simple UUIDV4 function to uniquely identify this component instance
     */
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    get hasPreSalesAssessmentResults() {
        return this.preSalesItems && this.preSalesItems.length > 0;
    }

    get hasObjectRelationshipResults() {
        return this.objectRelationshipData && this.objectRelationshipData.length > 0;
    }
    getUnmappedRequiredFields() {
        getUnmappedRequiredFields({ assessmentId: this.recordId })
            .then(result => {
                try {
                    this.unmappedFields_Required = result;
                } catch (e) {
                    console.log(e);
                }

                this.resultsLoaded = true;
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#getUnmappedRequiredFields');
            });
    }

    getmisMatchedDataTpyeFields() {
        getDataTypeMisMatchedFields({ assessmentId: this.recordId })
            .then(result => {
                try {
                    this.misMatchedDataTypeFields = result;
                } catch (e) {
                    console.log(e);
                }

                this.resultsLoaded = true;
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.recordId, 'assessmentResults#getmisMatchedDataTpyeFields');
            });
    }
}