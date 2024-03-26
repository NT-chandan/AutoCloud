import { LightningElement, track, api } from 'lwc';
import {SystemLoggerService} from 'c/systemLoggerService';

// Custom Apex
import createSystemLog from '@salesforce/apex/SystemLogger.createLog';

// Custom Labels
import UIConfirmButtonText from '@salesforce/label/c.UIConfirmButtonText';
import UICancelButtonText from '@salesforce/label/c.UICancelButtonText';
import UICloseButtonText from '@salesforce/label/c.UICloseButtonText';
import UINextButtonText from '@salesforce/label/c.UINextButtonText';
import UIBackButtonText from '@salesforce/label/c.UIBackButtonText';
import NewMetaTitleField from '@salesforce/label/c.NewMetaTitleField';
import NewMetaTitleRecordType from '@salesforce/label/c.NewMetaTitleRecordType';
import NewMetaActive from '@salesforce/label/c.NewMetaActive';
import NewMetaApiName from '@salesforce/label/c.NewMetaApiName';
import NewMetaDecimals from '@salesforce/label/c.NewMetaDecimals';
import NewMetaDesc from '@salesforce/label/c.NewMetaDesc';
import NewMetaHelpText from '@salesforce/label/c.NewMetaHelpText';
import NewMetaLabel from '@salesforce/label/c.NewMetaLabel';
import NewMetaLength from '@salesforce/label/c.NewMetaLength';
import NewMetaRequired from '@salesforce/label/c.NewMetaRequired';
import NewMetaUnique from '@salesforce/label/c.NewMetaUnique';
import NewMetaExternalId from '@salesforce/label/c.NewMetaExternalId';
import NewMetaDefaultValue from '@salesforce/label/c.NewMetaDefaultValue';
import NewMetaConnectedObject from '@salesforce/label/c.NewMetaConnectedObject';
import NewMetaConnectedObjectPlaceholder from '@salesforce/label/c.NewMetaConnectedObjectPlaceholder';
import NewMetaChildRelationship from '@salesforce/label/c.NewMetaChildRelationship';

import NewMetaLocationNotation from '@salesforce/label/c.NewMetaLocationNotation';
import NewMetaPicklistValues from '@salesforce/label/c.NewMetaPicklistValues';
import NewMetaVisibleLines from '@salesforce/label/c.NewMetaVisibleLines';
import NewMetaDefaultChecked from '@salesforce/label/c.NewMetaDefaultChecked';
import NewMetaDefaultUnchecked from '@salesforce/label/c.NewMetaDefaultUnchecked';
import NewMetaReviewSummary from '@salesforce/label/c.NewMetaReviewSummary';
import MappingNewMetaApiConflict from '@salesforce/label/c.MappingNewMetaApiConflict';

// Data Type Labels
import DataTypeCheckbox from '@salesforce/label/c.DataTypeCheckbox';
import DataTypeCurrency from '@salesforce/label/c.DataTypeCurrency';
import DataTypeDate from '@salesforce/label/c.DataTypeDate';
import DataTypeDatetime from '@salesforce/label/c.DataTypeDatetime';
import DataTypeEmail from '@salesforce/label/c.DataTypeEmail';
import DataTypeLocation from '@salesforce/label/c.DataTypeLocation';
import DataTypeLongText from '@salesforce/label/c.DataTypeLongText';
import DataTypeLookup from '@salesforce/label/c.DataTypeLookup';
import DataTypeMasterDetail from '@salesforce/label/c.DataTypeMasterDetail';
import DataTypeMultiSelect from '@salesforce/label/c.DataTypeMultiSelect';
import DataTypeNumber from '@salesforce/label/c.DataTypeNumber';
import DataTypePercent from '@salesforce/label/c.DataTypePercent';
import DataTypePhone from '@salesforce/label/c.DataTypePhone';
import DataTypePicklist from '@salesforce/label/c.DataTypePicklist';
import DataTypeRichText from '@salesforce/label/c.DataTypeRichText';
import DataTypeText from '@salesforce/label/c.DataTypeText';
import DataTypeTextArea from '@salesforce/label/c.DataTypeTextArea';
import DataTypeTime from '@salesforce/label/c.DataTypeTime';
import DataTypeUrl from '@salesforce/label/c.DataTypeUrl';
import NewMetaErrorDefaultValue from '@salesforce/label/c.NewMetaErrorDefaultValue';
import NewMetaErrorGeneral from '@salesforce/label/c.NewMetaErrorGeneral';

export default class MappingNewMetaModal extends LightningElement {
    //Boolean tracked variable to indicate if modal is open or not default value is false as modal is closed when page is loaded 
    @track isModalOpen = false;
    @api modalInfo;
    @api orgObjects = [];
    @api
    get preSelectedValue() {
        return this.dataType;
    }

    set preSelectedValue(value) {
       this.dataType = value;
    }

    @track step;

    @track metaLabel = '';
    @track apiName = '';
    @track dataType = '';
    @track description = '';
    @track helpText = '';
    @track rtActive = false;
    @track required = false;
    @track unique = false;
    @track defaultValue = '';
    @track length = '';

    @track connectedObject = '';
    @track childRelationshipName = '';

    systemLogger;

    label = {
        UIConfirmButtonText,
        UICancelButtonText,
        UICloseButtonText,
        UINextButtonText,
        UIBackButtonText,
        NewMetaTitleField,
        NewMetaTitleRecordType,
        NewMetaActive,
        NewMetaApiName,
        NewMetaDecimals,
        NewMetaDesc,
        NewMetaHelpText,
        NewMetaLabel,
        NewMetaLength,
        NewMetaRequired,
        NewMetaUnique,
        NewMetaExternalId,
        NewMetaDefaultValue,
        NewMetaConnectedObject,
        NewMetaConnectedObjectPlaceholder,
        NewMetaChildRelationship,
        DataTypeCheckbox,
        DataTypeCurrency,
        DataTypeDate,
        DataTypeDatetime,
        DataTypeEmail,
        DataTypeLocation,
        DataTypeLongText,
        DataTypeLookup,
        DataTypeMasterDetail,
        DataTypeMultiSelect,
        DataTypeNumber,
        DataTypePercent,
        DataTypePhone,
        DataTypePicklist,
        DataTypeRichText,
        DataTypeText,
        DataTypeTextArea,
        DataTypeTime,
        DataTypeUrl,
        NewMetaLocationNotation,
        NewMetaPicklistValues,
        NewMetaVisibleLines,
        NewMetaDefaultChecked,
        NewMetaDefaultUnchecked,
        NewMetaReviewSummary,
        MappingNewMetaApiConflict,
        NewMetaErrorDefaultValue,
        NewMetaErrorGeneral
    };

    constructor() {
        super();
        this.systemLogger = new SystemLoggerService();
    }

    connectedCallback(){
        this.openModal();
    }

    @api
    openModal() {
        // to open modal set isModalOpen track value as true
        this.isModalOpen = true;
        this.step = (this.isRecordType===true) ? 2 : 1;
    }
    closeModal() {
        this.dispatchEvent(new CustomEvent("closemodal", {}));
        this.step = 0;
    }
    goBack(){
        this.step = (this.isStep3) ? 2 : 1;
    }
    goNext(){
        try{
            var apiNameValid;
            var inputsValid = true;
            if(this.isStep2){
                apiNameValid = [...this.modalInfo.existingValues]
                .reduce((validSoFar, existingValue) => {
                    return validSoFar && this.apiName !== existingValue.value;
                }, true);

                const apiNameField = this.template.querySelector('.apiNameField');
                if(apiNameValid===true){ 
                    apiNameField.setCustomValidity("");
                }else{
                    apiNameField.setCustomValidity(this.label.MappingNewMetaApiConflict);
                }

                if(this.modalInfo.type!=='rt'){
                    inputsValid = this.validateFieldInputs();
                }
            }else{
                apiNameValid = true;
            }
            
            const allValid = [...this.template.querySelectorAll('lightning-input')]
            .reduce((validSoFar, inputCmp) => {
                        inputCmp.reportValidity();
                        return validSoFar && inputCmp.checkValidity();
            }, true);

            const radiosValid = [...this.template.querySelectorAll('lightning-radio-group')]
            .reduce((validSoFar, inputCmp) => {
                        inputCmp.reportValidity();
                        return validSoFar && inputCmp.checkValidity();
            }, true);

            if(allValid && radiosValid && apiNameValid && inputsValid){
                this.step = (this.isStep1) ? 2 : 3;
            }
        }catch(e){
            this.systemLogger.log('Error', e, undefined, 'mappingNewMetaModal#goNext');
        }
        
    }
    saveItem() {
        //Assemble data
        var newMetadata = {};
        newMetadata.label = this.metaLabel;
        newMetadata.apiName = this.apiName;
        newMetadata.description = this.description;
        if(this.modalInfo.type==='rt'){
            newMetadata.active = this.rtActive;
        }else{
            newMetadata.dataType = this.dataType;
            newMetadata.helpText = this.helpText;
            newMetadata.length = this.length;
            newMetadata.required = this.required;
            newMetadata.unique = this.unique;
            newMetadata.defaultValue = this.defaultValue;
            newMetadata.connectedObject = this.connectedObject;
            newMetadata.childRelationshipName = this.childRelationshipName;
        }
        this.dispatchEvent(new CustomEvent("saveandclosemodal", {detail: newMetadata}));    
    }

    //Field Input Validation
    validateFieldInputs(){
        var allValid = true;
        //Check default value
        const defaultField = this.template.querySelector('.defaultField');
        //Type mismatch
        try{
            if(this.defaultValue){
                //Number
                if((this.dataType==='Number') && isNaN(this.defaultValue)){
                    allValid = false;
                }
                //Currency
                if(this.dataType==='Currency'){
                    const re = /^\$?[0-9]+(\.[0-9]{1,2})?$/;
                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    } 
                }
                //Decimal
                if(this.dataType==='Percent'){
                    const re = /^[0-9]+(\.[0-9]+)?%?$/;
                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }  
                }
                //Email
                else if(this.dataType==='Email'){
                    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }
                }
                //Time
                else if(this.dataType==='Time'){
                    const re = /^[0-9][0-2]?:([0-5][0-9]):([0-5][0-9])?(\.?([0-9]?[0-9]?[0-9]?))$/;
                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }      
                }
                //Date
                else if(this.dataType==='Date'){
                    const re = /^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$/;
                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }
                }
                //DateTime
                else if(this.dataType==='DateTime'){
                    const re = /^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])(T[0-9][0-2]?:([0-5][0-9]):([0-5][0-9])?(\.?([0-9]?[0-9]?[0-9]?)))?Z?$/;

                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }
                }
                //Phone
                else if(this.dataType==='Phone'){
                    const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;

                    if(re.test(this.defaultValue)!==true){
                        allValid = false;
                    }
                }
            }
        }catch(e){
            this.systemLogger.log('Error', e, undefined, 'mappingNewMetaModal#validateFieldInputs');
        }

        if(defaultField){
            if(allValid!==true){
                defaultField.setCustomValidity(this.label.NewMetaErrorDefaultValue);
            }else{
                defaultField.setCustomValidity('');
            }

            defaultField.reportValidity();
        }

        //Check Number Fields
        if(this.hasLength){
            const lengthField = this.template.querySelector('.lengthField');
            if(this.length && !(!isNaN(this.length) && Number.isInteger(parseFloat(this.length)))){
                allValid = false;
                lengthField.setCustomValidity(this.label.NewMetaErrorGeneral);
            }else{
                lengthField.setCustomValidity('');
            }

            lengthField.reportValidity();
        }

        return allValid;
    }

    setLabel(e){
        this.metaLabel = e.detail.value;
    }
    setApiName(e){
        this.apiName = e.detail.value;
    }
    setDescription(e){
        this.description = e.detail.value;
    }
    setHelpText(e){
        this.helpText = e.detail.value;
    }
    setDataType(e){
        this.dataType = e.detail.value;
    }
    setActive(e){
        this.rtActive = e.detail.checked;
    }
    setRequired(e){
        this.required = e.detail.checked;
    }
    setUnique(e){
        this.unique = e.detail.checked;
    }
    setDefaultValue(e){
        this.defaultValue = e.detail.value;
    }
    setLength(e){
        this.length = e.detail.value;
    }
    setConnectedObject(e){
        this.connectedObject = e.detail.value;
    }
    setChildRelatonshipName(e){
        this.childRelationshipName = e.detail.value;
    }
    autoSetApiName(e){
        if(!this.apiName){
            var value = e.currentTarget.value;
            this.apiName = value.replaceAll(' ', '_');
        }
    }

    get fieldOptions(){
        return [{ label: this.label.DataTypeCheckbox, value: 'Checkbox'},{ label: this.label.DataTypeCurrency, value: 'Currency'},{ label: this.label.DataTypeDate, value: 'Date'},{ label: this.label.DataTypeDatetime, value: 'DateTime'},{ label: this.label.DataTypeEmail, value: 'Email'},{ label: this.label.DataTypeLocation, value: 'Location'},
        { label: this.label.DataTypeLookup, value: 'Lookup'},{ label: this.label.DataTypeMasterDetail, value: 'MasterDetail'},{ label: this.label.DataTypeNumber, value: 'Number'},{ label: this.label.DataTypePercent, value: 'Percent'},{ label: this.label.DataTypePhone, value: 'Phone'},{ label: this.label.DataTypePicklist, value: 'Picklist'},{ label: this.label.DataTypeMultiSelect, value: 'MultiselectPicklist'},{ label: this.label.DataTypeText, value: 'Text'},
        { label: this.label.DataTypeTextArea, value: 'TextArea'},{ label: this.label.DataTypeLongText, value: 'LongTextArea'},{ label: this.label.DataTypeRichText, value: 'LongTextArea'},{ label: this.label.DataTypeTime, value: 'Time'},{ label: this.label.DataTypeUrl, value: 'Url'}];
    }

    get checkedOptions(){
        return [{ label: this.label.NewMetaDefaultChecked, value: 'true'},{ label: this.label.NewMetaDefaultUnchecked, value: 'false'}]
    }

    get HeaderText(){
        return (this.modalInfo.type==='rt') ? this.label.NewMetaTitleRecordType : this.label.NewMetaTitleField;
    }

    get hasLength(){
        return (this.dataType === 'Text' || this.dataType === 'TextArea' || this.dataType === 'LongTextArea' || this.dataType === 'Number') ? true : false;
    }

    get showConnectedObject(){
        return (this.dataType === 'MasterDetail' || this.dataType === 'Lookup');
    }

    get showRequired(){
        return this.dataType!=='MasterDetail';
    }

    get showUnique(){
        return this.dataType!=='Lookup' && this.dataType!== 'MasterDetail';
    }

    get showDefault(){
        return this.dataType!=='Lookup' && this.dataType!== 'MasterDetail' && this.dataType!=='Location';
    }

    /* Data Type Specific Inputs */
    get showLocationNotation(){
        return this.dataType === 'Location';
    }

    get showVisibleLines(){
        return this.dataType === 'LongTextArea';
    }

    get showBooleanDefaultValue(){
        return this.dataType === 'Checkbox';
    }
    /* General Screen/Input Showing */

    get isRecordType(){
        return this.modalInfo.type==='rt';
    }

    get isStep1(){
        return this.step === 1;
    }

    get isStep2(){
        return this.step === 2;
    }

    get isStep3(){
        return this.step === 3;
    }

    get showBack(){
        return (this.isStep2 && this.modalInfo.type!=='rt') || this.isStep3;
    }
}