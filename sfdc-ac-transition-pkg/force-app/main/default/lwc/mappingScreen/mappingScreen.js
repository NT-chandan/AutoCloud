import { LightningElement, track, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { SystemLoggerService } from 'c/systemLoggerService';

//Apex Methods
import getObjectMapping from '@salesforce/apex/MappingService.getObjectMappingForAssessment';
import getOrgDef from '@salesforce/apex/MappingService.getOrgDefinition';
import getObjectDef from '@salesforce/apex/MappingService.getInfoForSObject';
import saveMappingFile from '@salesforce/apex/MappingService.saveMapping';
import getDefaultRts from '@salesforce/apex/MappingService.getDefaultRecordTypes';
import getSourceDef from '@salesforce/apex/MappingService.getSourceDef';
import rollbackStatus from '@salesforce/apex/AssessmentService.backToQuestionnaire';
import getFieldMeta from '@salesforce/apex/MappingService.getFieldMetadata';

//Custom Labels
import UISaveButtonText from '@salesforce/label/c.UISaveButtonText';
import UICancelButtonText from '@salesforce/label/c.UICancelButtonText';
import UIPicklistPlaceholderText from '@salesforce/label/c.UIPicklistPlaceholderText';
import UIFinishButtonText from '@salesforce/label/c.UIFinishButtonText';
import UIBackButtonText from '@salesforce/label/c.UIBackButtonText';
import ToastTitleSuccess from '@salesforce/label/c.ToastTitleSuccess';
import ToastTitleSave from '@salesforce/label/c.ToastTitleSave';
import ToastTitleError from '@salesforce/label/c.ToastTitleError';
import ToastMessageMappingSaved from '@salesforce/label/c.ToastMessageMappingSaved';
import ToastMessageAutoMap from '@salesforce/label/c.ToastMessageAutoMap';
import ToastMessageError from '@salesforce/label/c.ToastMessageError';
import ToastMessageAutoMapError from '@salesforce/label/c.ToastMessageAutoMapError';
import ToastMessageAutoMapNoneTitle from '@salesforce/label/c.ToastMessageAutoMapNoneTitle';
import ToastMessageAutoMapNoneDesc from '@salesforce/label/c.ToastMessageAutoMapNoneDesc';

import MappingAdditionalDesc from '@salesforce/label/c.MappingAdditionalDesc';
import MappingAdditionalTitle from '@salesforce/label/c.MappingAdditionalTitle';
import MappingDetailsTitle from '@salesforce/label/c.MappingDetailsTitle';
import MappingFieldAdd from '@salesforce/label/c.MappingFieldAdd';
import MappingFieldDest from '@salesforce/label/c.MappingFieldDest';
import MappingFieldSource from '@salesforce/label/c.MappingFieldSource';
import MappingFieldTitle from '@salesforce/label/c.MappingFieldTitle';
import MappingIntro from '@salesforce/label/c.MappingIntro';
import MappingObjectAdd from '@salesforce/label/c.MappingObjectAdd';
import MappingObjectDest from '@salesforce/label/c.MappingObjectDest';
import MappingObjectRemove from '@salesforce/label/c.MappingObjectRemove';
import MappingObjectSource from '@salesforce/label/c.MappingObjectSource';
import MappingRecommendedDesc from '@salesforce/label/c.MappingRecommendedDesc';
import MappingRecommendedTitle from '@salesforce/label/c.MappingRecommendedTitle';
import MappingRTAdd from '@salesforce/label/c.MappingRTAdd';
import MappingRTDest from '@salesforce/label/c.MappingRTDest';
import MappingRTSource from '@salesforce/label/c.MappingRTSource';
import MappingRTTitle from '@salesforce/label/c.MappingRTTitle';
import ComboboxNoneValue from '@salesforce/label/c.ComboboxNoneValue';
import MappingChildTitle from '@salesforce/label/c.MappingChildTitle';
import UIDualboxAvailable from '@salesforce/label/c.UIDualboxAvailable';
import UIDualboxSelected from '@salesforce/label/c.UIDualboxSelected';
import MappingSelectionInfoOf from '@salesforce/label/c.MappingSelectionInfoOf';
import MappingSelectionInfoFields from '@salesforce/label/c.MappingSelectionInfoFields';
import MappingSelectionInfoRecordTypes from '@salesforce/label/c.MappingSelectionInfoRecordTypes';
import MappingSelectionInfoChildren from '@salesforce/label/c.MappingSelectionInfoChildren';

export default class MappingScreen extends NavigationMixin(LightningElement) {

    @api assessmentid;
    @track isLoading = false;
    @track loadingCount = 0;

    @track assessment = {};

    //Temp variable to work with Apex
    @track newMappings = [];
    @track additionalMappings = [];

    //Object Definitions
    @track orgSchema = [];
    @api fscSchema = [];

    //Object Data
    @track objectDefs = {};
    @api fscDefs = {};

    @track mappings = [{ "isSet": "true" }, {}];

    @track activeSections = [];

    @track defaultRecordTypeMap = {};

    @track currentMappingData;

    //Modal variables
    @track showModal = false;
    @track modalInfo = {};
    @track modalDefault = '';

    //Update Variables
    @api updateSeverity;

    systemLogger;

    label = {
        UISaveButtonText,
        UICancelButtonText,
        UIPicklistPlaceholderText,
        UIFinishButtonText,
        UIBackButtonText,
        MappingAdditionalDesc,
        MappingAdditionalTitle,
        MappingDetailsTitle,
        MappingFieldAdd,
        MappingFieldDest,
        MappingFieldSource,
        MappingFieldTitle,
        MappingIntro,
        MappingObjectAdd,
        MappingObjectDest,
        MappingObjectRemove,
        MappingObjectSource,
        MappingRecommendedDesc,
        MappingRecommendedTitle,
        MappingRTAdd,
        MappingRTDest,
        MappingRTSource,
        MappingRTTitle,
        ToastTitleSuccess,
        ToastTitleSave,
        ToastTitleError,
        ToastMessageMappingSaved,
        ToastMessageError,
        ToastMessageAutoMap,
        ComboboxNoneValue,
        MappingChildTitle,
        UIDualboxAvailable,
        UIDualboxSelected,
        MappingSelectionInfoOf,
        MappingSelectionInfoFields,
        MappingSelectionInfoRecordTypes,
        MappingSelectionInfoChildren,
        ToastMessageAutoMapError,
        ToastMessageAutoMapNoneTitle,
        ToastMessageAutoMapNoneDesc
    };

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    connectedCallback() {
        this.isLoading = true;

        getOrgDef()
            .then(schemaResult => {
                this.orgSchema = [{ "value": "", "label": this.label.ComboboxNoneValue }];
                schemaResult.forEach(objectName => {
                    if (objectName.startsWith('=')) {
                        objectName = objectName.replace('=', '');
                        this.orgSchema.push({ "value": objectName, "label": objectName, "type": 'category' });
                    } else {
                        this.orgSchema.push({ "value": objectName, "label": objectName });
                    }
                });

                getObjectMapping({ assessmentId: this.assessmentid, populateSourceDef: false })
                    .then(result => {
                        this.newMappings = result.recommended;
                        if (result.additional) {
                            this.additionalMappings = result.additional;
                        } else {
                            this.additionalMappings = [];
                        }

                        this.newMappings.forEach(section => {
                            var rtNames = [], fieldNames = [];
                            section.mappingData.forEach(objectMapping => {
                                //Populate picklists with "New Meta" fields
                                objectMapping.recordTypeMapping.forEach(rtMapping => {
                                    if (rtMapping.newMeta) {
                                        if (!rtNames.includes(rtMapping.destination)) {
                                            objectMapping.destinationDef.recordTypes.splice(1, 0, { label: '[NEW] ' + rtMapping.newMeta.label, value: rtMapping.newMeta.apiName, newMeta: rtMapping.newMeta });
                                            rtNames.push(rtMapping.newMeta.apiName);
                                        }
                                    }

                                    objectMapping.destinationDef.recordTypes = [...objectMapping.destinationDef.recordTypes];
                                });



                                objectMapping.fieldMapping.forEach(fieldMapping => {
                                    if (fieldMapping.newMeta) {
                                        if (!fieldNames.includes(fieldMapping.destination)) {
                                            objectMapping.destinationDef.fieldMapping.splice(1, 0, { label: '[NEW] ' + fieldMapping.newMeta.label, value: fieldMapping.newMeta.apiName, newMeta: fieldMapping.newMeta });
                                            fieldNames.push(fieldMapping.newMeta.apiName)
                                        }
                                    }

                                    objectMapping.destinationDef.fieldMapping = [...objectMapping.destinationDef.fieldMapping];
                                });
                            });

                        });

                        this.additionalMappings.forEach(objectMapping => {
                            var rtNames = [], fieldNames = [];
                            //Populate picklists with "New Meta" fields
                            if (objectMapping.recordTypeMapping) {
                                objectMapping.recordTypeMapping.forEach(rtMapping => {
                                    if (rtMapping.newMeta) {
                                        if (!rtNames.includes(rtMapping.destination)) {
                                            objectMapping.destinationDef.recordTypes.splice(1, 0, { label: '[NEW] ' + rtMapping.newMeta.label, value: rtMapping.newMeta.apiName, newMeta: rtMapping.newMeta });
                                            rtNames.push(rtMapping.newMeta.apiName);
                                        }
                                    }

                                    objectMapping.destinationDef.recordTypes = [...objectMapping.destinationDef.recordTypes];
                                });
                            } else {
                                objectMapping.recordTypeMapping = [];
                            }

                            if (objectMapping.fieldMapping) {
                                objectMapping.fieldMapping.forEach(fieldMapping => {
                                    if (fieldMapping.newMeta) {
                                        if (!fieldNames.includes(fieldMapping.destination)) {
                                            objectMapping.destinationDef.fieldMapping.splice(1, 0, { label: '[NEW] ' + fieldMapping.newMeta.label, value: fieldMapping.newMeta.apiName, newMeta: fieldMapping.newMeta });
                                            fieldNames.push(fieldMapping.newMeta.apiName)
                                        }
                                    }

                                    objectMapping.destinationDef.fieldMapping = [...objectMapping.destinationDef.fieldMapping];
                                });
                            } else {
                                objectMapping.fieldMapping = [];
                            }
                        });

                        this.isLoading = false;
                        this.dispatchEvent(new CustomEvent("stoploading", {}));
                    })
            })
            .catch(error => {
                this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#connectedCallback');
                this.isLoading = false;
            });
    }

    addRow(e) {
        this.isLoading = true;
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var type = e.target.dataset.type;


        new Promise(
            (resolve, reject) => {
                setTimeout(() => {
                    if (type === 'additional') {
                        try {
                            if (this.additionalMappings[objectIndex].fieldMapping) {
                                this.additionalMappings[objectIndex].fieldMapping.push({ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" });
                            } else {
                                this.additionalMappings[objectIndex].fieldMapping = [{ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" }];
                            }
                        } catch (error) {
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#addRow');
                        }
                    } else {
                        try {
                            if (this.newMappings[index].mappingData[objectIndex].fieldMapping) {
                                this.newMappings[index].mappingData[objectIndex].fieldMapping.push({ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" });
                            } else {
                                this.newMappings[index].mappingData[objectIndex].fieldMapping = [{ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" }];
                            }
                        } catch (error) {
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#addRow');
                        }
                    }
                    this.isLoading = false;
                    resolve();
                }, 0);
            }).then(
                () => { return }
            );
    }

    addRecordTypeRow(e) {
        this.isLoading = true;
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var type = e.target.dataset.type;

        new Promise(
            (resolve, reject) => {
                setTimeout(() => {
                    if (type === 'additional') {
                        try {
                            if (this.additionalMappings[objectIndex].recordTypeMapping) {
                                this.additionalMappings[objectIndex].recordTypeMapping.push({ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" });
                            } else {
                                this.additionalMappings[objectIndex].recordTypeMapping = [{ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" }];
                            }
                        } catch (error) {
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#addRecordTypeRow');
                        }
                    } else {
                        try {
                            if (this.newMappings[index].mappingData[objectIndex].recordTypeMapping) {
                                this.newMappings[index].mappingData[objectIndex].recordTypeMapping.push({ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" });
                            } else {
                                this.newMappings[index].mappingData[objectIndex].recordTypeMapping = [{ "destination": "", "source": "", "truncate": "false", "userGenerated": "true" }];
                            }
                        } catch (error) {
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#addRecordTypeRow2');
                        }
                    }
                    this.isLoading = false;
                    resolve();
                }, 0);
            }).then(
                () => { return }
            );
    }

    sectionHeaderClicked(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var type = e.target.dataset.type;

        try {
            if (type === 'additional') {
                if (!this.additionalMappings[objectIndex].sourceDef) {
                    this.isLoading = true;
                    //Check if we already have object def
                    if (this.objectDefs[this.additionalMappings[objectIndex].source]) {
                        this.additionalMappings[objectIndex].sourceDef = JSON.parse(JSON.stringify(this.objectDefs[this.additionalMappings[objectIndex].source]));
                        //Calculate count strings
                        this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                        this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                        this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);

                        this.isLoading = false;
                    } else {
                        getSourceDef({ apiName: this.additionalMappings[objectIndex].source })
                            .then(defResult => {
                                if (defResult) {
                                    this.objectDefs[this.additionalMappings[objectIndex].source] = defResult;
                                    this.additionalMappings[objectIndex].sourceDef = JSON.parse(JSON.stringify(defResult));
                                    //Calculate count strings
                                    this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                                    this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                                    this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
                                }
                                this.isLoading = false;
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#sectionHeaderClicked');
                            });
                    }
                } else {
                    if (!this.additionalMappings[objectIndex].rtCountString) {
                        this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                        this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                        this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
                    }
                }
            } else {
                //Get section
                var objectData = this.newMappings[index].mappingData[objectIndex];
                if (!objectData.sourceDef) {
                    this.isLoading = true;
                    //Check if we already have object def
                    if (this.objectDefs[objectData.source]) {
                        this.newMappings[index].mappingData[objectIndex].sourceDef = JSON.parse(JSON.stringify(this.objectDefs[objectData.source]));
                        this.isLoading = false;

                        //Calculate count strings
                        this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                        this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                        this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
                    } else {
                        getSourceDef({ apiName: objectData.source })
                            .then(defResult => {
                                if (defResult) {
                                    this.objectDefs[objectData.source] = defResult;
                                    this.newMappings[index].mappingData[objectIndex].sourceDef = JSON.parse(JSON.stringify(defResult));

                                    //Calculate count strings
                                    this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                                    this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                                    this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
                                }
                                this.isLoading = false;
                            })
                            .catch(error => {
                                this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#sectionHeaderClicked2');
                            });
                    }
                } else {
                    if (!this.newMappings[index].mappingData[objectIndex].rtCountString) {
                        this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                        this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                        this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
                    }
                }
            }
        } catch (e) {
            this.systemLogger.log('Error', e, this.assessmentid, 'mappingScreen#sectionHeaderClicked3');
        }
    }

    addObjectRow(e) {
        this.isLoading = true;
        var index = e.target.dataset.index;
        var type = e.target.dataset.type;
        new Promise(
            (resolve, reject) => {
                setTimeout(() => {
                    if (type === 'additional') {
                        this.additionalMappings.push({ "userGenerated": "true" });
                    } else {
                        this.newMappings[index].mappingData.push({ "userGenerated": "true" });
                    }
                    this.isLoading = false;
                    resolve();
                }, 0);
            }).then(
                () => { return }
            );
    }

    removeRow(e) {
        var index = e.target.dataset.index;
        var fieldIndex = e.target.dataset.fieldindex;
        var objectIndex = e.target.dataset.objectindex;
        var type = e.target.dataset.type;
        if (type === 'additional') {
            this.additionalMappings[objectIndex].fieldMapping.splice(fieldIndex, 1);
            //Update mapped count
            this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
        } else {
            this.newMappings[index].mappingData[objectIndex].fieldMapping.splice(fieldIndex, 1);
            //Update mapped count
            this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
        }
    }

    removeRecordTypeRow(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var rtIndex = e.target.dataset.rtindex;
        var type = e.target.dataset.type;
        if (type === 'additional') {
            this.additionalMappings[objectIndex].recordTypeMapping.splice(rtIndex, 1);
            //Update mapped count
            this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
        } else {
            this.newMappings[index].mappingData[objectIndex].recordTypeMapping.splice(rtIndex, 1);
            //Update mapped count
            this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
        }
    }

    removeObjectRow(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var type = e.target.dataset.type;
        if (type === 'additional') {
            this.additionalMappings.splice(objectIndex, 1);
        } else {
            this.newMappings[index].mappingData.splice(objectIndex, 1);
        }
    }

    orgSchemaSelect(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;
        if (!value) {
            if (type === 'additional') {
                delete this.additionalMappings[objectIndex].showDetails
                //Clear out other data
                this.additionalMappings[objectIndex].source = "";
                if (this.additionalMappings[objectIndex].recordTypeMapping) {
                    this.additionalMappings[objectIndex].recordTypeMapping = [];
                }
                if (this.additionalMappings[objectIndex].fieldMapping) {
                    this.additionalMappings[objectIndex].fieldMapping = [];
                }
                if (this.additionalMappings[objectIndex].childRelationships) {
                    this.additionalMappings[objectIndex].childRelationships = [];
                    this.additionalMappings[objectIndex].childRelationshipDualboxValues = "";
                }
            } else {
                delete this.newMappings[index].mappingData[objectIndex].showDetails
                //Clear out other data
                this.newMappings[index].mappingData[objectIndex].source = "";
                if (this.newMappings[index].mappingData[objectIndex].recordTypeMapping) {
                    this.newMappings[index].mappingData[objectIndex].recordTypeMapping = [];
                }
                if (this.newMappings[index].mappingData[objectIndex].fieldMapping) {
                    this.newMappings[index].mappingData[objectIndex].fieldMapping = [];
                }
                if (this.newMappings[index].mappingData[objectIndex].childRelationships) {
                    this.newMappings[index].mappingData[objectIndex].childRelationships = [];
                    this.newMappings[index].mappingData[objectIndex].childRelationshipDualboxValues = "";
                }
            }
        } else {
            //Get Object Def
            if (!this.objectDefs[value]) {
                this.isLoading = true;
                getObjectDef({ apiName: value })
                    .then(result => {
                        if (type === 'additional') {
                            this.additionalMappings[objectIndex].sourceDef = result;
                            this.additionalMappings[objectIndex].showDetails = this.additionalMappings[objectIndex].destination ? true : false;
                            this.additionalMappings[objectIndex].recordTypeMapping = [];
                            this.additionalMappings[objectIndex].fieldMapping = [];
                            this.additionalMappings[objectIndex].source = value;

                            this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                            this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                            this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
                        } else {
                            this.newMappings[index].mappingData[objectIndex].sourceDef = result;
                            this.newMappings[index].mappingData[objectIndex].showDetails = true;
                            this.newMappings[index].mappingData[objectIndex].source = value;
                            if (this.newMappings[index].mappingData[objectIndex].recordTypeMapping) {
                                this.newMappings[index].mappingData[objectIndex].recordTypeMapping = [];
                            }
                            if (this.newMappings[index].mappingData[objectIndex].fieldMapping) {
                                this.newMappings[index].mappingData[objectIndex].fieldMapping = [];
                            }
                            if (this.newMappings[index].mappingData[objectIndex].childRelationships) {
                                this.newMappings[index].mappingData[objectIndex].childRelationships = [];
                                this.newMappings[index].mappingData[objectIndex].childRelationshipDualboxValues = "";
                            }

                            this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                            this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                            this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
                        }

                        //Cache object for future use
                        this.objectDefs[value] = result;

                        this.isLoading = false;
                    })
                    .catch(error => {
                        this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#orgSchemaSelect');
                        this.isLoading = false;
                    });
            } else {
                if (type === 'additional') {
                    this.additionalMappings[objectIndex].sourceDef = this.objectDefs[value];
                    this.additionalMappings[objectIndex].showDetails = true;
                    this.additionalMappings[objectIndex].recordTypeMapping = [];
                    this.additionalMappings[objectIndex].fieldMapping = [];
                    this.additionalMappings[objectIndex].source = value;

                    this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                    this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                    this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
                } else {
                    this.newMappings[index].mappingData[objectIndex].sourceDef = this.objectDefs[value];
                    this.newMappings[index].mappingData[objectIndex].showDetails = true;
                    this.newMappings[index].mappingData[objectIndex].source = value;
                    if (this.newMappings[index].mappingData[objectIndex].recordTypeMapping) {
                        this.newMappings[index].mappingData[objectIndex].recordTypeMapping = [];
                    }
                    if (this.newMappings[index].mappingData[objectIndex].fieldMapping) {
                        this.newMappings[index].mappingData[objectIndex].fieldMapping = [];
                    }
                    if (this.newMappings[index].mappingData[objectIndex].childRelationships) {
                        this.newMappings[index].mappingData[objectIndex].childRelationships = [];
                        this.newMappings[index].mappingData[objectIndex].childRelationshipDualboxValues = "";
                    }

                    this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                    this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                    this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
                }
            }
        }
    }

    fscSchemaSelect(e) {
        this.isLoading = true;
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;
        try {
            if (type === 'additional') {
                this.additionalMappings[objectIndex].destination = value;
                this.additionalMappings[objectIndex].showDetails = this.additionalMappings[objectIndex].source ? true : false;
                this.additionalMappings[objectIndex].recordTypeMapping = [];
                this.additionalMappings[objectIndex].fieldMapping = [];
                if (this.additionalMappings[objectIndex].childRelationships) {
                    this.additionalMappings[objectIndex].childRelationships = [];
                    this.additionalMappings[objectIndex].childRelationshipDualboxValues = "";
                }

                //Set fields and record types
                var mappingInfo = this.fscDefs[value];
                this.additionalMappings[objectIndex].destinationDef = JSON.parse(JSON.stringify(mappingInfo));

                this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
                this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
            } else {
                this.newMappings[index].mappingData[objectIndex].destination = value;
                this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
                this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
            }
            this.isLoading = false;
        } catch (e) {
            this.systemLogger.log('Error', error, 'mappingScreen#fscSchemaSelect');
        }

    }

    orgRecordTypeSelect(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var recordTypeIndex = e.target.dataset.recordtyypeindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;

        if (type === 'additional') {
            this.additionalMappings[objectIndex].recordTypeMapping[recordTypeIndex].source = value;

            //Update mapped count
            this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
        } else {
            this.newMappings[index].mappingData[objectIndex].recordTypeMapping[recordTypeIndex].source = value;

            //Update mapped count
            this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
        }
    }

    fscRecordTypeSelect(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var recordTypeIndex = e.target.dataset.recordtyypeindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;

        if (value === 'new') {
            try {
                if (type === 'additional') {
                    this.modalInfo = { 'category': type, 'indicies': [index, objectIndex, recordTypeIndex], 'type': 'rt', 'existingValues': this.additionalMappings[objectIndex].destinationDef.recordTypes };
                    this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
                } else {
                    this.modalInfo = { 'category': type, 'indicies': [index, objectIndex, recordTypeIndex], 'type': 'rt', 'existingValues': this.newMappings[index].mappingData[objectIndex].destinationDef.recordTypes };
                    this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
                }

                this.openModal();
            } catch (e) {
                this.systemLogger.log('Error', e, this.assessmentid, 'mappingScreen#fscRecordTypeSelect');
            }

        } else {
            if (type === 'additional') {
                this.additionalMappings[objectIndex].recordTypeMapping[recordTypeIndex].destination = value;
                this.additionalMappings[objectIndex].rtCountString = this.getMappedRtCount(this.additionalMappings[objectIndex]);
            } else {
                this.newMappings[index].mappingData[objectIndex].recordTypeMapping[recordTypeIndex].destination = value;
                this.newMappings[index].mappingData[objectIndex].rtCountString = this.getMappedRtCount(this.newMappings[index].mappingData[objectIndex]);
            }
        }


    }

    orgFieldSelect(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var fieldIndex = e.target.dataset.fieldindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;

        if (type === 'additional') {
            this.additionalMappings[objectIndex].fieldMapping[fieldIndex].source = value;

            //Update mapped count
            this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
        } else {
            this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].source = value;

            //Update mapped count
            this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
        }
    }

    fscFieldSelect(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var fieldIndex = e.target.dataset.fieldindex;
        var value = e.detail.value;
        var type = e.target.dataset.type;

        if (value === 'new') {
            var associatedSource;
            this.modalDefault = '';
            if (type === 'additional') {
                this.modalInfo = { 'category': type, 'indicies': [index, objectIndex, fieldIndex], 'type': 'field', 'existingValues': this.additionalMappings[objectIndex].destinationDef.fieldMapping };
                associatedSource = this.additionalMappings[objectIndex].fieldMapping[fieldIndex];
                if (associatedSource.source) {
                    //Grab data type
                    this.modalDefault = this.additionalMappings[objectIndex].sourceDef.fields.filter((opt => opt.value === associatedSource.source))[0].dataType;
                }
                this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
            } else {
                this.modalInfo = { 'category': type, 'indicies': [index, objectIndex, fieldIndex], 'type': 'field', 'existingValues': this.newMappings[index].mappingData[objectIndex].destinationDef.fieldMapping };
                associatedSource = this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex];
                if (associatedSource.source) {
                    //Grab data type
                    this.modalDefault = this.newMappings[index].mappingData[objectIndex].sourceDef.fields.filter((opt => opt.value === associatedSource.source))[0].dataType;
                }
                this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
            }

            this.openModal();
        } else if (value === 'clone') {
            //FSCTA-1641: Clone Field - This will set the "clone" flag; which will be populated upon MappingJSON save.
            if (type === 'additional') {
                this.additionalMappings[objectIndex].fieldMapping[fieldIndex].destination = 'clone';
            } else {
                this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].destination = 'clone';
            }
        } else {
            if (type === 'additional') {
                this.additionalMappings[objectIndex].fieldMapping[fieldIndex].currentMeta = this.additionalMappings[objectIndex].destinationDef.fieldMapping.filter(opt => opt.value === value)[0].currentMeta;
                this.additionalMappings[objectIndex].fieldMapping[fieldIndex].destination = value;
                //Delete NewMeta type (if exists)
                if (this.additionalMappings[objectIndex].fieldMapping[fieldIndex].newMeta) {
                    delete this.additionalMappings[objectIndex].fieldMapping[fieldIndex].newMeta
                }
                this.additionalMappings[objectIndex].fieldCountString = this.getMappedFieldCount(this.additionalMappings[objectIndex]);
            } else {
                this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].currentMeta = this.newMappings[index].mappingData[objectIndex].destinationDef.fieldMapping.filter(opt => opt.value === value)[0].currentMeta;
                this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].destination = value;
                //Delete NewMeta type (if exists)
                if (this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].newMeta) {
                    delete this.newMappings[index].mappingData[objectIndex].fieldMapping[fieldIndex].newMeta
                }
                this.newMappings[index].mappingData[objectIndex].fieldCountString = this.getMappedFieldCount(this.newMappings[index].mappingData[objectIndex]);
            }
        }
    }

    childSelected(e) {
        var index = e.target.dataset.index;
        var objectIndex = e.target.dataset.objectindex;
        var selectedChildList = e.detail.value;
        var type = e.target.dataset.type;

        try {
            var finalChildList = [];
            if (type === 'additional') {
                selectedChildList.forEach(selectedChild => {
                    var childInfo = this.additionalMappings[objectIndex].sourceDef.childRelationshipDefs[selectedChild];

                    var realLabel = childInfo.label.substring(0, childInfo.label.indexOf('('));
                    finalChildList.push({ label: realLabel, value: childInfo.value, newMeta: { dataType: childInfo.type, metaLabel: realLabel, apiName: childInfo.value, connectedObject: childInfo.objectApiName, childRelationshipName: childInfo.relationshipName } });
                });
                this.additionalMappings[objectIndex].childRelationshipDualboxValues = selectedChildList;
                this.additionalMappings[objectIndex].childRelationships = finalChildList;

                //Update mapped count
                this.additionalMappings[objectIndex].childCountString = this.getMappedChildCount(this.additionalMappings[objectIndex]);
            } else {
                selectedChildList.forEach(selectedChild => {
                    var childInfo = this.newMappings[index].mappingData[objectIndex].sourceDef.childRelationshipDefs[selectedChild];

                    var realLabel = childInfo.label.substring(0, childInfo.label.indexOf('('));
                    finalChildList.push({ label: realLabel, value: childInfo.value, newMeta: { dataType: childInfo.type, metaLabel: realLabel, apiName: childInfo.value, connectedObject: childInfo.objectApiName, childRelationshipName: childInfo.relationshipName } });
                });

                this.newMappings[index].mappingData[objectIndex].childRelationshipDualboxValues = selectedChildList;
                this.newMappings[index].mappingData[objectIndex].childRelationships = finalChildList;

                //Update mapped count
                this.newMappings[index].mappingData[objectIndex].childCountString = this.getMappedChildCount(this.newMappings[index].mappingData[objectIndex]);
            }
        } catch (e) {
            this.systemLogger.log('Error', e, this.assessmentid, 'mappingScreen#childSelected');
        }
    }

    saveProgress() {
        this.isLoading = true;
        var isEmpty = true;

        //Combine mappings
        var clonedFieldsNew = new Map();
        var clonedFieldsAdditional = new Map();
        try {
            var mappingFileData = {};
            mappingFileData.recommended = [];
            mappingFileData.additional = [];
            this.newMappings.forEach(row => {
                var recRow = JSON.parse(JSON.stringify(row));
                if (recRow.mappingData) {
                    recRow.mappingData.forEach(selection => {
                        if ((selection.fieldMapping && selection.fieldMapping.length > 0) || (selection.recordTypeMapping && selection.recordTypeMapping.length > 0)) {
                            isEmpty = false;
                        }

                        //TODO: Handle any fields that are "cloned"
                        if (selection.fieldMapping.length > 0) {
                            selection.fieldMapping.forEach(fieldInfo => {
                                if (fieldInfo.destination === 'clone') {
                                    clonedFieldsNew.set(selection.source + '.' + fieldInfo.source, selection.destination);
                                }
                            });
                        }

                        // delete selection.sourceDef;
                        // delete selection.destinationDef;
                    });
                    //mappingFileData.recommended.push(recRow);
                }
            });

            this.additionalMappings.forEach(row => {
                if (row.showDetails) {
                    var mappingItem = JSON.parse(JSON.stringify(row));

                    //TODO: Handle any fields that are "cloned"
                    if (mappingItem.fieldMapping.length > 0) {
                        mappingItem.fieldMapping.forEach(fieldInfo => {
                            if (fieldInfo.destination === 'clone') {
                                clonedFieldsAdditional.set(mappingItem.source + '.' + fieldInfo.source, mappingItem.destination);
                            }
                        });
                    }

                    // delete mappingItem.rtList;
                    // delete mappingItem.fieldList;
                    // delete mappingItem.sourceDef;
                    // delete mappingItem.destinationDef;
                    //mappingFileData.additional.push(mappingItem);
                }
            });
        } catch (e) {
            console.log("=ERROR: ", e)
            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#saveProgress');
        }

        //Convert to Objects (Apex seems to not accept JS Maps naturally)
        var cloneNewObj = Object.fromEntries(clonedFieldsNew);
        var cloneAddObj = Object.fromEntries(clonedFieldsAdditional);

        getFieldMeta({ sectionedFields: cloneNewObj, additionalFields: cloneAddObj })
            .then(result => {
                //For each clone, populate respective destination with field info
                if (result) {
                    this.newMappings.forEach(row => {
                        var recRow = JSON.parse(JSON.stringify(row));
                        if (recRow.mappingData) {
                            recRow.mappingData.forEach(selection => {
                                if (selection.fieldMapping.length > 0) {
                                    selection.fieldMapping.forEach(fieldInfo => {
                                        if (fieldInfo.destination === 'clone') {
                                            if (result[selection.source + '.' + fieldInfo.source]) {
                                                //Remove quotes from any Boolean values
                                                var resultString = JSON.stringify(result[selection.source + '.' + fieldInfo.source]);
                                                resultString = resultString.replaceAll('"true"', 'true');
                                                resultString = resultString.replaceAll('"false"', 'false');
                                                //Add the "apiName" attribute to newMeta
                                                var finalResult = JSON.parse(resultString);
                                                var destinationString = finalResult['fullName'].substring(finalResult['fullName'].indexOf('.') + 1);
                                                finalResult['apiName'] = (destinationString.endsWith('__c')) ? destinationString.slice(0, -3) : destinationString;
                                                delete finalResult.fullName;
                                                //Set cloned field's "newMeta" property
                                                fieldInfo.newMeta = finalResult;
                                            }
                                        }
                                    });
                                }
                                delete selection.sourceDef;
                                delete selection.destinationDef;
                            });
                            mappingFileData.recommended.push(recRow);
                        }
                    });

                    this.additionalMappings.forEach(row => {
                        if (row.showDetails) {
                            var mappingItem = JSON.parse(JSON.stringify(row));

                            if (mappingItem.fieldMapping.length > 0) {
                                mappingItem.fieldMapping.forEach(fieldInfo => {
                                    if (fieldInfo.destination === 'clone') {
                                        if (result[mappingItem.source + '.' + fieldInfo.source]) {
                                            //Remove quotes from any Boolean values
                                            var resultString = JSON.stringify(result[mappingItem.source + '.' + fieldInfo.source]);
                                            resultString = resultString.replaceAll('"true"', 'true');
                                            resultString = resultString.replaceAll('"false"', 'false');
                                            //Add the "apiName" attribute to newMeta
                                            var finalResult = JSON.parse(resultString);
                                            var destinationString = finalResult['fullName'].substring(finalResult['fullName'].indexOf('.') + 1);
                                            finalResult['apiName'] = (destinationString.endsWith('__c')) ? destinationString.slice(0, -3) : destinationString;
                                            delete finalResult.fullName;
                                            //Set cloned field's "newMeta" property
                                            fieldInfo.newMeta = finalResult;
                                        }
                                    }
                                });
                            }
                            delete mappingItem.rtList;
                            delete mappingItem.fieldList;
                            delete mappingItem.sourceDef;
                            delete mappingItem.destinationDef;
                            mappingFileData.additional.push(mappingItem);
                        }
                    });
                }

                //Save mapping file
                saveMappingFile({ recordId: this.assessmentid, filename: 'mapping', filetype: 'json', filedata: JSON.stringify(mappingFileData), isEmpty: isEmpty })
                    .then(result => {
                        this.isLoading = false;

                        const evt = new ShowToastEvent({
                            title: this.label.ToastTitleSave,
                            variant: 'success',
                        });
                        this.dispatchEvent(evt);
                    })
                    .catch(error => {
                        this.isLoading = false;
                        this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#saveProgress2');
                        const evt = new ShowToastEvent({
                            title: this.label.ToastTitleError,
                            message: this.label.ToastMessageError,
                            variant: 'success',
                        });
                        this.dispatchEvent(evt);
                    });

            })
            .catch(error => {
                console.log('==Error: ', error);
            });
    }

    completeMapping() {
        this.isLoading = true;
        var isEmpty = true;

        try {
            //Combine mappings
            var clonedFieldsNew = new Map();
            var clonedFieldsAdditional = new Map();
            if (this.disableFinish !== true) {
                try {
                    var mappingFileData = {};
                    mappingFileData.recommended = [];
                    mappingFileData.additional = [];
                    this.newMappings.forEach(row => {
                        var recRow = JSON.parse(JSON.stringify(row));
                        if (recRow.mappingData) {
                            recRow.mappingData.forEach(selection => {
                                if ((selection.fieldMapping && selection.fieldMapping.length > 0) || (selection.recordTypeMapping && selection.recordTypeMapping.length > 0)) {
                                    isEmpty = false;
                                }
                                //Handle any fields that are "cloned"
                                if (selection.fieldMapping.length > 0) {
                                    selection.fieldMapping.forEach(fieldInfo => {
                                        if (fieldInfo.destination === 'clone') {
                                            clonedFieldsNew.set(selection.source + '.' + fieldInfo.source, selection.destination);
                                        }
                                    });
                                }

                                // delete selection.sourceDef;
                                // delete selection.destinationDef;
                            });
                            // mappingFileData.recommended.push(recRow);
                        }
                    });

                    this.additionalMappings.forEach(row => {
                        if (row.showDetails) {
                            var mappingItem = JSON.parse(JSON.stringify(row));

                            //TODO: Handle any fields that are "cloned"
                            if (mappingItem.fieldMapping.length > 0) {
                                mappingItem.fieldMapping.forEach(fieldInfo => {
                                    if (fieldInfo.destination === 'clone') {
                                        clonedFieldsAdditional.set(mappingItem.source + '.' + fieldInfo.source, mappingItem.destination);
                                    }
                                });
                            }

                            // delete mappingItem.rtList;
                            // delete mappingItem.fieldList;
                            // delete mappingItem.sourceDef;
                            // delete mappingItem.destinationDef;
                            // mappingFileData.additional.push(mappingItem);
                        }
                    });

                    //Convert to Objects (Apex seems to not accept JS Maps naturally)
                    var cloneNewObj = Object.fromEntries(clonedFieldsNew);
                    var cloneAddObj = Object.fromEntries(clonedFieldsAdditional);

                    getFieldMeta({ sectionedFields: cloneNewObj, additionalFields: cloneAddObj })
                        .then(result => {
                            //For each clone, populate respective destination with field info
                            if (result) {
                                this.newMappings.forEach(row => {
                                    var recRow = JSON.parse(JSON.stringify(row));
                                    if (recRow.mappingData) {
                                        recRow.mappingData.forEach(selection => {
                                            if (selection.fieldMapping.length > 0) {
                                                selection.fieldMapping.forEach(fieldInfo => {
                                                    if (fieldInfo.destination === 'clone') {
                                                        if (result[selection.source + '.' + fieldInfo.source]) {
                                                            //Remove quotes from any Boolean values
                                                            var resultString = JSON.stringify(result[selection.source + '.' + fieldInfo.source]);
                                                            resultString = resultString.replaceAll('"true"', 'true');
                                                            resultString = resultString.replaceAll('"false"', 'false');
                                                            //Add the "apiName" attribute to newMeta
                                                            var finalResult = JSON.parse(resultString);
                                                            var destinationString = finalResult['fullName'].substring(finalResult['fullName'].indexOf('.') + 1);
                                                            finalResult['apiName'] = (destinationString.endsWith('__c')) ? destinationString.slice(0, -3) : destinationString;
                                                            delete finalResult.fullName;
                                                            //Set cloned field's "newMeta" property
                                                            fieldInfo.newMeta = finalResult;
                                                        }
                                                    }
                                                });
                                            }
                                            delete selection.sourceDef;
                                            delete selection.destinationDef;
                                        });
                                        mappingFileData.recommended.push(recRow);
                                    }
                                });

                                this.additionalMappings.forEach(row => {
                                    if (row.showDetails) {
                                        var mappingItem = JSON.parse(JSON.stringify(row));

                                        if (mappingItem.fieldMapping.length > 0) {
                                            mappingItem.fieldMapping.forEach(fieldInfo => {
                                                if (fieldInfo.destination === 'clone') {
                                                    if (result[mappingItem.source + '.' + fieldInfo.source]) {
                                                        //Remove quotes from any Boolean values
                                                        var resultString = JSON.stringify(result[mappingItem.source + '.' + fieldInfo.source]);
                                                        resultString = resultString.replaceAll('"true"', 'true');
                                                        resultString = resultString.replaceAll('"false"', 'false');
                                                        //Add the "apiName" attribute to newMeta
                                                        var finalResult = JSON.parse(resultString);
                                                        var destinationString = finalResult['fullName'].substring(finalResult['fullName'].indexOf('.') + 1);
                                                        finalResult['apiName'] = (destinationString.endsWith('__c')) ? destinationString.slice(0, -3) : destinationString;
                                                        delete finalResult.fullName;
                                                        //Set cloned field's "newMeta" property
                                                        fieldInfo.newMeta = finalResult;
                                                    }
                                                }
                                            });
                                        }
                                        delete mappingItem.rtList;
                                        delete mappingItem.fieldList;
                                        delete mappingItem.sourceDef;
                                        delete mappingItem.destinationDef;
                                        mappingFileData.additional.push(mappingItem);
                                    }
                                });
                            }
                            saveMappingFile({ recordId: this.assessmentid, filename: 'mapping', filetype: 'json', filedata: JSON.stringify(mappingFileData), isEmpty: isEmpty })
                                .then(result => {
                                    this.isLoading = false;

                                    //Navigate to Assessment Detail
                                    this[NavigationMixin.Navigate]({
                                        type: 'standard__recordPage',
                                        attributes: {
                                            recordId: this.assessmentid,
                                            actionName: 'view'
                                        },
                                    });
                                })
                                .catch(error => {
                                    this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#complieteMapping2');
                                    this.isLoading = false;
                                });
                        })
                        .catch(error => {
                            this.isLoading = false;
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#saveProgress2');
                            const evt = new ShowToastEvent({
                                title: this.label.ToastTitleError,
                                message: this.label.ToastMessageError,
                                variant: 'success',
                            });
                            this.dispatchEvent(evt);
                        });
                } catch (e) {
                    this.systemLogger.log('Error', e, this.assessmentid, 'mappingScreen#completeMapping');
                }
            }
        } catch (e) {
            console.log('==ERROR: ', e);
            console.log(JSON.stringify(e));
        }


    }

    openModal() {
        this.showModal = true;
    }

    saveAndCloseModal(event) {
        //Make additions to mapping
        try {
            var sectionIndex = this.modalInfo.indicies[0];
            var objectIndex = this.modalInfo.indicies[1];
            var newMeta = event.detail;
            if (this.modalInfo.type === 'rt') {
                var recordTypeIndex = this.modalInfo.indicies[2];
                if (this.modalInfo.category === 'additional') {
                    this.additionalMappings[objectIndex].destinationDef.recordTypes.splice(1, 0, { label: '[NEW] ' + newMeta.label, value: newMeta.apiName, newMeta: newMeta });
                    this.additionalMappings[objectIndex].destinationDef.recordTypes = [...this.additionalMappings[objectIndex].destinationDef.recordTypes];
                    this.additionalMappings[objectIndex].recordTypeMapping[recordTypeIndex].destination = newMeta.apiName;
                    this.additionalMappings[objectIndex].recordTypeMapping[recordTypeIndex].newMeta = newMeta;
                } else {
                    this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.recordTypes.splice(1, 0, { label: '[NEW] ' + newMeta.label, value: newMeta.apiName, newMeta: newMeta });
                    this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.recordTypes = [...this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.recordTypes];
                    this.newMappings[sectionIndex].mappingData[objectIndex].recordTypeMapping[recordTypeIndex].destination = newMeta.apiName;
                    this.newMappings[sectionIndex].mappingData[objectIndex].recordTypeMapping[recordTypeIndex].newMeta = newMeta;
                }
            } else {
                var fieldIndex = this.modalInfo.indicies[2];
                if (this.modalInfo.category === 'additional') {
                    this.additionalMappings[objectIndex].destinationDef.fieldMapping.splice(1, 0, { label: '[NEW] ' + newMeta.label, value: newMeta.apiName, newMeta: newMeta });
                    this.additionalMappings[objectIndex].destinationDef.fieldMapping = [...this.additionalMappings[objectIndex].destinationDef.fieldMapping];
                    this.additionalMappings[objectIndex].fieldMapping[fieldIndex].destination = newMeta.apiName;
                    this.additionalMappings[objectIndex].fieldMapping[fieldIndex].newMeta = newMeta;
                } else {
                    this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.fieldMapping.splice(1, 0, { label: '[NEW] ' + newMeta.label, value: newMeta.apiName, newMeta: newMeta });
                    this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.fieldMapping = [...this.newMappings[sectionIndex].mappingData[objectIndex].destinationDef.fieldMapping];
                    this.newMappings[sectionIndex].mappingData[objectIndex].fieldMapping[fieldIndex].destination = newMeta.apiName;
                    this.newMappings[sectionIndex].mappingData[objectIndex].fieldMapping[fieldIndex].newMeta = newMeta;
                }
            }
        } catch (e) {
            this.systemLogger.log('Error', e, this.assessmentid, 'mappingScreen#saveAndCloseModal');
        }


        this.closeModal();
    }

    closeModal() {
        this.showModal = false;
    }

    cancelAssessment() {
        this.dispatchEvent(new CustomEvent("closemappingscreen", {}));
    }

    autoMapClicked() {
        this.isLoading = true;
        new Promise(
            (resolve, reject) => {
                setTimeout(() => {
                    this.autoMap();
                    resolve();
                }, 0);
            }).then(
                () => { return }
            );
    }

    autoMap() {
        try {
            //Retrieve Default Record Types
            var sectionNames = [];
            //Iterate through sections
            if ((!this.newMappings || this.newMappings.length === 0) && (!this.additionalMappings || this.additionalMappings.length === 0)) {
                this.isLoading = false;
                const evt = new ShowToastEvent({
                    title: this.label.ToastMessageAutoMapNoneTitle,
                    message: this.label.ToastMessageAutoMapNoneDesc,
                    variant: 'info',
                });
                this.dispatchEvent(evt);
            } else {
                this.newMappings.forEach(mappingSection => {
                    sectionNames.push(mappingSection.sectionName);
                });

                //Call Apex
                getDefaultRts({ sectionNames: sectionNames })
                    .then(result => {
                        this.defaultRecordTypeMap = result;

                        try {
                            //Set number of rows we'll be mapping
                            this.loadingCount = 0;
                            this.newMappings.forEach(mappingSection => {
                                mappingSection.mappingData.forEach(mapRow => {
                                    if (mapRow.source && mapRow.destination) {
                                        this.loadingCount++;
                                    }
                                });
                            });
                            this.additionalMappings.forEach(objectMapping => {
                                if (objectMapping.source && objectMapping.destination) {
                                    this.loadingCount++;
                                }
                            });

                            //Map rows
                            //Recommended
                            if (this.loadingCount === 0) {
                                this.isLoading = false;
                                const evt = new ShowToastEvent({
                                    title: this.label.ToastMessageAutoMapNoneTitle,
                                    message: this.label.ToastMessageAutoMapNoneDesc,
                                    variant: 'info',
                                });
                                this.dispatchEvent(evt);
                            } else {
                                this.newMappings.forEach(mappingSection => {
                                    mappingSection.mappingData.forEach(recommendedMapping => {
                                        if (recommendedMapping.source && recommendedMapping.destination) {
                                            if (!recommendedMapping.sourceDef) {
                                                if (this.objectDefs[recommendedMapping.source]) {
                                                    recommendedMapping.sourceDef = JSON.parse(JSON.stringify(this.objectDefs[recommendedMapping.source]));
                                                    try {
                                                        this.mapSection(recommendedMapping, mappingSection);
                                                    } catch (e) {
                                                        this.loadingCount--;
                                                        if (this.loadingCount === 0) {
                                                            this.isLoading = false;
                                                            const evt = new ShowToastEvent({
                                                                title: this.label.ToastTitleSuccess,
                                                                message: this.label.ToastMessageAutoMap,
                                                                variant: 'success',
                                                            });
                                                            this.dispatchEvent(evt);
                                                            return;
                                                        }
                                                    }
                                                } else {
                                                    getSourceDef({ apiName: recommendedMapping.source })
                                                        .then(defResult => {
                                                            if (defResult) {
                                                                this.objectDefs[recommendedMapping.source] = defResult;
                                                                recommendedMapping.sourceDef = JSON.parse(JSON.stringify(defResult));
                                                            }
                                                            try {
                                                                this.mapSection(recommendedMapping, mappingSection);
                                                            } catch (e) {
                                                                this.loadingCount--;
                                                                if (this.loadingCount === 0) {
                                                                    this.isLoading = false;
                                                                    const evt = new ShowToastEvent({
                                                                        title: this.label.ToastTitleSuccess,
                                                                        message: this.label.ToastMessageAutoMap,
                                                                        variant: 'success',
                                                                    });
                                                                    this.dispatchEvent(evt);
                                                                    return;
                                                                }
                                                            }
                                                        })
                                                        .catch(error => {
                                                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#autoMap');
                                                        });
                                                }

                                            } else {
                                                try {
                                                    this.mapSection(recommendedMapping, mappingSection);
                                                } catch (e) {
                                                    this.loadingCount--;
                                                    if (this.loadingCount === 0) {
                                                        this.isLoading = false;
                                                        const evt = new ShowToastEvent({
                                                            title: this.label.ToastTitleSuccess,
                                                            message: this.label.ToastMessageAutoMap,
                                                            variant: 'success',
                                                        });
                                                        this.dispatchEvent(evt);
                                                        return;
                                                    }
                                                }
                                            }
                                        }

                                    });
                                });
                                //Additional
                                this.additionalMappings.forEach(objectMapping => {
                                    if (objectMapping.source && objectMapping.destination) {
                                        if (!objectMapping.sourceDef) {
                                            if (this.objectDefs[objectMapping.source]) {
                                                objectMapping.sourceDef = JSON.parse(JSON.stringify(this.objectDefs[objectMapping.source]));
                                                try {
                                                    this.mapSection(objectMapping, null);
                                                } catch (e) {
                                                    this.loadingCount--;
                                                    if (this.loadingCount === 0) {
                                                        this.isLoading = false;
                                                        const evt = new ShowToastEvent({
                                                            title: this.label.ToastTitleSuccess,
                                                            message: this.label.ToastMessageAutoMap,
                                                            variant: 'success',
                                                        });
                                                        this.dispatchEvent(evt);
                                                        return;
                                                    }
                                                }
                                            } else {
                                                getSourceDef({ apiName: objectMapping.source })
                                                    .then(defResult => {
                                                        if (defResult) {
                                                            this.objectDefs[objectMapping.source] = defResult;
                                                            objectMapping.sourceDef = JSON.parse(JSON.stringify(defResult));
                                                        }
                                                        try {
                                                            this.mapSection(objectMapping, null);
                                                        } catch (e) {
                                                            this.loadingCount--;
                                                            if (this.loadingCount === 0) {
                                                                this.isLoading = false;
                                                                const evt = new ShowToastEvent({
                                                                    title: this.label.ToastTitleSuccess,
                                                                    message: this.label.ToastMessageAutoMap,
                                                                    variant: 'success',
                                                                });
                                                                this.dispatchEvent(evt);
                                                                return;
                                                            }
                                                        }
                                                    })
                                                    .catch(error => {
                                                        this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#autoMap2');
                                                    });
                                            }
                                        } else {
                                            try {
                                                this.mapSection(objectMapping, null);
                                            } catch (e) {
                                                this.loadingCount--;
                                                if (this.loadingCount === 0) {
                                                    this.isLoading = false;
                                                    const evt = new ShowToastEvent({
                                                        title: this.label.ToastTitleSuccess,
                                                        message: this.label.ToastMessageAutoMap,
                                                        variant: 'success',
                                                    });
                                                    this.dispatchEvent(evt);
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        } catch (e) {
                            this.isLoading = false;
                            const evt = new ShowToastEvent({
                                title: this.label.ToastTitleError,
                                message: this.label.ToastMessageAutoMapError,
                                variant: 'error',
                            });
                            this.dispatchEvent(evt);
                            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#autoMap3');
                        }
                    })
                    .catch(error => {
                        this.isLoading = false;
                        const evt = new ShowToastEvent({
                            title: this.label.ToastTitleError,
                            message: this.label.ToastMessageAutoMapError,
                            variant: 'error',
                        });
                        this.dispatchEvent(evt);
                        this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#autoMap4');
                    });
            }
        } catch (e) {
            this.isLoading = false;
            const evt = new ShowToastEvent({
                title: this.label.ToastTitleError,
                message: this.label.ToastMessageAutoMapError,
                variant: 'error',
            });
            this.dispatchEvent(evt);
            this.systemLogger.log('Error', error, this.assessmentid, 'mappingScreen#autoMap5');
        }
    }

    mapSection(recommendedMapping, mappingSection) {
        if (recommendedMapping.showDetails) {
            var recordTypeDestinations = [];
            var fieldDestinations = [];
            //Grab existing mapped rows
            if (!recommendedMapping.recordTypeMapping) {
                recommendedMapping.recordTypeMapping = [];
            } else {
                recommendedMapping.recordTypeMapping.forEach(rtRow => {
                    if (rtRow.destination) {
                        recordTypeDestinations.push(rtRow.destination);
                    }
                });
            }

            if (!recommendedMapping.fieldMapping) {
                recommendedMapping.fieldMapping = [];
            } else {
                recommendedMapping.fieldMapping.forEach(fieldRow => {
                    if (fieldRow.destination) {
                        fieldDestinations.push(fieldRow.destination);
                    }
                });
            }

            //Check if default Record Type is present 
            var noMaster = false;

            recommendedMapping.recordTypeMapping.forEach(rtRow => {
                if (mappingSection) {
                    if (this.defaultRecordTypeMap[mappingSection.sectionName + recommendedMapping.destination] && rtRow.destination === this.defaultRecordTypeMap[mappingSection.sectionName + recommendedMapping.destination].apiName) {
                        noMaster = true;
                    }
                } else if (rtRow.source === 'Master' && rtRow.destination) {
                    noMaster = true;
                }
            });

            //Record Types
            if (recommendedMapping.sourceDef) {
                recommendedMapping.sourceDef.recordTypes.forEach(sourceRtFull => {
                    var defaultFound = false;
                    recommendedMapping.destinationDef.recordTypes.forEach(destinationRtFull => {
                        //String label to contain only actual name
                        var sourceRt = sourceRtFull.label.substring(0, sourceRtFull.label.indexOf(' ('));
                        var destinationRt = destinationRtFull.label.substring(0, destinationRtFull.label.indexOf(' ('));

                        //Also map Master if destination equals object name
                        if (sourceRt === destinationRt || (recommendedMapping.source === destinationRt && recommendedMapping.source === 'Master')) {
                            if (!recordTypeDestinations.includes(destinationRtFull.value)) {
                                if (sourceRt !== 'Master' || (sourceRt === 'Master' && noMaster === false)) {
                                    recommendedMapping.recordTypeMapping.push({ source: sourceRtFull.value, destination: destinationRtFull.value, "userGenerated": "true" });
                                }
                            }
                        }
                        //Check API Name if label doesn't match
                        else if (sourceRtFull.value === destinationRtFull.value) {
                            if (!recordTypeDestinations.includes(destinationRtFull.value)) {
                                recommendedMapping.recordTypeMapping.push({ source: sourceRtFull.value, destination: destinationRtFull.value, "userGenerated": "true" });
                            }
                        }
                    });

                });

                recommendedMapping.rtCountString = this.getMappedRtCount(recommendedMapping);

                //Fields
                recommendedMapping.sourceDef.fields.forEach(sourceFieldFull => {
                    recommendedMapping.destinationDef.fieldMapping.forEach(destinationFieldFull => {
                        var sourceField = sourceFieldFull.label.substring(0, sourceFieldFull.label.indexOf(' ('));
                        var destinationField = destinationFieldFull.label.substring(0, destinationFieldFull.label.indexOf(' ('));

                        if (sourceField === destinationField) {
                            //Check if they are the same data type as well
                            var sourceType = sourceFieldFull.label.substring(sourceFieldFull.label.lastIndexOf('(') + 1, sourceFieldFull.label.lastIndexOf(')'));
                            var destType = destinationFieldFull.type.charAt(0).toUpperCase() + destinationFieldFull.type.slice(1);
                            if (sourceType === destType) {
                                if (!fieldDestinations.includes(destinationFieldFull.value)) {
                                    recommendedMapping.fieldMapping.push({ source: sourceFieldFull.value, destination: destinationFieldFull.value, "userGenerated": "true", currentMeta: destinationFieldFull.currentMeta });
                                }
                            }
                        }
                        //Check API Name if label doesn't match
                        else if (sourceFieldFull.value === destinationFieldFull.value) {
                            //Check if they are the same data type as well
                            var sourceType = sourceFieldFull.label.substring(sourceFieldFull.label.lastIndexOf('(') + 1, sourceFieldFull.label.lastIndexOf(')'));
                            var destType = destinationFieldFull.type.charAt(0).toUpperCase() + destinationFieldFull.type.slice(1);
                            if (sourceType === destType) {
                                if (!fieldDestinations.includes(destinationFieldFull.value)) {
                                    recommendedMapping.fieldMapping.push({ source: sourceFieldFull.value, destination: destinationFieldFull.value, "userGenerated": "true", currentMeta: destinationFieldFull.currentMeta });
                                }
                            }
                        }
                    });
                });

                recommendedMapping.fieldCountString = this.getMappedFieldCount(recommendedMapping);
                recommendedMapping.childCountString = this.getMappedChildCount(recommendedMapping);
            }
        }

        this.loadingCount--;
        if (this.loadingCount === 0) {
            this.isLoading = false;
            const evt = new ShowToastEvent({
                title: this.label.ToastTitleSuccess,
                message: this.label.ToastMessageAutoMap,
                variant: 'success',
            });
            this.dispatchEvent(evt);
        }
    }

    //Count String Populations
    getMappedRtCount(section) {
        var mappedCount = 0;
        var maxCount = 0;
        if (section.sourceDef) {
            maxCount = section.sourceDef.recordTypes.length;
        }
        if (section.recordTypeMapping) {
            var apiNames = [];
            section.recordTypeMapping.forEach(row => {
                if (row.source && row.destination && !apiNames.includes(row.source)) {
                    apiNames.push(row.source);
                    mappedCount++;
                }
            });
        }

        return this.label.MappingSelectionInfoOf.replace('{0}', mappedCount).replace('{1}', maxCount) + ' ' + this.label.MappingSelectionInfoRecordTypes;
    }

    getMappedFieldCount(section) {
        var mappedCount = 0;
        var maxCount = 0;
        if (section.sourceDef) {
            maxCount = section.sourceDef.fields.length;
        }
        if (section.fieldMapping) {
            var apiNames = [];
            section.fieldMapping.forEach(row => {
                if (row.source && row.destination && !apiNames.includes(row.source)) {
                    apiNames.push(row.source);
                    mappedCount++;
                }
            });
        }
        return this.label.MappingSelectionInfoOf.replace('{0}', mappedCount).replace('{1}', maxCount) + ' ' + this.label.MappingSelectionInfoFields;
    }

    getMappedChildCount(section) {
        var mappedCount = 0;
        var maxCount = 0;
        if (section.sourceDef) {
            maxCount = section.sourceDef.childRelationshipList.length;
        }
        if (section.childRelationshipDualboxValues) {
            mappedCount = section.childRelationshipDualboxValues.length;
        }
        return this.label.MappingSelectionInfoOf.replace('{0}', mappedCount).replace('{1}', maxCount) + ' ' + this.label.MappingSelectionInfoChildren;
    }
    // END Count String Populations

    get recommendListEmpty() {
        return !this.newMappings || this.newMappings.length === 0;
    }

    goBack() {
        this.isLoading = true;
        rollbackStatus({ assessmentId: this.assessmentid })
            .then(result => {
                this.dispatchEvent(new CustomEvent("backfrommapping", {}));
                this.isLoading = false;
            })
            .catch(error => {
                console.log("==ERR: ", error);
            });
    }

    get disableFinish() {
        return this.updateSeverity && this.updateSeverity === 'high';
    }
}