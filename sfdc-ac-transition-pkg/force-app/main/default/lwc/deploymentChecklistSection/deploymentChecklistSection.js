import { LightningElement, api } from 'lwc';

const COLUMN_URL = 'componentUrl';
const COLUMN_NAME = 'componentLabel';
const SECTION_RELATIONSHIPS = 'ChildRelationship';
const TYPE_CUSTOM_FIELD = 'CustomField';
const TYPE_RECORD_TYPE = 'RecordType';
const TYPE_PROFILE = 'Profile';
const TYPE_PERMISSION_SET = 'PermissionSet';

export default class DeploymentChecklistSection extends LightningElement {
    @api columns = [];
    @api sectionData = [];
    @api sectionLabel;
    @api sectionName;
    @api sectionDescription;

    selectedComponents = [];
    selectedChecklistRows = [];
    sortedBy;
    sortDirection;

    connectedCallback() {
        //default checkbox selections on load
        const self = this;
        this.sectionData.forEach(function(item) {
            self.selectedChecklistRows.push(item.componentId);
        });
        //adjust column remove link on new items
        if (this.hideUrl) {
            const columns = JSON.parse(JSON.stringify(this.columns));
            const urlIndex = columns.findIndex(column => column.type === 'url' && column.fieldName === COLUMN_URL);
            if (urlIndex) {
                columns[urlIndex].fieldName = COLUMN_NAME;
                columns[urlIndex].type = 'text';
                delete columns[urlIndex].typeAttributes;
                this.columns = columns;
            }
        }
        //remove last columns source/target
        if (this.hideSourceTarget) {
             this.columns = this.columns.slice(0,-2);
        }
    }

    get hideUrl() {
        return this.sectionName === TYPE_CUSTOM_FIELD || this.sectionName === TYPE_RECORD_TYPE || this.sectionName === SECTION_RELATIONSHIPS;
    }

    get hideSelection() {
        return this.sectionName === TYPE_CUSTOM_FIELD || this.sectionName === TYPE_RECORD_TYPE;
    }

    get hideSourceTarget() {
        return this.sectionName === TYPE_PROFILE || this.sectionName === TYPE_PERMISSION_SET;
    }

    /**
     * Datatable row checkbox selected event handler
     */
    rowSelected(event) {
        //fire event to parent component
		this.dispatchEvent(new CustomEvent('rowselection', { detail: 
            {
                sectionName: this.sectionName,
                selectedRows: event.detail.selectedRows
            }
        }));
    }

    /**
     * COLUMN SORTING FUNCTIONS
     **/
    updateColumnSorting(event) {
        const fieldName = event.detail.fieldName;
        const sortDirection = event.detail.sortDirection;
        const data = JSON.parse(JSON.stringify(this.sectionData));
        this.sortedBy = fieldName;
        this.sortDirection = sortDirection;
        this.sectionData = this.sortData(fieldName, sortDirection, data);
    }

    sortData(fieldName, sortDirection, data) {
        //url correction sort by name
        fieldName = fieldName === COLUMN_URL ? COLUMN_NAME : fieldName;
        const reverse = sortDirection !== 'asc';
        //sorts the rows based on the column header that's clicked
        data.sort(this.sortBy(fieldName, reverse));
        return data;
    }

    sortBy(field, reverse, primer) {
        const key = primer ?
            function(x) {return primer(x[field])} :
            function(x) {return x[field]};
        //checks if the two rows should switch places
        reverse = !reverse ? 1 : -1;
        return function (a, b) {
            // eslint-disable-next-line no-return-assign, no-sequences
            return a = key(a) || "", b = key(b) || "", reverse * ((a > b) - (b > a));
        }
    }
}