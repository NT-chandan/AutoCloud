import { LightningElement, api, track } from 'lwc';

export default class AssessmentDatatableSubTable extends LightningElement {
    @api columnDataList;
    @api columnList;
    @api titleList;
    @api iconList;

    sortedBy; //='Name';
    defaultSortDirection = 'asc';
    sortDirection = 'asc';

    @track tableInfoList = [];
    @track showTable = false;
    connectedCallback() {
        if (this.columnList && this.columnDataList) {
            this.columnDataList = JSON.parse(JSON.stringify(this.columnDataList))
            this.columnList = JSON.parse(JSON.stringify(this.columnList))
            for (let index = 0; index < this.columnDataList.length; index++) {
                let tableInfo = {};
                tableInfo.columns = this.columnList[index];
                tableInfo.data = this.columnDataList[index];
                if (tableInfo.data && tableInfo.data.length) {
                    tableInfo.renderTable = true;
                }
                tableInfo.title = this.titleList[index];
                tableInfo.icon = this.iconList[index];
                tableInfo.key = index;
                for (let subIndex = 0; subIndex < tableInfo.data.length; subIndex++) {
                    tableInfo.data[subIndex].tableKey = subIndex;
                }
                this.tableInfoList.push(tableInfo);
            }
            this.showTable = true;
        }
    }

    onHandleSort(event) {
        const { fieldName, sortDirection } = event.detail;

        this.sortedBy = fieldName;
        this.sortDirection = sortDirection;

        const cloneData = [...this.tableInfo.data];
        // sort the data using example code 
        // in https://developer.salesforce.com/docs/component-library/bundle/lightning-datatable/example
        //cloneData.sort( this.sortBy( sortedBy, sortDirection === 'asc' ? 1 : -1 ) );
        //this.tableInfo.data = cloneData;
    }
}