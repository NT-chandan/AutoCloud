import { LightningElement, api } from 'lwc';

export default class FieldAnalysisSection extends LightningElement {

    @api encryptionData = [];
    @api fieldAuditData = [];
    @api label = {}
    @api encryptionColumns = [];
    @api fieldAuditColumns = [];
    
    get hasEncryptionData() {
        return this.encryptionData && this.encryptionData.length > 0;
    }
    get hasFieldAuditData() {
        return this.fieldAuditData && this.fieldAuditData.length > 0;
    }
}