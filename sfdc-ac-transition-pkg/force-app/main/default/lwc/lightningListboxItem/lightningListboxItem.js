import { LightningElement, api } from 'lwc';
import { SystemLoggerService } from 'c/systemLoggerService';

export default class LightningListboxItem extends LightningElement {
    /**
     * @attr label 
     * @attr value 
     * @attr type - "category" or "selectable"
     **/
    @api
    item = {};
    systemLogger;

    //Private
    containerClasses = 'slds-media slds-listbox__option slds-listbox__option_plain slds-media_small';

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    selectItem() {
        try {
            if (!this.isCategory) {


                const selectedEvent = new CustomEvent('selected', { detail: this.item });

                // Dispatches the event.
                this.dispatchEvent(selectedEvent);
                this.containerClasses = 'slds-media slds-listbox__option slds-listbox__option_plain slds-media_small slds-is-selected';
            }
        } catch (e) {
            this.systemLogger.log('Error', e, undefined, 'lightningListboxItem#selectItem');
        }
    }

    get isCategory() {
        return this.item.type === 'category';
    }

}