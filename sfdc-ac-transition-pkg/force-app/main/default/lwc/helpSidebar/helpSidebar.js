import {LightningElement, track,} from 'lwc';
import {SystemLoggerService} from 'c/systemLoggerService';

//custom apex
import getContent from '@salesforce/apex/TransitionReadinessHelp.getHelpContent';

//custom labels
import helpTitle from '@salesforce/label/c.HelpTitle'

export default class HelpSidebar extends LightningElement {

    @track isLoading = false;
    @track mainItems = [];
    @track sideItems = [];
    @track showHelp = true;

    label = {
        helpTitle
    };

    systemLogger;

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    connectedCallback() {
        //load results
        this.isLoading = true;
        getContent()
        .then(result => {
            this.mainItems = result.mainItems;
            this.sideItems = result.sideItems;
            
            this.isLoading = false;
        })
        .catch(error => {
            this.systemLogger.log('Error', error, undefined, 'helpSidebar#connectedCallback');
            this.isLoading = false;
        });
    }

    collapse(){
        this.showHelp = false;
        this.dispatchEvent(new CustomEvent("collapse"));
    }

    expand(){
        this.showHelp = true;
        this.dispatchEvent(new CustomEvent("expand"));
    }
}