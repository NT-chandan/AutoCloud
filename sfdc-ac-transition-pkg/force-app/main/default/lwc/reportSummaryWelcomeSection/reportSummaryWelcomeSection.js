import { LightningElement } from 'lwc';

// Importing custom labels
import whatsInHeader from '@salesforce/label/c.ReportSummaryWelcomeWhatsInHeader'
import whatsInText from '@salesforce/label/c.ReportSummaryWelcomeWhatsIn'
import whatsInTextNote from '@salesforce/label/c.ReportSummaryWelcomeWhatsInNote'
import howToUseHeader from '@salesforce/label/c.ReportSummaryWelcomeHowToUseHeader'
import howToUseText from '@salesforce/label/c.ReportSummaryWelcomeHowToUse'
import bestPracticeHeader from '@salesforce/label/c.ReportSummaryWelcomeBestPracticeHeader'
import bestPracticeText from '@salesforce/label/c.ReportSummaryWelcomeBestPracticeSummary'
import impactScaleHeader from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleHeader'
import impactScaleSolution from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleSolution'
import impactScaleApproval from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleApproval'
import impactScaleReview from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleReview'
import impactScaleWarning from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleWarning'
import impactScaleClose from '@salesforce/label/c.ReportSummaryWelcomeImpactScaleClose'
import accelerateHeader from '@salesforce/label/c.ReportSummaryWelcomeAccelerateHeader'
import accelerateText from '@salesforce/label/c.ReportSummaryWelcomeAccelerate'
import workInFSCLink from '@salesforce/label/c.ReportSummaryWelcomeLinkWorkInFSC'
import workInFSCLinkText from '@salesforce/label/c.ReportSummaryWelcomeLinkWorkInFSCText'
import fscSuperbadgeLink from '@salesforce/label/c.ReportSummaryWelcomeLinkFSCSuperbadge'
import fscSuperbadgeLinkText from '@salesforce/label/c.ReportSummaryWelcomeLinkFSCSuperbadgeText'
import learnFromOthersHeader from '@salesforce/label/c.ReportSummaryWelcomeLearnFromOthersHeader'
import learnFromOthersText from '@salesforce/label/c.ReportSummaryWelcomeLearnFromOthers'
import fscLink from '@salesforce/label/c.ReportSummaryWelcomeLinkFSC'
import fscLinkText from '@salesforce/label/c.ReportSummaryWelcomeLinkFSCText'
import userGroupLink from '@salesforce/label/c.ReportSummaryWelcomeLinkFSCUserGroup'
import userGroupLinkText from '@salesforce/label/c.ReportSummaryWelcomeLinkFSCUserGroupText'

export default class ReportSummaryWelcomeSection extends LightningElement {

    // TODO: Finish populating this list with the above imported custom labels
    label = {
        whatsInHeader,
        whatsInText,
        whatsInTextNote,
        howToUseHeader,
        howToUseText,
        bestPracticeHeader,
        bestPracticeText,
        impactScaleHeader,
        impactScaleSolution,
        impactScaleApproval,
        impactScaleReview,
        impactScaleWarning,
        impactScaleClose,
        accelerateHeader,
        accelerateText,
        workInFSCLink,
        workInFSCLinkText,
        fscSuperbadgeLink,
        fscSuperbadgeLinkText,
        learnFromOthersHeader,
        learnFromOthersText,
        fscLink,
        fscLinkText,
        userGroupLink,
        userGroupLinkText
    }
    
}