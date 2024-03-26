import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { subscribe, unsubscribe, onError, setDebugFlag, isEmpEnabled } from 'lightning/empApi';
import {SystemLoggerService} from 'c/systemLoggerService';

import ID_FIELD from '@salesforce/schema/Assessment__c.Id';
import getDeployments from '@salesforce/apex/PackageDeploymentController.getDeploymentInfo';
import deployPackage from '@salesforce/apex/PackageDeploymentController.deployPackage';
import getNamespacedObject from '@salesforce/apex/Utilities.getNamespacedObject';
import UIDeploymentTableHeaderDescription from '@salesforce/label/c.UIDeploymentTableHeaderDescription';
import UIDeploymentTableHeaderAssessment from '@salesforce/label/c.UIDeploymentTableHeaderAssessment';
import UIDeploymentTableHeaderDeployment from '@salesforce/label/c.UIDeploymentTableHeaderDeployment';
import UIDeploymentTableHeaderDate from '@salesforce/label/c.UIDeploymentTableHeaderDate';
import UIDeploymentTableButtonDeploy from '@salesforce/label/c.UIDeploymentTableButtonDeploy';
import UIDeploymentTableDescriptionText from '@salesforce/label/c.UIDeploymentTableDescriptionText';
import UIDeploymentTableHeader from '@salesforce/label/c.UIDeploymentTableHeader';
import UIDeploymentTableHeaderStartDate from '@salesforce/label/c.UIDeploymentTableHeaderStartDate'
import UIDeploymentTableHeaderEndDate from '@salesforce/label/c.UIDeploymentTableHeaderEndDate'
import UIDeploymentTableHeaderInProgress from '@salesforce/label/c.UIDeploymentTableHeaderInProgress';
import UIDeploymentTableHeaderError from '@salesforce/label/c.UIDeploymentTableHeaderError';
import UIDeploymentTableHeaderAvailable from '@salesforce/label/c.UIDeploymentTableHeaderAvailable';
import UIDeploymentTableHeaderDeployed from '@salesforce/label/c.UIDeploymentTableHeaderDeployed';
import UIDeploymentTableAvailableDescriptionText from '@salesforce/label/c.UIDeploymentTableAvailableDescriptionText';
import UIDeploymentTableErrorDescriptionText from '@salesforce/label/c.UIDeploymentTableErrorDescriptionText';
import UIDeploymentTableDeployedDescriptionText from '@salesforce/label/c.UIDeploymentTableDeployedDescriptionText';
import UIDeploymentTableInProgressDescriptionText from '@salesforce/label/c.UIDeploymentTableInProgressDescriptionText';
import UIPackageTableErrorHeader from '@salesforce/label/c.UIPackageTableErrorHeader';
import UIDeploymentTableLoadingText from '@salesforce/label/c.UIDeploymentTableLoadingText';
import UIDeploymentTableHeaderDetails from '@salesforce/label/c.UIDeploymentTableHeaderDetails';
import UIDeploymentTableHeaderComponentType from '@salesforce/label/c.UIDeploymentTableHeaderComponentType';
import UIPackageTableHeaderName from '@salesforce/label/c.UIPackageTableHeaderName';
import UIDeploymentTableTitleFailing from '@salesforce/label/c.UIDeploymentTableTitleFailing';
import UIDeploymentTableTitleSuccess from '@salesforce/label/c.UIDeploymentTableTitleSuccess';
import UIDeploymentTableHeaderUpload from '@salesforce/label/c.UIDeploymentTableHeaderUpload';
import UIDeploymentTableDescriptionUpload from '@salesforce/label/c.UIDeploymentTableDescriptionUpload';

const ASSESSMENT_FIELDS = [ID_FIELD];

export default class DeploymentScreen extends LightningElement {
    @api recordId;

    @track isLoading = true;
    @track showDeployedTable;
    @track showPendingTable;
    @track showDeployableTable;
    @track showErrorTable;
    @track buttonActive = false;
    @track deployedPackageList;
    @track pendingPackageList;
    @track deployablePackageList;
    @track errorPackageList;
    @track recordIds = [];
    subscribed = false;
    systemLogger;

    label = {
        UIDeploymentTableHeaderDescription,
        UIDeploymentTableHeaderAssessment,
        UIDeploymentTableHeaderDeployment,
        UIDeploymentTableHeaderDate,
        UIDeploymentTableButtonDeploy,
        UIDeploymentTableDescriptionText,
        UIDeploymentTableHeader,
        UIDeploymentTableHeaderStartDate,
        UIDeploymentTableHeaderEndDate,
        UIDeploymentTableHeaderInProgress,
        UIDeploymentTableHeaderError,
        UIDeploymentTableHeaderAvailable,
        UIDeploymentTableHeaderDeployed,
        UIDeploymentTableAvailableDescriptionText,
        UIDeploymentTableErrorDescriptionText,
        UIDeploymentTableDeployedDescriptionText,
        UIDeploymentTableInProgressDescriptionText,
        UIPackageTableErrorHeader,
        UIDeploymentTableLoadingText,
        UIDeploymentTableHeaderDetails,
        UIDeploymentTableHeaderComponentType, 
        UIPackageTableHeaderName,
        UIDeploymentTableTitleFailing,
        UIDeploymentTableTitleSuccess,
        UIDeploymentTableHeaderUpload,
        UIDeploymentTableDescriptionUpload
    };
    
    deployTableColumns = [
        {label: this.label.UIDeploymentTableHeaderAssessment, fieldName: 'AssessmentUrl', type: 'url', typeAttributes: {label: {fieldName: 'AssessmentName', target: '_self'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDescription, fieldName: 'Description', wrapText: true, hideDefaultActions: true}, 
        {label: this.label.UIDeploymentTableHeaderDeployment, fieldName: 'DocumentUrl', type: 'url', typeAttributes: {label: {fieldName: 'Name', target: '_blank'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDate, fieldName: 'PackageCreatedDate', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {type: "button", typeAttributes: {  
            label: this.label.UIDeploymentTableButtonDeploy,  
            name: this.label.UIDeploymentTableButtonDeploy,  
            title: this.label.UIDeploymentTableButtonDeploy,  
            disabled: false,  
            value: 'deploy',  
            variant: 'base'
        }}
    ];

    pendingTableColumns = [
        {label: this.label.UIDeploymentTableHeaderAssessment, fieldName: 'AssessmentUrl', type: 'url', typeAttributes: {label: {fieldName: 'AssessmentName', target: '_self'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDescription, fieldName: 'Description', wrapText: true, hideDefaultActions: true}, 
        {label: this.label.UIDeploymentTableHeaderDeployment, fieldName: 'DocumentUrl', type: 'url', typeAttributes: {label: {fieldName: 'Name', target: '_blank'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDate, fieldName: 'PackageCreatedDate', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderStartDate, fieldName: 'DeploymentStarttime', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
    ];


    errorInfoColumns = [
        {label: this.label.UIDeploymentTableHeaderComponentType, fieldName: 'componentType', hideDefaultActions: true, wrapText: true, cellAttributes: {class: 'slds-border_bottom'}},
        {label: this.label.UIPackageTableHeaderName, fieldName: 'fullName', hideDefaultActions: true, wrapText: true, cellAttributes: {class: 'slds-border_bottom'}},
        {label: this.label.UIDeploymentTableHeaderDetails, fieldName: 'problem', hideDefaultActions: true, wrapText: true, cellAttributes: {class: 'slds-border_bottom'}}
    ];
    
    successInfoColumns = [
        {label: this.label.UIDeploymentTableHeaderComponentType, fieldName: 'componentType', hideDefaultActions: true, wrapText: true, cellAttributes: {class: 'slds-border_bottom'}},
        {label: this.label.UIPackageTableHeaderName, fieldName: 'fullName', hideDefaultActions: true, wrapText: true, cellAttributes: {class: 'slds-border_bottom'}}
    ];

    errorTableColumns = [
        {label: this.label.UIDeploymentTableHeaderAssessment, fieldName: 'AssessmentUrl', type: 'url', typeAttributes: {label: {fieldName: 'AssessmentName', target: '_self'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDeployment, fieldName: 'DocumentUrl', type: 'url', typeAttributes: {label: {fieldName: 'Name', target: '_blank'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDate, fieldName: 'PackageCreatedDate', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderEndDate, fieldName: 'DeploymentEndtime', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDetails, type: 'subTable', hideDefaultActions: true, typeAttributes: {
            subTableColumnList: {fieldName: 'TableColumns'},
            subTableDataList: {fieldName: 'TableDetails'},
            subTableTitleList: {fieldName: 'TableTitles'},
            subTableIconList: {fieldName: 'TableIcons'}
        }}
    ];

    deployedTableColumns = [
        {label: this.label.UIDeploymentTableHeaderAssessment, fieldName: 'AssessmentUrl', type: 'url', typeAttributes: {label: {fieldName: 'AssessmentName', target: '_self'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDeployment, fieldName: 'DocumentUrl', type: 'url', typeAttributes: {label: {fieldName: 'Name', target: '_blank'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDate, fieldName: 'PackageCreatedDate', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderStartDate, fieldName: 'DeploymentStarttime', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderEndDate, fieldName: 'DeploymentEndtime', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true},
    ];

    availableTableColumns = [
        {label: this.label.UIDeploymentTableHeaderAssessment, fieldName: 'AssessmentUrl', type: 'url', typeAttributes: {label: {fieldName: 'AssessmentName', target: '_self'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDescription, fieldName: 'Description', wrapText: true, hideDefaultActions: true}, 
        {label: this.label.UIDeploymentTableHeaderDeployment, fieldName: 'DocumentUrl', type: 'url', typeAttributes: {label: {fieldName: 'Name', target: '_blank'}}, hideDefaultActions: true},
        {label: this.label.UIDeploymentTableHeaderDate, fieldName: 'PackageCreatedDate', type: "date", typeAttributes:{month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"}, hideDefaultActions: true}
    ];


    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    @wire(getNamespacedObject, {objectName: 'Assessment'})
    handleNamespace(response) {
        if (response && response.data) {
            this.channelName = '/data/' + response.data + '__ChangeEvent';
        }
    }

    @wire(getRecord, { recordId: '$recordId', fields: ASSESSMENT_FIELDS})
    renderScreen({error, data}) {
        if (data) {
            this.assessment = data;
            this.getDeploymentTable();
        }
        else if(error) {
            this.isLoading = false;
            this.error = error;
        }
    }

    get acceptedFormats() {
        return ['.zip'];
    }
    getDeploymentTable() {
        getDeployments()
        .then(result => {                    
            this.recordIds = result.AssessmentIds;
            this.deployedPackageList = result.DeployedPackages;
            this.pendingPackageList = result.PendingPackages;
            this.deployablePackageList = result.DeployablePackages;
            this.errorPackageList = result.ErrorPackages;
            this.installResult = result.InstallResult;
            this.showDeployedTable = this.deployedPackageList.length > 0;
            this.showPendingTable = this.pendingPackageList.length > 0;
            this.showDeployableTable = this.deployablePackageList.length > 0;
            this.showErrorTable = this.errorPackageList.length > 0;   
            if(this.showErrorTable) {
                this.errorPackageList = JSON.parse(JSON.stringify(this.errorPackageList));
                this.errorPackageList.sort((a, b) => (a.DeploymentEndtime < b.DeploymentEndtime) ? 1 : -1);

                for(let index = 0; index < this.errorPackageList.length; index++) {
                    this.errorPackageList[index].TableColumns = [this.errorInfoColumns, this.successInfoColumns];
                    this.errorPackageList[index].TableDetails = [this.errorPackageList[index].ErrorDetails, this.errorPackageList[index].SuccessDetails];
                    this.errorPackageList[index].TableTitles = [this.label.UIDeploymentTableTitleFailing, this.label.UIDeploymentTableTitleSuccess];
                    this.errorPackageList[index].TableIcons = ['action:close', 'action:approval'];

                }
            }
            if(this.showDeployedTable) {
                this.deployedPackageList = JSON.parse(JSON.stringify(this.deployedPackageList));
                this.deployedPackageList.sort((a, b) => (a.DeploymentEndtime < b.DeploymentEndtime) ? 1 : -1);
            }
            if(this.showDeployableTable) {
                this.deployablePackageList = JSON.parse(JSON.stringify(this.deployablePackageList));
                this.deployablePackageList.sort((a, b) => (a.PackageCreatedDate < b.PackageCreatedDate) ? 1 : -1);
            }
            if(!this.subscribed) {
                this.registerErrorListener();
                this.handleSubscribe();
                this.subscribed = true;
            }
            this.isLoading = false;
        })
        .catch(error => {
            this.systemLogger.log('Error', error, this.recordId, 'deploymentScreen#getDploymentTable');
            this.isLoading = false;
            this.error = error;
        });
    }

    deploySelectedPackage(event){
        if(event.detail.action.value === 'deploy') {
            this.isLoading = true;
            deployPackage({deploymentJSON: JSON.stringify(event.detail.row)})
            .then(result => {
                this.getDeploymentTable();
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.recordId, 'deploySelectedPackage');
                this.isLoading = false;
                this.error = error;
            });
        }
    }

    handleSubscribe() {
        const monitorRecordIds = JSON.parse(JSON.stringify(this.recordIds));
        let self = this;

        const messageCallback = (response) => {
            if(response && response.data.payload && response.data.payload.ChangeEventHeader.recordIds && 
                response.data.payload.ChangeEventHeader.recordIds.some(r => monitorRecordIds.includes(r))
            ){
                this.isLoading = true;
                this.showDeployedTable = false;
                this.showPendingTable = false;
                this.showDeployableTable = false;
                this.showErrorTable = false; 
                this.getDeploymentTable();
            }
        };

        subscribe(this.channelName, -1, messageCallback).then(response => {});
    }

    handleUploadFinished(event) {
        this.isLoading = true;
        this.showDeployedTable = false;
        this.showPendingTable = false;
        this.showDeployableTable = false;
        this.showErrorTable = false; 
        this.getDeploymentTable();
    }
    
    registerErrorListener() {
        onError(error => {});
    }
}