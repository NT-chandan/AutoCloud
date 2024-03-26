import { LightningElement, api } from 'lwc';

// Importing custom labels
// Importing custom labels
import assessmentResultsEmptyTable from '@salesforce/label/c.AssessmentResultsEmptyTable'
import tableHeaderName from '@salesforce/label/c.ReportSummaryTableName'
import tableHeaderRecordCount from '@salesforce/label/c.ReportSummaryTableRecordCount'
import tableHeaderCustomRecordTypes from '@salesforce/label/c.ReportSummaryTableCustomRecordTypes'
import tableHeaderProfilesAssigned from '@salesforce/label/c.ReportSummaryTableProfilesAssigned'
import tableHeaderRecordsModified from '@salesforce/label/c.ReportSummaryTableRecordsModified'
import tableHeaderRecommendation from '@salesforce/label/c.ReportSummaryTableRecommendation'
import tableHeaderFeatureTransition from '@salesforce/label/c.ReportSummaryTableFeatureTransition'
import tableHeaderGoal from '@salesforce/label/c.ReportSummaryTableGoal'
import tableHeaderEffort from '@salesforce/label/c.ReportSummaryTableEffort'
import tableHeaderRelatedObjects from '@salesforce/label/c.ReportSummaryTableRelatedObjects'
import tableHeaderItemTypes from '@salesforce/label/c.ReportSummaryTableItemTypes'
import tableHeaderNumberOfItems from '@salesforce/label/c.ReportSummaryTableNumberOfItems'
import tableHeaderNotes from '@salesforce/label/c.ReportSummaryTableNotes'
import recommendationTextPrefix from '@salesforce/label/c.ReportSummaryRecommendationPrefix'
import recommendationTextSuffix from '@salesforce/label/c.ReportSummaryRecommendationSuffix'
import featureReasonDefault from '@salesforce/label/c.FeatureReasonDefault'
import featureReasonDefaultReportSummary from '@salesforce/label/c.FeatureReasonDefaultReportSummary'
import featureReasonActionPlan from '@salesforce/label/c.FeatureReasonActionPlan'
import featureReasonActionPlanReportSummary from '@salesforce/label/c.FeatureReasonActionPlanReportSummary'
import featureReasonLifeEvents from '@salesforce/label/c.FeatureReasonLifeEvents'
import featureReasonLifeEventsReportSummary from '@salesforce/label/c.FeatureReasonLifeEventsReportSummary'
import overviewLicenses from '@salesforce/label/c.ReportSummaryOverviewLicenses'
import overviewLicensesAssigned from '@salesforce/label/c.ReportSummaryOverviewLicensesAssigned'
import overviewProfiles from '@salesforce/label/c.ReportSummaryOverviewProfiles'
import overviewRoles from '@salesforce/label/c.ReportSummaryOverviewRoles'
import overviewFlows from '@salesforce/label/c.ReportSummaryOverviewFlows'
import overviewProcessBuilderFlows from '@salesforce/label/c.ReportSummaryOverviewProcessBuilder'
import overviewWorkflows from '@salesforce/label/c.ReportSummaryOverviewWorkflows'
import overviewQueues from '@salesforce/label/c.ReportSummaryOverviewQueues'
import overviewEmailToCase from '@salesforce/label/c.ReportSummaryOverviewEmailToCase'
import overviewCustomObjects from '@salesforce/label/c.ReportSummaryOverviewCustomObjects'
import overviewApexTriggers from '@salesforce/label/c.ReportSummaryOverviewTriggers'
import overviewApexClasses from '@salesforce/label/c.ReportSummaryOverviewClasses'
import overviewCustomApps from '@salesforce/label/c.ReportSummaryOverviewApps'
import overviewDataStorage from '@salesforce/label/c.ReportSummaryOverviewDataStorage'
import overviewFileStorage from '@salesforce/label/c.ReportSummaryOverviewFileStorage'
import overviewEnabledFeatures from '@salesforce/label/c.ReportSummaryOverviewEnabledFeatures'
import recommendedSettingsMultipleAccounts from '@salesforce/label/c.ReportSummarySettingsMultipleAccount'
import recommendedSettingsLEX from '@salesforce/label/c.ReportSummarySettingsLEX'
import recommendedSettingsPersonAccounts from '@salesforce/label/c.ReportSummarySettingsPersonAccounts'
import recommendedSettingsFeaturePackage from '@salesforce/label/c.ReportSummarySettingsFeaturePackage'
import recommendedSettingsFeaturePackageLicenses from '@salesforce/label/c.ReportSummarySettingsFeaturePackageLicenses'
import permissionsProfiles from '@salesforce/label/c.ReportSummaryPermissionsProfiles'
import permissionsProfilesLegacy from '@salesforce/label/c.ReportSummaryPermissionsProfilesLegacy'
import permissionsPermissionSets from '@salesforce/label/c.ReportSummaryPermissionsPermissionSets'
import permissionsPermissionSetsLegacy from '@salesforce/label/c.ReportSummaryPermissionsPermissionSetsLegacy'
import generalObjectMappingDisclaimer from '@salesforce/label/c.ReportSummaryObjectMappingDisclaimer'
import personAccountDisclaimer from '@salesforce/label/c.ReportSummaryPersonAccountDisclaimer'
import mappedObjects from '@salesforce/label/c.ReportSummaryMappedObjects'
import totalObjects from '@salesforce/label/c.ReportSummaryTotalObjects'
import mappedFields from '@salesforce/label/c.ReportSummaryMappedFields'
import totalFields from '@salesforce/label/c.ReportSummaryTotalFields'
import averageFields from '@salesforce/label/c.ReportSummaryAverageFields'
import relatedNotMapped from '@salesforce/label/c.ReportSummaryRelatedNotMapped'
import coreNotableUsedObjects from '@salesforce/label/c.ReportSummaryCoreNotableObjects'
import additionalNotableUsedObjects from '@salesforce/label/c.ReportSummaryAdditionalNotableObjects'

export default class ReportSummary extends LightningElement {

    // Properties to hold incoming data from the top-level component
    @api reportsummarydata;
    @api section;

    // Property to hold the re-parsed section data
    @api reportSummarySection;
    reportSummarySubsections = []

    // TODO: Finish populating this list with the above imported custom labels
    label = {
        assessmentResultsEmptyTable,
        tableHeaderName,
        tableHeaderRecordCount,
        tableHeaderCustomRecordTypes,
        tableHeaderProfilesAssigned,
        tableHeaderRecordsModified,
        tableHeaderRecommendation,
        tableHeaderFeatureTransition,
        tableHeaderGoal,
        tableHeaderEffort,
        tableHeaderRelatedObjects,
        tableHeaderItemTypes,
        tableHeaderNumberOfItems,
        tableHeaderNotes,
        recommendationTextPrefix,
        recommendationTextSuffix,
        featureReasonDefault,
        featureReasonDefaultReportSummary,
        featureReasonActionPlan,
        featureReasonActionPlanReportSummary,
        featureReasonLifeEvents,
        featureReasonLifeEventsReportSummary,
        overviewLicenses,
        overviewLicensesAssigned,
        overviewProfiles,
        overviewRoles,
        overviewFlows,
        overviewProcessBuilderFlows,
        overviewWorkflows,
        overviewQueues,
        overviewEmailToCase,
        overviewCustomObjects,
        overviewApexTriggers,
        overviewApexClasses,
        overviewCustomApps,
        overviewDataStorage,
        overviewFileStorage,
        overviewEnabledFeatures,
        recommendedSettingsMultipleAccounts,
        recommendedSettingsLEX,
        recommendedSettingsPersonAccounts,
        recommendedSettingsFeaturePackage,
        recommendedSettingsFeaturePackageLicenses,
        permissionsProfiles,
        permissionsProfilesLegacy,
        permissionsPermissionSets,
        permissionsPermissionSetsLegacy,
        generalObjectMappingDisclaimer,
        personAccountDisclaimer,
        mappedObjects,
        totalObjects,
        mappedFields,
        totalFields,
        averageFields,
        relatedNotMapped,
        coreNotableUsedObjects,
        additionalNotableUsedObjects
    };

    /**
     * GETTERS for conditional display
     */
    get hasCoreNotableObjectsData() {
        return this.reportsummarydata.coreNotableObjects && this.reportsummarydata.coreNotableObjects.length > 0;
    }
    get hasAdditionalNotableObjectsData() {
        return this.reportsummarydata.additionalNotableObjects && this.reportsummarydata.additionalNotableObjects.length > 0;
    }
    get hasEnabledFeatures() {
        return this.reportsummarydata.enabledChatFeatures && this.reportsummarydata.enabledChatFeatures.length > 0;
    }
    get hasNotableObjectsData() {
        return this.reportsummarydata.notableObjects && this.reportsummarydata.notableObjects.length > 0;
    }
    get hasBasisOfAssessmentData() {
        return this.reportsummarydata.basisOfAssessment && this.reportsummarydata.basisOfAssessment.length > 0;
    }
    get hasMigrationAnalysisData() {
        return this.reportsummarydata.migrationAnalysis && this.reportsummarydata.migrationAnalysis.length > 0;
    }

    // Columns for data tables on the executive summary
    notableObjectsColumns = [
        { label: this.label.tableHeaderName, fieldName: 'objectName', type: 'text' },
        { label: this.label.tableHeaderRecordCount, fieldName: 'recordCount', type: 'number' },
        { label: this.label.tableHeaderCustomRecordTypes, fieldName: 'allRecordTypes', type: 'text', wrapText: true },
        { label: this.label.tableHeaderProfilesAssigned, fieldName: 'allProfiles', type: 'text', wrapText: true },
        { label: this.label.tableHeaderRecordsModified, fieldName: 'modifiedRecords', type: 'number' }
    ];
    basisOfAssessmentColumns = [
        { label: this.label.tableHeaderRecommendation, fieldName: 'recommendation', type: 'text', wrapText: true, typeAttributes: { linkify: true } },
        { label: this.label.tableHeaderFeatureTransition, fieldName: 'featureUrl', type: 'url', typeAttributes: { target: "_blank", label: { fieldName: 'feature' } } },
        { label: this.label.tableHeaderGoal, fieldName: 'goal' }
    ];
    migrationAnalysisColumns = [
        { label: this.label.tableHeaderRecommendation, fieldName: 'recommendation', type: 'text', wrapText: 'true' },
        { label: this.label.tableHeaderEffort, fieldName: 'effort', type: 'text' },
        { label: this.label.tableHeaderRelatedObjects, fieldName: 'objectName', type: 'text' },
        { label: this.label.tableHeaderItemTypes, fieldName: 'itemType', type: 'text' },
        { label: this.label.tableHeaderNumberOfItems, fieldName: 'itemCount', type: 'text' }
    ];

    connectedCallback() {


        // Loop through all Report Summary subsections and set their relevant variables

        this.reportSummarySection = JSON.parse(JSON.stringify(this.section));
        this.reportsummarydata = JSON.parse(JSON.stringify(this.reportsummarydata));

        for (let subsection of this.reportSummarySection.subsections) {
            // Default all subsections to show their full content from their labels
            subsection.showContent = true;

            this.reportSummarySubsections.push(subsection);
            subsection.subtitle = subsection.title;

            switch (subsection.name.toLowerCase()) {
                case ('reportsummaryunderstandingthisreport'):
                    subsection.isUnderstandingThisReportSection = true;
                    subsection.showContent = false;
                    break;
                case ('reportsummarytoc'):
                    subsection.isTOCSection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummarysystemoverview'):
                    subsection.isSystemOverviewSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummarytransitionapproach'):
                    subsection.isTransitionApproachSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummaryusedobjects'):
                    subsection.isNotableUsedObjectsSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummaryrecommendedsettings'):
                    subsection.isRecommendedSettingsSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummarybasisofassessment'):
                    subsection.isBasisOfAssessmentSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummarymigrationanalysis'):
                    subsection.isMigrationAnalysisSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                case ('reportsummaryconsiderations'):
                    subsection.isConsiderationsSubsection = true;
                    subsection.title = null;
                    this.reportSummarySubsections.push(subsection);
                    break;
                default:
                    subsection.isDefaultSection = true;
            }
        }

        // Check each recommendation in Major Considerations and truncate their lists down if there are more than 5
        try {
            for (let recommendation of this.reportsummarydata.recommendations) {
                if (recommendation.reasons.length > 5) {
                    let shortList = recommendation.reasons.slice(0, 4);

                    let message = {
                        'description': null,
                        'hasDescription': false,
                        'reason': this.label.recommendationTextPrefix + ' ' + recommendation.reasons.length + ' ' + this.label.recommendationTextSuffix,
                        'title': null
                    }

                    // Replace the list of recommendations with the truncated list
                    recommendation.reasons = shortList;

                    // Add our message to the truncated list
                    recommendation.reasons.push(message);
                }
            }
        } catch (e) {
            console.log(e);
        }

    }

    /**
    * Initiate request to generate and download the Report Summary as PDF
    */
    @api
    async downloadPdf() {

        console.log('Downloading the Report Summary');
        // TODO: Add function to pass event to the parent LWC, have it change pdfMode to 'summary', then fire the generation of PDF with the mode included on the header
        // NOTE: pdfMode on the parent LWC should be reset to 'full' after the event has fired
    }

}