import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

//Apex Classes
import getMeta from '@salesforce/apex/AssessmentConfigController.getMetadataDescribe';
import getSections from '@salesforce/apex/AssessmentConfigController.getReportSections';

import getConfig from '@salesforce/apex/AssessmentConfigController.getReportConfig';
import saveConfig from '@salesforce/apex/AssessmentConfigController.saveReportConfig';

//Custom Labels
import SidebarConfigIntroTabTitle from '@salesforce/label/c.SidebarConfigIntroTabTitle';
import SidebarConfigTitle from '@salesforce/label/c.SidebarConfigTitle';
import SidebarConfigIntroDesc from '@salesforce/label/c.SidebarConfigIntroDesc';
import SidebarConfigIntroTitle from '@salesforce/label/c.SidebarConfigIntroTitle';
import SidebarConfigIntroBegin from '@salesforce/label/c.SidebarConfigIntroBegin';
import SidebarConfigSectionTitle from '@salesforce/label/c.SidebarConfigSectionTitle';
import SidebarConfigMetadataTitle from '@salesforce/label/c.SidebarConfigMetadataTitle';
import SidebarConfigSave from '@salesforce/label/c.SidebarConfigSave';
import SidebarConfigExcludeTitle from '@salesforce/label/c.SidebarConfigExcludeTitle';
import SidebarConfigExcludeSection from '@salesforce/label/c.SidebarConfigExcludeSection';
import SidebarConfigExcludeMetadata from '@salesforce/label/c.SidebarConfigExcludeMetadata';
import SidebarConfigSectionTableKey from '@salesforce/label/c.SidebarConfigSectionTableKey';
import SidebarConfigMetadataTableKey from '@salesforce/label/c.SidebarConfigMetadataTableKey';
import SidebarConfigNone from '@salesforce/label/c.SidebarConfigNone';

import ToastTitleSuccess from '@salesforce/label/c.ToastTitleSuccess';
import ToastTitleError from '@salesforce/label/c.ToastTitleError';
import ToastMessageConfigSuccess from '@salesforce/label/c.ToastMessageConfigSuccess';
import ToastMessageConfigError from '@salesforce/label/c.ToastMessageConfigError';

export default class ConfigSidebar extends LightningElement {

    @track isLoading = false;
    @track showConfig = true;

    label = {
        SidebarConfigIntroTabTitle,
        SidebarConfigTitle,
        SidebarConfigIntroDesc,
        SidebarConfigSectionTitle,
        SidebarConfigMetadataTitle,
        SidebarConfigSave,
        SidebarConfigExcludeTitle,
        SidebarConfigExcludeSection,
        SidebarConfigExcludeMetadata,
        SidebarConfigSectionTableKey,
        SidebarConfigMetadataTableKey,
        ToastTitleSuccess,
        ToastTitleError,
        ToastMessageConfigSuccess,
        ToastMessageConfigError,
        SidebarConfigIntroTitle,
        SidebarConfigIntroBegin,
        SidebarConfigNone
    };

    reportSectionColumns = [
        { label: this.label.SidebarConfigSectionTableKey, fieldName: 'name' },
    ];

    reportSectionData = [];

    @track includedSections = [];
    @track excludedSections = [];
    @track summarySections = [];
    @track currentSelectedSections = [];

    metadataSectionColumns = [
        { label: this.label.SidebarConfigMetadataTableKey, fieldName: 'name' },
    ];

    metadataSectionData = [];

    @track includedMetadata = [];
    @track excludedMetadata = [];
    @track summaryMetadata = [];
    @track currentSelectedMetadata = [];

    connectedCallback() {
        this.isLoading = true;
        getConfig()
            .then(result => {
                this.excludedSections = new Set([...result.ExcludedSections]);
                this.excludedMetadata = new Set([...result.ExcludedMetadata]);

                //METADATA
                getMeta()
                    .then(result => {
                        this.metadataSectionData = result.metadataList;

                        //Iterate through Metadata and set boxes accordingly
                        result.metadataList.forEach(metaItem => {
                            if (!this.excludedMetadata.has(metaItem.name)) {
                                this.includedMetadata.push(metaItem.name);
                            } else {
                                this.summaryMetadata.push(metaItem);
                            }
                        });

                        //REPORT SECTIONS
                        getSections()
                            .then(result => {
                                this.reportSectionData = result;

                                //Iterate through Sections and set boxes accordingly
                                result.forEach(sectionItem => {
                                    if (!this.excludedSections.has(sectionItem.apiName)) {
                                        this.includedSections.push(sectionItem.apiName);
                                    } else {
                                        this.summarySections.push(sectionItem);
                                    }
                                });
                                this.currentSelectedSections = [...this.includedSections];
                                this.isLoading = false;
                            })
                            .catch(error => {
                                console.log(error);
                                this.isLoading = false;
                            });
                    })
                    .catch(error => {
                        console.log(error);
                        this.isLoading = false;
                    });
            })
            .catch(error => {
                console.log(error);
                this.isLoading = false;
            });
    }

    collapse() {
        this.showConfig = false;
        this.dispatchEvent(new CustomEvent("collapse"));
    }

    expand() {
        this.showConfig = true;
        this.dispatchEvent(new CustomEvent("expand"));
    }

    checkSelectedSection(e) {
        var reportSummaryKey = 'ReportSummary';
        var finalSelections = [];
        //Special case for Report Summary; if it is deselected, all child sections should also be deselected
        try {
            //Grab and set row key data
            let newlySelectedRows = e.detail.selectedRows;
            var newKeys = new Set(newlySelectedRows.map(row => row.apiName));
            var oldKeys = new Set(this.currentSelectedSections);

            //Check different possible routes involving ReportSummary

            //Gained
            if (!oldKeys.has(reportSummaryKey) && newKeys.has(reportSummaryKey)) {
                //Check all summary sub-boxes
                this.reportSectionData.forEach(possibleRow => {
                    if (possibleRow.apiName.startsWith(reportSummaryKey)) {
                        finalSelections.push(possibleRow.apiName);
                    } else {
                        if (newKeys.has(possibleRow.apiName)) {
                            finalSelections.push(possibleRow.apiName);
                        }
                    }
                });
            }
            //Lost
            else if (oldKeys.has(reportSummaryKey) && !newKeys.has(reportSummaryKey)) {
                //Uncheck all summary sub-boxes
                newlySelectedRows.forEach(row => {
                    if (!row.apiName.startsWith(reportSummaryKey)) {
                        finalSelections.push(row.apiName);
                    }
                });
            } else {
                newlySelectedRows.forEach(newRow => {
                    finalSelections.push(newRow.apiName);
                });
            }

            //Save new selections
            this.currentSelectedSections = finalSelections;
            this.includedSections = finalSelections;

        } catch (e) {
            console.log("==ERROR: " + e);
        }

    }

    saveConfig() {
        this.isLoading = true;
        var summaryToSaveSections = [];
        var summaryToSaveMetadata = [];
        //Grab releveant sections
        const sectionTable = this.template.querySelector('[data-id="sections"]');
        if (sectionTable) {
            this.excludedSections = new Set();
            var checkedSectionSet = new Set();
            sectionTable.getSelectedRows().forEach(sectionRow => {
                checkedSectionSet.add(sectionRow.apiName);
            });

            //Assemble excluded lists
            this.reportSectionData.forEach(sectionItem => {
                if (!checkedSectionSet.has(sectionItem.apiName)) {
                    this.excludedSections.add(sectionItem.apiName);
                    summaryToSaveSections.push(sectionItem);
                } else {
                    console.log("HAS " + sectionItem.apiName);
                }
            });
        }

        //Grab releveant metadata
        const metaTable = this.template.querySelector('[data-id="meta"]');
        if (metaTable) {
            this.excludedMetadata = new Set();
            var checkedMetaSet = new Set();
            metaTable.getSelectedRows().forEach(metaRow => {
                checkedMetaSet.add(metaRow.name);
            });

            //Assemble excluded lists
            this.metadataSectionData.forEach(metaItem => {
                if (!checkedMetaSet.has(metaItem.name)) {
                    this.excludedMetadata.add(metaItem.name);
                    summaryToSaveMetadata.push(metaItem);
                }
            });
        }

        saveConfig({ sections: Array.from(this.excludedSections), meta: Array.from(this.excludedMetadata) })
            .then(result => {
                if (result === 'Success') {
                    //Show Toast
                    const evt = new ShowToastEvent({
                        message: 'Report Configuration Saved Successfully',
                        variant: 'success',
                    });
                    this.dispatchEvent(evt);
                    if (summaryToSaveSections && summaryToSaveSections.length > 0) {
                        this.summarySections = summaryToSaveSections;
                    }

                    if (summaryToSaveMetadata && summaryToSaveMetadata.length > 0) {
                        this.summaryMetadata = summaryToSaveMetadata;
                    }
                } else {
                    //Show that an error occurred
                    const evt = new ShowToastEvent({
                        message: 'An error occurred. Please try again later',
                        variant: 'error',
                    });
                    this.dispatchEvent(evt);
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.log(error);
            });
    }

    beginClicked() {
        this.template.querySelector('lightning-tabset').activeTabValue = 'sections';
    }

    get hasSections() {
        return this.summarySections.length > 0;
    }

    get hasMetadata() {
        return this.summaryMetadata.length > 0;
    }
}