import { LightningElement, api } from 'lwc';

export default class LightningListbox extends LightningElement {
    //PUBLIC
    @api
    loadChildren = false;
    @api
    className = "";
    @api
    label = "";
    @api
    get options() {
        return this.allOptions;
    }

    set options(value) {

        if (value !== undefined) {
            this.allOptions = [...value];
            if (this.currentDefault) {
                this.selectedValue = this.getOptionLabelByValue(this.currentDefault);
                this.oldValue = this.selectedValue;
            }
        }
    }
    /**
     * @attr variant - Any unique properties this components should have (e.g. label-hidden) 
     **/
    @api
    variant = "";
    @api
    placeholder = "";
    @api
    get defaultValue() {
        return this.selectedValue;
    }

    set defaultValue(value) {
        this.currentDefault = value;
        if (!this.currentDefault) {
            this.selectedValue = '';
        } else if (this.allOptions && this.allOptions.length > 0) {
            this.selectedValue = this.getOptionLabelByValue(value);
        }
        this.oldValue = this.selectedValue;
    }

    loadedDefault = false;
    thisClicked = false;
    renderItems = false;
    searchTerm = '';
    searchTimeout;

    //PRIVATE
    currentDefault = '';
    allOptions = [];
    filteredOptions = [];
    listboxClasses = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
    selectedValue = '';
    oldValue = '';
    timeOutId = '';

    handleClick = (e) => {
        if (this.listboxClasses.includes('slds-is-open')) {
            if (this.thisClicked !== true) {
                this.collapse();
            } else {
                this.thisClicked = false;
            }
        }
    };

    //EVENTS
    itemSelected(e) {
        try {
            e.stopPropagation();
            var input = this.template.querySelector('.slds-combobox__input');
            input.value = e.detail.label;
            this.selectedValue = e.detail.label;
            this.oldValue = e.detail.label;
            const selectedEvent = new CustomEvent('selected', { detail: e.detail });

            // Dispatches the event.
            this.dispatchEvent(selectedEvent);
            this.collapse();
        }
        catch (err) {
            console.log('===err===', err)
        }
    }

    clickComponent(e) {
        this.thisClicked = true;
    }

    //FUNCTIONS
    keyPressed(e) {
        try {

            if (e.target.value) {
                var value = e.target.value;
                this.oldValue = this.selectedValue;

                var filteredList = []
                this.allOptions.forEach(option => {
                    if ((option.label.toLowerCase()).includes(value.toLowerCase())) {
                        filteredList.push(option);
                    }
                });
                this.selectedValue = value;
                clearTimeout(this.timeOutId);
                this.timeOutId = setTimeout(() => {
                    this.filteredOptions = filteredList;
                }, 4000)
                //this.filteredOptions = [...filteredList];
            }
        }
        catch (err) {
            console.log('====errrr=======>', err)
        }
    }

    toggleExpand() {
        if (this.listboxClasses.includes('slds-is-open')) {
            this.listboxClasses = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
            this.renderItems = false;
        } else {
            this.listboxClasses = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open';
            this.renderItems = true;
        }
        if (!this.listboxClasses.includes('slds-is-open')) {
            var input = this.template.querySelector('.slds-combobox__input');
            this.selectedValue = this.oldValue;
            input.value = this.selectedValue;
        } else {
            document.addEventListener('click', this.handleClick);
        }
    }

    collapse() {
        this.listboxClasses = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
        this.selectedValue = this.oldValue;
        this.filteredOptions = [];
        document.removeEventListener('click', this.handleClick);
        var scrollBox = this.template.querySelector('.slds-dropdown');
        scrollBox.scrollTop = 0;
    }

    getOptionLabelByValue(value) {
        const foundOption = this.allOptions.find(
            (option) => option.value === value
        );
        if (foundOption) {
            return foundOption.label;
        }
        return '';
    }

    get topLevelClass() {
        return (this.className) ? 'container slds-form-element ' + this.className : 'container slds-form-element';
    }

    get hasVariantLabelHidden() {
        return this.variant && this.variant.includes('label-hidden');
    }

    get hasOptions() {
        return this.allOptions && this.allOptions.length > 0 && (this.renderItems || this.loadChildren);
    }

    get currentList() {
        return (this.filteredOptions && this.filteredOptions.length > 0) ? this.filteredOptions : this.allOptions;
    }
}