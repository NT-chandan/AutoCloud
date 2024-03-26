/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class PicklistUtility {

    @AuraEnabled( cacheable = true )
    public static List<ComboboxValue> getComboboxValues(List<SchemaService.SchemaItem> schemaItems) {

        List<ComboboxValue> values = new List<ComboboxValue>();

        for(SchemaService.SchemaItem schemaItem : schemaItems){
            if( schemaItem instanceOf SchemaService.RecordTypeModel){
                values.add( new ComboboxValue((SchemaService.RecordTypeModel)schemaItem) );
            } else if( schemaItem instanceOf SchemaService.FieldModel){
                values.add( new ComboboxValue((SchemaService.FieldModel)schemaItem) );
            } else {
                values.add( new ComboboxValue(schemaItem));
            }

        }

        values.sort();

        return values;
    }

    public class ComboboxValue implements Comparable{
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String value;

        //Optional values
        @AuraEnabled
        public String dataType;

        public ComboboxValue( Schema.PicklistEntry picklistEntry ) {
            this.label = picklistEntry.getLabel();
            this.value = picklistEntry.getValue();
        }

        public ComboboxValue( String value, String label ) {
            this.label = label;
            this.value = value;
        }

        public ComboboxValue(SchemaService.SchemaItem schemaItem){
            this.label = schemaItem.label;
            this.value = schemaItem.value;
        }

        public ComboboxValue(SchemaService.RecordTypeModel schemaItem){
            this.label = String.format('{0} (Total: {1})', new List<Object>{
                schemaItem.label,
                schemaItem.recordCount
            });
            this.value = schemaItem.value;
        }

        public ComboboxValue(SchemaService.FieldModel schemaItem){
            String dataType = (schemaItem.type.isAllUpperCase()) ? schemaItem?.type.toLowerCase().capitalize() : schemaItem.type;
            this.label = String.format('{0} ({1})', new List<String>{
                schemaItem.label,
                dataType
            });
            //Modify reference fields if needed
            if(dataType.equals(System.Label.DataTypeMasterDetail)){
                this.dataType = dataType.replace('-','');
            }else if(dataType.equals(System.Label.DataTypeLookup)){
                this.dataType = dataType.substring(0, dataType.indexOf(' '));
            }else{
                this.dataType = dataType;
            }
            this.value = schemaItem.value;
        }

        public ComboboxValue( MappingService.ObjectMapping objectMapping ) {
            // TODO? Assuming "Destination" is the FSC object, and "Source" is the current org
            this.label = objectMapping.destinationObjectLabel;
            this.value = objectMapping.destinationObject;
        }


        public ComboboxValue( MappingService.MappingItem mappingItem ) {
            // TODO? Assuming "Destination" is the FSC object, and "Source" is the current org
            this.label = mappingItem.destinationLabel;
            this.value = mappingItem.destination;
        }

        public Integer compareTo(Object compareTo) {
            ComboboxValue compareToConfig = (ComboboxValue) compareTo;
            if (label == compareToConfig.label) return 0;
            if (label > compareToConfig.label) return 1;
            return -1;
        }
    }
}