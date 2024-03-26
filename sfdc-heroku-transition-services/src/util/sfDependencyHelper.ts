import { SfApi } from './sfApi'
import logger from './logger'
import { MappedObjectsInfo, ReportConfig, shouldProcessMetadata } from './sfMigrationAnalysis'

export enum ComponentType {
  INSTALLED_PACKAGE = 'InstalledPackage',
  CUSTOM_OBJECT = 'CustomObject',
  CUSTOM_FIELD = 'CustomField',
  RECORD_TYPE = 'RecordType',
  LIST_VIEW = 'ListView',
  LIGHTNING_PAGE = 'FlexiPage',
  STANDARD_OBJECT = 'StandardEntity',
  LAYOUT = 'Layout',
  VALIDATION_RULE = 'ValidationRule',
  FIELD_SET = 'FieldSet',
  PERMISSION_SET = 'PermissionSet',
  PROFILE = 'Profile',
  COMPACT_LAYOUT = 'CompactLayout',
  EMAIL_TEMPLATE = 'EmailTemplate',
  EMAIL_TEMPLATE_BODY = 'EmailTemplateBody',
  CHILD_RELATIONSHIP = 'ChildRelationship',
}

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/customobject.htm
export const customObjectTypes: ComponentType[] = [
  ComponentType.RECORD_TYPE,
  ComponentType.CUSTOM_FIELD,
  ComponentType.FIELD_SET,
  ComponentType.COMPACT_LAYOUT,
  ComponentType.VALIDATION_RULE,
  ComponentType.CHILD_RELATIONSHIP, // *technically* it's a CustomField
  ComponentType.LIST_VIEW,
]

export const componentTypeToExtension = new Map([
  [ComponentType.CUSTOM_OBJECT, 'object'],
  [ComponentType.PERMISSION_SET, 'permissionset'],
  [ComponentType.PROFILE, 'profile'],
  [ComponentType.LAYOUT, 'layout'],
  [ComponentType.EMAIL_TEMPLATE, 'email-meta.xml'],
  [ComponentType.EMAIL_TEMPLATE_BODY, 'email'],
])

// ComponentTypes that we dont need to do a jsforce.metadata.retrieve() on since the objects already contain the metadata
export const excludeMetadataRetrieveTypes = [
  ComponentType.RECORD_TYPE,
  ComponentType.CUSTOM_FIELD,
]

// Required fields we can ignore and don't need to map for Permission Set and Profiles
export const ignoredFields = [
  'Name',
  'OwnerId',
  'CreatedDate',
  'CreatedById',
  'LastModifiedDate',
  'LastModifiedById',
  'LastActivityDate',
]

/**
 * Determine if object or field is custom (ends in __c or __pc)
 * @param {string} fullname
 * @returns {boolean}
 */
export function isCustom(fullname: string): boolean {
  return !!fullname.match(/__c$|__pc$/)
}

// Remove ignored fields from a passed in object
export function filterIgnored(
  fieldMapping: Record<string, string>,
): Record<string, string> {
  return Object.entries(fieldMapping).reduce((object, [key, value]) => {
    if (!ignoredFields.some((field) => value.endsWith(`.${field}`)))
      object[key] = value
    return object
  }, {} as Record<string, string>)
}

/**
 *  Converts a Component obj to the appropriate Member string for a package.xml
 * @param {ComponentType} componentType
 * @param {string} sourceObject
 * @param componentName
 * @returns {string} - Ex 'Campaign-Campaign Layout', 'FinServ__FinancialAccount__c.NewBillingStreet__c' exc...
 */
export function componentToMemberType({
  sectionName,
  sourceObject,
  componentName,
  componentId,
}: {
  sectionName: ComponentType
  sourceObject: string
  componentName: string
  componentId: string
}): string {
  if (customObjectTypes.includes(sectionName)) {
    if (sectionName === ComponentType.CHILD_RELATIONSHIP) {
      // We need to parse the sourceObject out
      return `${parseChildRelationship(sourceObject)}.${componentId}`
    } else {
      return `${sourceObject}.${componentName}`
    }
  } else if (sectionName === ComponentType.LAYOUT) {
    return `${sourceObject}-${componentName.replace(
      // Replace ( and ) with %28 and %29
      /[()/*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    )}`
  } else if (
    sectionName === ComponentType.PROFILE ||
    sectionName === ComponentType.PERMISSION_SET ||
    ComponentType.EMAIL_TEMPLATE
  ) {
    return componentName
  } else {
    logger.warn(`Unsupported Component Type: ${sectionName}`)
    return ''
  }
}

/**
 *
 * @param {string} filename Full File Path - example: 'unpackaged/objects/Contact.object'
 * @returns {string} Component Name - example: 'Contact.object'
 */
export function fileNameToComponentName(filename: string): string {
  const componentName = filename.split('/').pop()?.split('.').shift()
  if (!componentName)
    throw Error(`Unable to parse component name from ${filename}`)
  return componentName
}

export interface DeploymentList {
  deployment: Section[]
  mapping: Mapping
}

export interface Section {
  sectionName: ComponentType
  sectionLabel: string
  sectionDescription: string
  components: Component[]
}

export interface Mapping {
  sourceToDestinationRecordType: Record<string, string>
  sourceToDestinationObject: Record<string, string>
  sourceToDestinationField: Record<string, string>
  recordTypeMappings: RecordTypeMapping[]
  objectToRecordTypes: Record<string, string>
  mappedObjects: string[]
  mappedFields: string[]
  fieldMappings: FieldMapping[]
}

export interface RecordTypeMapping {
  value: string
  sourceLabel: string
  source: string
  label: string
  destinationLabel: string
  destination: string
  userGenerated: boolean
  sourceObject: string
  recordTypeId: string
  newMeta: Record<string, unknown>
  master: string
  defaultRecordTypeMapping: string
  available: boolean
}

export interface FieldMapping {
  value: string
  sourceLabel: string
  source: string
  label: string
  destinationLabel: string
  destination: string
  userGenerated: boolean
  type: string
  truncate: boolean
  sourceObject: string
  newMeta: string
}

export interface Component {
  targetObject: string
  sourceObject: string
  newMeta: Record<string, string>
  isNew: boolean
  deployItem: boolean
  componentUrl: string
  componentType: ComponentType
  componentName: string
  componentLabel: string
  componentId: string
}

/**
 * Minimum fields required for the Sections[].Components[].newMeta (after parsed to JSON)
 */
type Metadata = {
  label: string
  apiName: string
}
export interface RecordTypeMeta extends Metadata {
  active: boolean
  description?: string
}

export interface CustomFieldMeta extends Metadata {
  description?: string
  dataType: string
}

export type NewMeta = RecordTypeMeta | CustomFieldMeta

const TOOLING_QUERY_METADATACOMPONENTDEPENDENCY =
  'SELECT MetadataComponentId, MetadataComponentType, MetadataComponentName, MetadataComponentNamespace, RefMetadataComponentId, RefMetadataComponentType, RefMetadataComponentNamespace, RefMetadataComponentName FROM MetadataComponentDependency'

const FILTER_COMPONENT_NAMES_REGEX = ['flexipage:.*']

const FILTER_COMPONENT_TYPES_REGEX = ['.*__mdt$']

/**
 * 
 * @param bulkApiClient 
 * @returns An array of Salesforce MetadataComponentDependency items in Salesforce format
 */
export async function getAllDependenciesBulk(
  bulkApiClient: SfApi,
): Promise<MetadataComponentDependency[]> {
  const dependencies = await bulkApiClient.queryJobWithResults<MetadataComponentDependency>(
    TOOLING_QUERY_METADATACOMPONENTDEPENDENCY,
  )
  logger.debug(
    `[SfDependencyHelper:getAllDependenciesBulk] Fetched ${dependencies.length} dependencies`,
  )
  return dependencies
}

export class SfDependencyHelper {
  instanceUrl: string
  ownedNamespace: string
  constructor(instanceUrl: string, ownedNamespace: string) {
    this.instanceUrl = instanceUrl
    this.ownedNamespace = ownedNamespace
  }

  /**
   * Process flat list of dependency references returned from Dependency API into a tree
   * for a top down representation of org dependencies
   */
  buildDependencyTree(
    dependencies: MetadataComponentDependency[],
    mappedObjectInfo : MappedObjectsInfo,
    config: ReportConfig
  ): MetadataComponent[] {
    const parentComponentMap: Record<string, MetadataComponent> = {}

    logger.debug(
      `[sfDependencyHelper] [buildDependencyTree] Processing ${dependencies.length.toLocaleString()} total MetadataComponentDependency records`,
    )

    // make sure each mapped object has a parent node in the tree
    for (const mappedObjectRecord of mappedObjectInfo.mappedObjectRecords) {
      const longname : string = mappedObjectRecord.QualifiedApiName.replace('__c', '') // sobjects are always uniquely referenced as namespace__objectname (no "__c") when mapped
      const uniqueName : string = mappedObjectRecord.DurableId + '.' + longname // Uniquely identifies parent records w/o "__c". e.g. "Account.Acount" || "01I1F0000044L7X.FSCTransitionDI__Assessment" 
      const existingParent = parentComponentMap[uniqueName]
      if(!existingParent) {
        let currentParent: MetadataComponent
        currentParent = new MetadataComponent(
          mappedObjectRecord.DurableId,
          mappedObjectRecord.DurableId.startsWith('01I') ? 'CustomObject' : 'StandardEntity',
          mappedObjectRecord.DeveloperName, // need the name without the namespace or "__c" to mimic dependency API results (namespace is added to the longname in MetadataComponent constructor)
          mappedObjectRecord.NamespacePrefix || '',
        )
        if(shouldProcessMetadata(config, currentParent.Type)){
          parentComponentMap[uniqueName] = currentParent
        }
        logger.debug(`mappedObjectRecord.DeveloperName: ${mappedObjectRecord.DeveloperName}, currentParent: ${JSON.stringify(currentParent)}`)
      } else {
        logger.debug(`mappedObjectRecord.DeveloperName: ${mappedObjectRecord.DeveloperName}, existingParent: ${JSON.stringify(existingParent.Name)}/${JSON.stringify(existingParent.Longname)}/${JSON.stringify(existingParent.Namespace)}`)
      }
    }

    for (const dependency of dependencies) {
      let currentParent: MetadataComponent
      let child: MetadataComponent
      //determine parent or child types
      if (dependency.RefMetadataComponentType === ComponentType.CUSTOM_OBJECT || dependency.RefMetadataComponentType === ComponentType.STANDARD_OBJECT) {
        // if(dependency.MetadataComponentNamespace || dependency.RefMetadataComponentNamespace) logger.debug(`sobject dependency.MetadataComponentNamespace: ${JSON.stringify(dependency)}`)
        currentParent = new MetadataComponent(
          dependency.RefMetadataComponentId,
          dependency.RefMetadataComponentType,
          dependency.RefMetadataComponentName,
          dependency.RefMetadataComponentNamespace,
        )
        child = new MetadataComponent(
          dependency.MetadataComponentId,
          dependency.MetadataComponentType,
          dependency.MetadataComponentName,
          dependency.MetadataComponentNamespace,
        )
      } else {
        // if(dependency.MetadataComponentNamespace || dependency.RefMetadataComponentNamespace) logger.debug(`component dependency.MetadataComponentNamespace: ${JSON.stringify(dependency)}`)
        currentParent = new MetadataComponent(
          dependency.MetadataComponentId,
          dependency.MetadataComponentType,
          dependency.MetadataComponentName,
          dependency.MetadataComponentNamespace && dependency.MetadataComponentNamespace != '' ? dependency.MetadataComponentNamespace : dependency.RefMetadataComponentNamespace,
        )
        child = new MetadataComponent(
          dependency.RefMetadataComponentId,
          dependency.RefMetadataComponentType,
          dependency.RefMetadataComponentName,
          dependency.RefMetadataComponentNamespace && dependency.RefMetadataComponentNamespace != '' ? dependency.RefMetadataComponentNamespace : dependency.MetadataComponentNamespace,
        )
      }
      
      //set base urls
      currentParent.Url = this.instanceUrl + currentParent.Url
      child.Url = this.instanceUrl + child.Url

      //discard any components we don't need to process
      if (this.doFilter(currentParent) || this.doFilter(child)) {
        continue
      }

      //determine parent to group children
      // When the currentParent is NOT a Custom or Standard object, the currentParent longname is derived from the MetadataComponentName, therefore...
      // use a unique name to prevent existing parentComponentMap items from matching other parent dependency API records with the same longname
      const uniqueName : string = currentParent.Id + '.' + currentParent.Longname // Uniquely identifies parent records w/o "__c". e.g. "Account.Acount" || "01I1F0000044L7X.FSCTransitionDI__Assessment" 
      const existingParent = parentComponentMap[uniqueName]
      if (!existingParent) {
        if(shouldProcessMetadata(config, currentParent.Type)){
          parentComponentMap[uniqueName] = currentParent
        }
      } else {
        currentParent = existingParent
      }
      
      if (!currentParent.ChildKeys.has(child.Longname)) {
        if(shouldProcessMetadata(config, child.Type)){
          currentParent.ChildKeys.add(child.Longname)
          child.Parent = currentParent
          currentParent.Children.push(child)
        }
        
      }
    }

    return Object.values(parentComponentMap)
  }

  /**
   * Return true if component should be filtered out of processing or results
   */
  doFilter(component: MetadataComponent): boolean {
    let doFilter = false
    //filter this package components out of subscriber org results
    if (this.ownedNamespace && this.ownedNamespace === component.Namespace) {
      doFilter = true
    }

    //filter specific component types
    if (!doFilter) {
      for (const regexPattern of FILTER_COMPONENT_TYPES_REGEX) {
        if (new RegExp(regexPattern).test(component.Type)) {
          doFilter = true
          break
        }
      }
    }

    //filter specific component names
    if (!doFilter) {
      for (const regexPattern of FILTER_COMPONENT_NAMES_REGEX) {
        if (new RegExp(regexPattern).test(component.Name)) {
          doFilter = true
          break
        }
      }
    }
    return doFilter
  }
}

/**
 * see https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_metadatacomponentdependency.htm
 */
export interface MetadataComponentDependency {
  MetadataComponentId: string
  MetadataComponentType: string
  MetadataComponentName: string
  MetadataComponentNamespace: string
  RefMetadataComponentId: string
  RefMetadataComponentType: string
  RefMetadataComponentName: string
  RefMetadataComponentNamespace: string
}

export class MetadataComponent {
  Id: string
  Type: string
  Name: string
  Namespace: string
  Longname: string
  ParentObjectId? : string
  ParentObjectName? : string
  Children: MetadataComponent[]
  ChildKeys: Set<string>
  Parent?: MetadataComponent
  Url?: string
  constructor(Id: string, Type: string, Name: string, Namespace: string) {
    this.Id = Id
    this.Type = Type
    this.Name = Name
    this.Namespace = Namespace
    //Longname
    if(this.Namespace){
      this.Longname = (this.Type === 'ApexClass' || this.Type === 'ApexTrigger') ? this.Namespace + '.' + this.Name : this.Namespace + '__' + this.Name
    }else{
      this.Longname = this.Name
    }
    this.ChildKeys = new Set<string>()
    this.Children = []
    this.setUrl()
  }

  setUrl(): void {
    switch (this.Type) {
      case 'CustomObject': {
        this.Url = `/lightning/setup/ObjectManager/${this.Id}/Details/view`
        break
      }
      case 'ApexClass': {
        this.Url = `/lightning/setup/ApexClasses/page?address=%2F${this.Id}`
        break
      }
      case 'ApexTrigger': {
        this.Url = `/lightning/setup/ApexTriggers/page?address=%2F${this.Id}`
        break
      }
      case 'CompactLayout': {
        this.Url = `/lightning/setup/ObjectManager/${this.ParentObjectId}/CompactLayouts/${this.Id}/`
        break
      }
      case 'Dashboard': {
        this.Url = (this.Id) ? `/lightning/r/Dashboard/${this.Id}/view` : '/lightning/o/Dashboard/home'
        break
      }
      case 'EmailTemplate': {
        this.Url = `/lightning/setup/CommunicationTemplatesEmail/page?address=%2F${this.Id}`
        break
      }
      case 'FieldSet': {
        this.Url = `/lightning/setup/ObjectManager/${this.ParentObjectId}/FieldSets/${this.Id}/view`
        break
      }
      case 'FlexiPage': {
        if(this.ParentObjectId){
          this.Url = `/lightning/setup/ObjectManager/${this.ParentObjectId}/LightningPages/${this.Id}/`
        }else{
          this.Url = `/${this.Id}`
        }
        break
      }
      case 'Layout': {
        this.Url = `/lightning/setup/ObjectManager/${this.ParentObjectId}/PageLayouts/${this.Id}/`
        break
      }
      case 'ListView': {
        this.Url = `/lightning/o/${this.ParentObjectId}/list?filterName=${this.Id}`
        break
      }
      case 'Profile': {
        this.Url = `/lightning/setup/Profiles/page?address=%2F${this.Id}`
        break
      }
      case 'PermissionSet': {
        this.Url = `/lightning/setup/PermSets/page?address=%2F${this.Id}`
        break
      }
      case 'ProcessDefinition': {
        this.Url = `/lightning/setup/ApprovalProcesses/page?address=%2F${this.Id}`
        break
      }
      case 'QuickAction': {
        this.Url = '/lightning/setup/GlobalActions/home'
        break
      }
      case 'RecordType': {
        this.Url = `/lightning/setup/ObjectManager/${this.ParentObjectId}/RecordTypes/${this.Id}/view`
        break
      }
      case 'Report': {
        this.Url = `/lightning/r/Report/${this.Id}/view`
        break
      }
      case 'ReportType': {
        this.Url = `/lightning/setup/CustomReportTypes/page?address=%2F${this.Id}`
        break
      }
      case 'StandardEntity': {
        this.Url = `/lightning/setup/ObjectManager/${this.Name}/Details/view`
        break
      }
      case 'SharingSetting': {
        this.Url = '/lightning/setup/SecuritySharing/home'
        break
      }
      case 'ValidationRule': {
        this.Url = `/lightning/setup/ObjectManager${this.ParentObjectId}/ValidationRules/${this.Id}/view`
        break
      }
      case 'Weblink': {
        this.Url = `/lightning/setup/ObjectManager${this.ParentObjectId}/ButtonsLinksActions/${this.Id}/view`
        break
      }
      case 'WorkflowAlert': {
        this.Url = `/lightning/setup/WorkflowEmails/page?address=%2F${this.Id}`
        break
      }
      case 'WorkflowFieldUpdate': {
        this.Url = `/lightning/setup/WorkflowFieldUpdates/page?address=%2F${this.Id}`
        break
      }
      case 'WorkflowOutboundMessage': {
        this.Url = `/lightning/setup/WorkflowOutboundMessaging/page?address=%2F${this.Id}`
        break
      }
      case 'WorkflowRule': {
        this.Url = `/lightning/setup/WorkflowRules/page?address=%2F${this.Id}`
        break
      }
      case 'WorkflowTask': {
        this.Url = `/lightning/setup/WorkflowTasks/page?address=%2F${this.Id}`
        break
      }
      default: {
        this.Url = `/${this.Id}`
        break
      }
    }
  }
}

/**
 * Parse the target or source object for a ChildRelationship Ex: 'Opportunity -> FinServ__FinancialAccount__c' -> 'Opportunity'
 * @param {string} string
 * @returns {string}
 */
export function parseChildRelationship(string: string): string {
  return string.slice(0, string.indexOf(' -> '))
}
