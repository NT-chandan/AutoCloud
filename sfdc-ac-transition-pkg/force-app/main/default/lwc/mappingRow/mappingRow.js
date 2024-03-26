import { LightningElement, track, api } from 'lwc';

export default class MappingRow extends LightningElement {

    @api hideDetails = false; //If true, hides the "Show Details" section from this row
    //Schema should be retrieved by the mappingSection or top-level component instead
    @api orgSchema = [];
    @api rowIndex;

    //@track mappingInfo = {"source":"", "destination":"", "fieldMapping":[{"source":"","destination":""}], "recordTypeMapping":[{"source":"","destination":""}]};
    @api mappingInfo;
    @track sourceDef = {"recordTypes":[], "fields":[]};
    @api objectCache = {};

    label = {

    };

    @track isLoading = false;

    connectedCallback(){
        //this.mappingInfo = JSON.parse(JSON.stringify(this.mappingInfo))
    }

    @api
    reset(e){
        var sourceCombobox = this.template.querySelector('lightning-combobox');
        sourceCombobox.value = '';
    }

    optionClicked(e){
        this.isLoading = true;
        new Promise(
            (resolve,reject) => {
              setTimeout(()=> {
                  this.selectRow(e);
                  resolve();
              }, 0);
          }).then(
              () => this.isLoading = false
          );
    }

    /* Combobox Functions */
    selectRow(e){
        var value = e.detail.value;
        this.dispatchEvent(new CustomEvent("sourceselect", {detail: {row: this.rowIndex, value: value}}));
    }

    addRow(e){
        var level = e.target.dataset.level;
        if(level==='recordtype'){
            this.mappingInfo.recordTypeMapping.push({"userGenerated":"true"});
        }else if(level==='field'){
            this.mappingInfo.fieldMapping.push({"userGenerated":"true"});
        }
    }

    removeRow(e){
        var index = e.target.dataset.index;
        var level = e.target.dataset.level;

        if(level==='recordtype'){
            this.mappingInfo.recordTypeMapping.splice(index, 1);
        }else if(level==='field'){
            this.mappingInfo.fieldMapping.splice(index, 1);
        }
    }

    get shouldShowDetails(){
        return this.hideDetails !== true && this.mappingInfo.showDetails;
    }

    /** New Field/RT Modal Actions */
    popupModal(type){

    }

}