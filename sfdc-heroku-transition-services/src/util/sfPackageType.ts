import { ComponentType } from './sfDependencyHelper'

/**
 * Type definition for Package xml
 */
export interface Package {
  types: { members: string[]; name: ComponentType }[]
  version?: string
}

export interface Metadata {
  fullName: string
  label: string
  description?: string
}

/**
 * Type to merge into component xml for CustomObject
 */
export interface CustomObject {
  type: ComponentType
  fields: CustomField[]
  recordTypes: RecordType[]
  fieldSets: FieldSet[]
  compactLayouts: CompactLayout[]
  validationRules: ValidationRule[]
  listViews: ListView[]
}

export interface ValidationRule {
  fullName: string
  active: boolean
  errorConditionFormula: string
  errorDisplayField: string
  errorMessage: string
}

/**
 * RecordType to merge into component xml for CustomObject
 */
export interface RecordType extends Metadata {
  active: string
}

/**
 * CustomField to merge into component xml for CustomObject
 */
export interface CustomField extends Metadata {
  type: string
}

/**
 * FieldSet to merge into component xml
 * https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_fieldset.htm
 */
export interface FieldSet extends Metadata {
  displayedFields?: {
    field: string
    isFieldManaged: boolean
    isRequired: boolean
  }[]
  availableFields?: {
    field: string
    isFieldManaged: boolean
    isRequired: boolean
  }[]
}

/**
 * Type to merge into component xml for Profiles
 */
export interface Profile extends Metadata {
  fieldPermissions: FieldPermission[]
  objectPermissions: ObjectPermission[]
  layoutAssignments: LayoutAssignment[]
  recordTypeVisibilities: ProfileRecordTypeVisibility[]
}

/**
 * Permission Set Type
 */
export interface PermissionSet extends Metadata {
  fieldPermissions: FieldPermission[]
  objectPermissions: ObjectPermission[]
  recordTypeVisibilities: PermissionSetRecordTypeVisibility[]
}

/**
 * ObjectPermission Type to merge into component xml for Profiles or Permission Sets
 */
export interface ObjectPermission {
  object: string
  allowCreate: boolean
  allowDelete: boolean
  allowEdit: boolean
  allowRead: boolean
  viewAllRecords: boolean
  modifyAllRecords: boolean
}

/**
 * FieldPermission Type to merge into component xml for Profiles or Permission Sets
 */
export interface FieldPermission {
  field: string
  editable: boolean
  readable: boolean
}

/**
 * LayoutAssignments Type to merge into component xml for Profiles
 */
export interface LayoutAssignment {
  layout: string
  recordType?: string
}

/**
 * RecordTypeVisibility Type to merge into component xml for Profiles
 */

export interface ProfileRecordTypeVisibility {
  recordType: string
  visible: boolean
}

/**
 * RecordTypeVisibility Type to merge into component xml for Profiles
 */

export interface PermissionSetRecordTypeVisibility
  extends ProfileRecordTypeVisibility {
  default: boolean
  personAccountDefault?: boolean
}

/**
 * Layout Type to merge into component xml
 */
export interface Layout {
  fullName?: string
  // excludeButtons: string
  // headers: string[]
  layoutSections: LayoutSection[]
  // relatedList: RelatedList[] // note: add back
  // showEmailCheckbox: boolean
  // showHighlightsPanel: boolean
  // showInteractionLogPanel: boolean
  // showRunAssignmentRulesCheckbox: boolean
  // showSubmitAndAttachButton: boolean
}

export interface LayoutSection {
  // customLabel: boolean
  // detailHeading: boolean
  label: string
  layoutColumns: LayoutColumn[] // optional '?' needed for 'delete' operator
  // style: string
}

export interface LayoutColumn {
  layoutItems: LayoutItem[]
}
export interface LayoutItem {
  behavior: string
  field: string
}

export enum LayoutItemBehavior {
  EDIT = 'Edit',
  REQUIRED = 'Required',
}

export interface RelatedList {
  fields: string[]
  relatedList: string
}

/**
 * CompactLayout Type to merge into component xml
 */
export interface CompactLayout extends Metadata {
  fields?: string[]
}

/**
 * EmailTemplate Type to merge into component xml
 */
export interface EmailTemplate {
  attachments: {
    content: string
    name: string
  }
  available: boolean
  description: string
  encodingKey: string
  name: string
  style: string
  subject: string
  type: string
  uiType: string
}

/**
 * ListView Type to merge into component xml
 */
export interface ListView extends Metadata {
  columns: string[]
  filterScope: string
  filters: {
    field: string
    operation: string
    value: string
  }[]
  language: string
}
