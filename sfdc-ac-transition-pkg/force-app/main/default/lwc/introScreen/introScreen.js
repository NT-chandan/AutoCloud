import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import { SystemLoggerService } from 'c/systemLoggerService';

//Apex Classes
import getOrgAssessments from '@salesforce/apex/AssessmentService.getOrgAssessments';
import clone from '@salesforce/apex/AssessmentService.cloneAssessment';
import deleteAssessment from '@salesforce/apex/AssessmentService.deleteAssessment';
import deleteAssessments from '@salesforce/apex/AssessmentService.deleteAssessments';
import updateAssessmentDescription from '@salesforce/apex/AssessmentService.updateAssessmentDescription';
import getOrgType from '@salesforce/apex/AssessmentService.isInSandbox';
import getMapping from '@salesforce/apex/MappingService.getObjectMappingForAssessment';
import getFSCBatchSize from '@salesforce/apex/MappingService.getSchemaBatchCount';
import getFSCDef from '@salesforce/apex/MappingService.getFSCSchema';
import getAppStatus from '@salesforce/apex/AssessmentService.checkConnectedAppStatus';
import getPageStateNamespace from '@salesforce/apex/Utilities.getPageStateNamespace';
import getAssessmentCpuWarning from '@salesforce/apex/AssessmentService.getAssessmentCpuWarning'
import exportMapping from '@salesforce/apex/AssessmentService.exportAssessment';
import importFile from '@salesforce/apex/AssessmentService.createAssessmentFromFile';
import getMissingFileId from '@salesforce/apex/AssessmentService.getMissingMetadataFile';
import checkPackageVersion from '@salesforce/apex/AssessmentService.checkPackageVersionStatus';

//Labels
import UIAssessmentTitle from '@salesforce/label/c.UIAssessmentTitle';
import UIIntroTableActionText from '@salesforce/label/c.UIIntroTableActionText';
import UIIntroTableActionClone from '@salesforce/label/c.UIIntroTableActionClone';
import UIIntroTableActionDownload from '@salesforce/label/c.UIIntroTableActionDownload';
import UIIntroTableActionDelete from '@salesforce/label/c.UIIntroTableActionDelete';
import UIIntroTableHeaderName from '@salesforce/label/c.UIIntroTableHeaderName';
import UIIntroTableHeaderDate from '@salesforce/label/c.UIIntroTableHeaderDate';
import UIIntroTableHeaderStatus from '@salesforce/label/c.UIIntroTableHeaderStatus';
import UIIntroTableHeaderDescription from '@salesforce/label/c.UIIntroTableHeaderDescription';
import UIIntroTableHeaderCreatedBy from '@salesforce/label/c.UIIntroTableHeaderCreatedBy';
import UIIntroTableHeaderLastModified from '@salesforce/label/c.UIIntroTableHeaderLastModified';
import UIDeleteSelectedRows from '@salesforce/label/c.UIDeleteSelectedRows';
import UINewAssessmentButtonText from '@salesforce/label/c.UINewAssessmentButtonText';
import UINewAssessmentFromFileButtonText from '@salesforce/label/c.UINewAssessmentFromFileButtonText';
import UISandboxDisclaimer from '@salesforce/label/c.AssessmentSandboxDisclaimer';
import UIConnectedAppError from '@salesforce/label/c.UIConnectedAppError';
import AssessmentIntroTitle from '@salesforce/label/c.AssessmentIntroTitle';
import AssessmentIntroDesc from '@salesforce/label/c.AssessmentIntroDesc';
import AssessmentIntroDesc2 from '@salesforce/label/c.AssessmentIntroDesc2';
import AssessmentStatusMapping from '@salesforce/label/c.AssessmentStatusMapping';
import AssessmentProgressStep1Name from '@salesforce/label/c.AssessmentProgressStep1Name';
import AssessmentProgressStep1Desc from '@salesforce/label/c.AssessmentProgressStep1Desc';
import AssessmentProgressStep2Name from '@salesforce/label/c.AssessmentProgressStep2Name';
import AssessmentProgressStep2Desc from '@salesforce/label/c.AssessmentProgressStep2Desc';
import AssessmentProgressStep3Name from '@salesforce/label/c.AssessmentProgressStep3Name';
import AssessmentProgressStep3Desc from '@salesforce/label/c.AssessmentProgressStep3Desc';
import RecCpuLimitExceptionWarningOrg from '@salesforce/label/c.RecCpuLimitExceptionWarningOrg';
import RecCpuLimitExceptionWarning from '@salesforce/label/c.RecCpuLimitExceptionWarning';

import ToastExportInfo from '@salesforce/label/c.ToastExportInfo';
import ToastImportErrorExtension from '@salesforce/label/c.ToastImportErrorExtension';
import ToastImportErrorGeneral from '@salesforce/label/c.ToastImportErrorGeneral';

import UIImportMissingMetaWarning from '@salesforce/label/c.UIImportMissingMetaWarning';
import UIImportMissingMetaWarning2 from '@salesforce/label/c.UIImportMissingMetaWarning2';
import UIImportMissingMetaWarning3 from '@salesforce/label/c.UIImportMissingMetaWarning3';

import UIUpdateAvailable from '@salesforce/label/c.UIUpdateAvailable';
import UIUpdateAvailable2 from '@salesforce/label/c.UIUpdateAvailable2';
import UIUnsupportedPackage from '@salesforce/label/c.UIUnsupportedPackage';
import UIUnsupportedPackage2 from '@salesforce/label/c.UIUnsupportedPackage2';

export default class IntroScreen extends NavigationMixin(LightningElement) {
    @api tabName;
    currentPageReference;
    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        this.currentPageReference = currentPageReference;
        if (this.connected) {
            // We need to have the currentPageReference, and to be connected before
            // we can use NavigationMixin
            let recordIdprop = "";
            getPageStateNamespace().then(result => {
                recordIdprop = result + "Id";
                if (this.currentPageReference && this.currentPageReference.state && this.currentPageReference.state[recordIdprop]) {
                    // this.resumeClicked({detail: {assessmentId: this.currentPageReference.state[recordIdprop], assessmentStatus: 'Mapping'} });
                    this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.currentPageReference.state[recordIdprop] }));
                }
            })
                .catch(error => {
                    console.log(error);
                    this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#setCurrentPageReference');
                });
            this.assessmentCpuCheck();
        } else {
            // NavigationMixin doesn't work before connectedCallback, so if we have 
            // the currentPageReference, but haven't connected yet, queue it up
            this.redirectToMapping = true;
        }
    }

    @track sidebarClass = 'sideComponent';

    @track helpClass = 'sidebarItem'
    @track configClass = 'sidebarItem';

    @track mainClass = 'mainComponent';

    @track showAssessment;
    @track showAssessmentTable;
    @track assessmentList;
    @track assessmentId;
    @track showNewButton;
    @track showDeleteButton = false;

    @track showAppError = false;
    @track isSandbox = false;
    @track orgCpuTimeoutWarning = false;
    @track assessmentCpuTimeoutWarning = false;

    @api isLoading = false;

    @track schemaBatchSize;

    @track fscSchema = [];
    @track fscDefs = {};

    @track mappingData = {};

    @track missingFileId;

    @track packageUpdateLink;
    @track packageUpdateSeverity;

    systemLogger;
    assessmentResponse;
    redirectToMapping = false;
    label = {
        UIIntroTableActionText,
        UIIntroTableActionClone,
        UIIntroTableActionDownload,
        UIIntroTableActionDelete,
        UIIntroTableHeaderDate,
        UIIntroTableHeaderName,
        UIIntroTableHeaderStatus,
        UIIntroTableHeaderDescription,
        UIIntroTableHeaderCreatedBy,
        UIIntroTableHeaderLastModified,
        UINewAssessmentButtonText,
        UINewAssessmentFromFileButtonText,
        UIImportMissingMetaWarning,
        UIImportMissingMetaWarning2,
        UIImportMissingMetaWarning3,
        UIUpdateAvailable,
        UIUpdateAvailable2,
        UIUnsupportedPackage,
        UIUnsupportedPackage2,
        AssessmentIntroTitle,
        AssessmentIntroDesc,
        AssessmentIntroDesc2,
        AssessmentStatusMapping,
        UISandboxDisclaimer,
        UIConnectedAppError,
        UIDeleteSelectedRows,
        AssessmentProgressStep1Name,
        AssessmentProgressStep1Desc,
        AssessmentProgressStep2Name,
        AssessmentProgressStep2Desc,
        AssessmentProgressStep3Name,
        AssessmentProgressStep3Desc,
        RecCpuLimitExceptionWarningOrg,
        RecCpuLimitExceptionWarning,
        ToastExportInfo,
        ToastImportErrorExtension,
        ToastImportErrorGeneral
    };

    @track steps = [{ label: this.label.AssessmentProgressStep1Name, description: this.label.AssessmentProgressStep1Desc, value: "1" }, { label: this.label.AssessmentProgressStep2Name, description: this.label.AssessmentProgressStep2Desc, value: "2" }, { label: this.label.AssessmentProgressStep3Name, description: this.label.AssessmentProgressStep3Desc, value: "3" }];
    @track currentStep = "1";

    columns = [
        {
            label: this.label.UIIntroTableHeaderName, type: 'link', hideDefaultActions: true
            , sortable: true
            , typeAttributes: {
                assessmentName: { fieldName: 'Name' },
                assessmentId: { fieldName: 'AssessmentId' },
                assessmentStatus: { fieldName: 'Status' },
                inProgressAssessment: { fieldName: 'InProgress' }
            }
        },
        {
            label: this.label.UIIntroTableHeaderDescription, type: 'text', fieldName: 'Description', wrapText: true, hideDefaultActions: true, editable: true
            , sortable: true
        },
        {
            label: this.label.UIIntroTableHeaderDate, type: 'date', fieldName: 'CreatedDate', wrapText: true, hideDefaultActions: true
            , sortable: true
        },
        {
            label: this.label.UIIntroTableHeaderStatus, type: 'text', fieldName: 'Status', wrapText: true, hideDefaultActions: true
            , sortable: true
        },
        {
            label: this.label.UIIntroTableHeaderCreatedBy, type: 'url', fieldName: 'CreatedByLink', wrapText: true, hideDefaultActions: true, typeAttributes: {
                label: { fieldName: 'CreatedByName' },
                target: '_blank'
            }
        },
        {
            label: this.label.UIIntroTableHeaderLastModified, type: 'url', fieldName: 'LastModifiedByLink', wrapText: true, hideDefaultActions: true, typeAttributes: {
                label: { fieldName: 'LastModifiedByName' },
                target: '_blank'
            }
        },
        {
            type: 'action',
            typeAttributes: {
                rowActions: [
                    { label: this.label.UIIntroTableActionClone, name: 'clone' },
                    { label: this.label.UIIntroTableActionDownload, name: 'download' },
                    { label: 'Delete', name: 'delete' }
                ]
            }
        }
    ];

    draftDescriptions = [];
    selectedRows = [];

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    @wire(getOrgAssessments, {})
    processAssessmentList(response) {
        this.isLoading = true;
        if (response) {
            this.assessmentResponse = response;
            if (this.assessmentResponse.data) {
                this.assessmentList = JSON.parse(JSON.stringify(this.assessmentResponse.data));
                // if any assessmentList record contains a record which has experienced a CPUTimeoutWarning
                this.orgCpuTimeoutWarning = this.setOrgCpuWarning(this.assessmentList);
                this.resetPage();
            }
        }
        this.isLoading = false;
    }

    setOrgCpuWarning(assessments) {
        let stopValue = false;
        assessments.forEach(assessRec => {
            if (stopValue != true && assessRec.AssessmentCpuWarning === true) {
                stopValue = true;
            }
            else { return stopValue; }
        });
        return stopValue;
    }

    @wire(getOrgType, {})
    orgType({ error, data }) {
        this.isSandbox = data;
    }

    @wire(getFSCBatchSize, {})
    fscBatchSize({ error, data }) {
        this.schemaBatchSize = data;
    }

    updateDescription(evt) {
        this.isLoading = true;
        let values = evt.detail.draftValues;

        let assessmentIds = [];
        let descriptions = [];
        for (let index = 0; index < values.length; index++) {
            assessmentIds.push(values[index].AssessmentId);
            descriptions.push(values[index].Description);
            for (let subIndex = 0; subIndex < this.assessmentList.length; subIndex++) {
                if (values[index].AssessmentId === this.assessmentList[subIndex].AssessmentId) {
                    this.assessmentList[subIndex].Description = values[index].Description;
                    break;
                }
            }
        }

        updateAssessmentDescription({ assessmentIds: assessmentIds, descriptions: descriptions })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#updateDescription');
                this.error = error;
            });
        this.draftDescriptions = [];
        this.isLoading = false;
    }

    connectedCallback() {
        checkPackageVersion()
            .then(result => {
                if (result) {
                    var parsedPackageResult = JSON.parse(result);
                    this.packageUpdateLink = parsedPackageResult.url;
                    this.packageUpdateSeverity = parsedPackageResult.severity;
                }
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#connectedCallback');
            });

        getAppStatus()
            .then(result => {
                this.showAppError = (result) ? true : false;
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#connectedCallback');
            });
        refreshApex(this.assessmentResponse);
        // If the CurrentPageReference returned before this component was connected,
        // we can use NavigationMixin to redirect to mapping for the passed in assessmentId
        if (this.redirectToMapping) {
            let recordIdprop = "";
            getPageStateNamespace().then(result => {
                recordIdprop = result + "Id";
                if (this.currentPageReference && this.currentPageReference.state && this.currentPageReference[recordIdprop]) {
                    // this.resumeClicked({detail: {assessmentId: this.currentPageReference.state[recordIdprop], assessmentStatus: 'Mapping'} });
                    this.dispatchEvent(new CustomEvent("assessmentcomplete", { detail: this.currentPageReference.state[recordIdprop] }));
                }
            })
                .catch(error => {
                    console.log(error);
                    this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#connectedCallback');
                });
            this.assessmentCpuCheck();
        }
    }

    renderedCallback() { }

    resumeClicked(evt) {
        this.assessmentId = evt.detail.assessmentId;
        var status = evt.detail.assessmentStatus;
        this.currentStep = (status === this.label.AssessmentStatusMapping) ? "3" : "2";
        this.isLoading = true;
        return new Promise(
            (resolve, reject) => {
                setTimeout(() => {
                    this.renderAssessment();
                    resolve();
                }, 500);
            });
    }

    stopLoading() {
        this.isLoading = false;
    }


    renderAssessment() {
        this.isLoading = true;
        this.assessmentCpuCheck();

        getMissingFileId({ assessmentId: this.assessmentId })
            .then(missingFileResult => {
                if (missingFileResult) {
                    this.missingFileId = missingFileResult;
                }
                getMapping({ assessmentId: this.assessmentId, populateSourceDef: false })
                    .then(mapResult => {
                        if (mapResult) {
                            if (!mapResult.additional) {
                                this.additionalMappings = [];
                            }
                            this.mappingData = mapResult;
                        }
                        if (!this.fscSchema || this.fscSchema.length === 0) {
                            //Split per offset
                            const allRetrieves = [];
                            for (let currentOffset = 1; currentOffset <= this.schemaBatchSize; currentOffset++) {
                                allRetrieves.push(getFSCDef({ offSet: currentOffset }))
                            }

                            //Promise All
                            Promise.all(allRetrieves)
                                .then((fscResults) => {
                                    if (fscResults) {
                                        fscResults.forEach(fscResult => {
                                            fscResult.forEach(fscObject => {
                                                const exist = this.fscSchema.some(fsc => fsc.value === fscObject.sourceObject);
                                                if (!exist) {
                                                    this.fscSchema.push({ "label": fscObject.sourceObjectLabel, "value": fscObject.sourceObject, "desc": fscObject.sourceObjectDesc });
                                                    this.fscDefs[fscObject.sourceObject] = fscObject;
                                                    this.fscDefs[fscObject.sourceObject].formattedLabel = fscObject.sourceObjectLabel;
                                                }
                                            });
                                        });
                                    }
                                })
                                .catch((error) => {
                                    console.log(error);
                                    this.isLoading = false;
                                    this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#renderAssessment');
                                })
                                .finally(() => {
                                    this.fscSchema.sort((a, b) => a.label.localeCompare(b.label));
                                    this.showAssessment = true;
                                    this.showAssessmentTable = false;
                                    this.showNewButton = false;
                                    this.isLoading = false;
                                })
                        } else {
                            this.showAssessment = true;
                            //this.assessmentCpuCheck();
                            this.showAssessmentTable = false;
                            this.showNewButton = false;
                            this.isLoading = false;
                        }
                    })
                    .catch(error => {
                        console.log(error);
                        this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#renderAssessment2');
                    });
            })
            .catch(error => {
                console.log(error);
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#renderAssessment2');
            });
    }

    // imperative Apex method only after this.assessmentId is populated - may not be needed
    assessmentCpuCheck() {
        getAssessmentCpuWarning({ assessmentId: this.assessmentId })
            .then((result) => {
                this.assessmentCpuTimeoutWarning = result;
                this.error = undefined;
            })
            .catch((error) => {
                this.error = error;
            });
    }

    newAssessment(evt) {
        this.mappingData = { "recommended": [], "additional": [] };
        if (!this.fscSchema || this.fscSchema.length === 0) {
            this.isLoading = true;
            console.log('new Assessement');
            //Split per offset
            const allRetrieves = [];
            for (let currentOffset = 1; currentOffset <= this.schemaBatchSize; currentOffset++) {
                allRetrieves.push(getFSCDef({ offSet: currentOffset }))
            }

            //Promise All
            Promise.all(allRetrieves)
                .then((fscResults) => {
                    if (fscResults) {
                        fscResults.forEach(fscResult => {
                            fscResult.forEach(fscObject => {
                                const exist = this.fscSchema.some(fsc => fsc.value === fscObject.sourceObject);
                                if (!exist) {
                                    this.fscSchema.push({ "label": fscObject.sourceObjectLabel, "value": fscObject.sourceObject, "desc": fscObject.sourceObjectDesc });
                                    this.fscDefs[fscObject.sourceObject] = fscObject;
                                    this.fscDefs[fscObject.sourceObject].formattedLabel = fscObject.sourceObjectLabel;
                                }
                            });
                        });
                    }
                })
                .catch((error) => {
                    this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#newAssessment');
                    this.isLoading = false;
                })
                .finally(() => {
                    this.fscSchema.sort((a, b) => a.label.localeCompare(b.label));
                    this.currentStep = "1";
                    this.assessmentId = null;
                    this.missingFileId = null;
                    this.showAssessment = true;
                    this.showAssessmentTable = false;
                    this.showNewButton = false;
                    this.isLoading = false;
                })
        } else {
            this.currentStep = "1";
            this.assessmentId = null;
            this.missingFileId = null;
            this.showAssessment = true;
            this.showAssessmentTable = false;
            this.showNewButton = false;
        }
    }

    reloadPage() {
        refreshApex(this.assessmentResponse);
        this.resetPage();
    }

    goToAssessment() {
        this.currentStep = "2";
    }

    goBackToVerticals() {
        this.currentStep = "1";
    }

    goToMapping(e) {
        this.assessmentId = e.detail;
        this.currentStep = "3";
    }

    goBackToAssessment(e) {
        this.currentStep = "2";
        this.showAssessment = true;
        this.showAssessmentTable = false;
        this.showNewButton = false;
    }

    getFSCDefinitions() {
        //Split per offset
        const allRetrieves = [];
        for (let currentOffset = 1; currentOffset <= this.schemaBatchSize; currentOffset++) {
            allRetrieves.push(getFSCDef({ offSet: currentOffset }))
        }

        Promise.all(allRetrieves)
            .then((fscResults) => {
                if (fscResults) {
                    fscResults.forEach(fscResult => {
                        fscResult.forEach(fscObject => {
                            const exist = this.fscSchema.some(fsc => fsc.value === fscObject.sourceObject);
                            if (!exist) {
                                this.fscSchema.push({ "label": fscObject.sourceObjectLabel, "value": fscObject.sourceObject, "desc": fscObject.sourceObjectDesc });
                                this.fscDefs[fscObject.sourceObject] = fscObject;
                                this.fscDefs[fscObject.sourceObject].formattedLabel = fscObject.sourceObjectLabel;
                            }
                        });
                    });
                }
            })
            .catch((error) => {
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#getFSCDefinitions');
                this.isLoading = false;
            })
            .finally(() => {
                this.fscSchema.sort((a, b) => a.label.localeCompare(b.label));
                this.showAssessment = true;
                this.showAssessmentTable = false;
                this.showNewButton = false;
                this.isLoading = false;
            })
    }

    cloneClicked(row) {
        this.isLoading = true;
        clone({ assessmentId: row.AssessmentId })
            .then(cloneResult => {
                try {
                    if (cloneResult) {
                        this.assessmentId = cloneResult;
                        this.missingFileId = null;
                        this.currentStep = "2";
                        this.isLoading = true;
                        return new Promise(
                            (resolve, reject) => {
                                setTimeout(() => {
                                    this.renderAssessment();
                                    resolve();
                                }, 500);
                            })
                    } else {
                        this.isLoading = false;
                    }
                } catch (e) {
                    this.systemLogger.log('Error', e, this.assessmentId, 'introScreen#cloneClicked');
                }
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#cloneClicked2');
                this.isLoading = false;
            });
    }

    delete(row) {
        this.isLoading = true;
        deleteAssessment({ assessmentId: row.AssessmentId })
            .then(cloneResult => {
                refreshApex(this.assessmentResponse);
                this.isLoading = false;
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#delete');
                this.isLoading = false;
            });
    }

    deleteSelectedRows() {
        this.isLoading = true;
        let assessmentIds = [];
        for (let index = 0; index < this.selectedRows.length; index++) {
            assessmentIds.push(this.selectedRows[index].AssessmentId);
        }

        this.isLoading = true;
        this.selectedRows = [];
        this.showDeleteButton = false;
        deleteAssessments({ assessmentIds: assessmentIds })
            .then(cloneResult => {
                refreshApex(this.assessmentResponse);
                this.isLoading = false;
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentId, 'introScreen#deleteSelectedRows')
                this.isLoading = false;
            });
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        switch (actionName) {
            case 'delete':
                this.delete(row);
                break;
            case 'clone':
                this.cloneClicked(row);
                break;
            case 'download':
                this.downloadClicked(row);
                break;
            default:
        }
    }

    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
        this.showDeleteButton = this.selectedRows.length > 0;
    }

    resetPage() {
        this.showAssessmentTable = this.assessmentList.length > 0;
        this.showAssessment = false;
        this.missingFileId = null;
        this.assessmentId = null;
        this.showNewButton = true;
    }

    get isStep1() {
        return this.currentStep == "1";
    }

    get isStep2() {
        return this.currentStep == "2";
    }

    get isQuestionComponent() {
        return this.isStep1 || this.isStep2;
    }

    get isStep3() {
        return this.currentStep == "3";
    }

    get cardTitle() {
        return (this.showNewButton) ? this.label.AssessmentIntroTitle : '';
    }

    /** Help Functions **/
    collapseHelp() {
        this.helpClass = 'sidebarItem itemCollapsed';
        if (this.configClass === 'sidebarItem itemCollapsed') {
            this.sidebarClass = 'sideComponent collapsed';
            this.mainClass = 'mainComponent expanded';
        }
    }

    expandHelp() {
        this.helpClass = 'sidebarItem';
        this.sidebarClass = 'sideComponent';
        this.mainClass = 'mainComponent';
    }

    collapseConfig() {
        this.configClass = 'sidebarItem itemCollapsed';
        if (this.helpClass === 'sidebarItem itemCollapsed') {
            this.sidebarClass = 'sideComponent collapsed';
            this.mainClass = 'mainComponent expanded';
        }
    }

    expandConfig() {
        this.configClass = 'sidebarItem';
        this.sidebarClass = 'sideComponent';
        this.mainClass = 'mainComponent';
    }

    /** New Assessment from File Navigation Functions **/
    navigateNewFromFile() {
        this.template.querySelector('input').click();
    }

    downloadClicked(row) {
        this.isLoading = true;
        exportMapping({ "assessmentId": row.AssessmentId })
            .then(result => {
                if (result === 'noMapping') {
                    //If no mapping exists, display info toast to user
                    const evt = new ShowToastEvent({
                        message: this.label.ToastExportInfo,
                        variant: 'info',
                    });
                    this.dispatchEvent(evt);
                } else {
                    //Download file
                    this.downloadExportFile(result);
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.log(error);
                this.isLoading = false;
            });
    }

    downloadExportFile(contentDocumentUrl) {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: contentDocumentUrl
            }
        })
    }

    handleImportFile(e) {
        var file = e.currentTarget.files[0];
        if (file.type === 'application/json') {
            this.isLoading = true;
            this.processImportFile(file);
        } else {
            const evt = new ShowToastEvent({
                message: this.label.ToastImportErrorExtension,
                variant: 'error',
            });
            this.dispatchEvent(evt);
        }
    }

    async processImportFile(file) {
        var data = await file.text();
        importFile({ fileData: data })
            .then(createResult => {
                try {
                    if (createResult) {
                        this.assessmentId = createResult;
                        this.currentStep = "2";
                        this.isLoading = true;
                        return new Promise(
                            (resolve, reject) => {
                                setTimeout(() => {
                                    this.renderAssessment();
                                    resolve();
                                }, 500);
                            })
                    } else {
                        this.isLoading = false;
                    }
                } catch (e) {
                    this.isLoading = false;
                }
            })
            .catch(error => {
                const evt = new ShowToastEvent({
                    message: this.label.ToastImportErrorGeneral,
                    variant: 'error',
                });
                this.dispatchEvent(evt);
                this.isLoading = false;
            });
    }

    onMissingFileClick() {
        this.navigateToFilePreview(this.missingFileId);
    }

    navigateToFilePreview(contentDocumentId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: contentDocumentId
            }
        })
    }

    installUpdate() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: this.packageUpdateLink
            }
        })
    }

    get updateAvailable() {
        return this.packageUpdateLink && this.packageUpdateSeverity === 'low';
    }

    get unsupportedPackage() {
        return this.packageUpdateLink && this.packageUpdateSeverity === 'high';
    }
}