import {
  SfDependencyHelper,
  MetadataComponent,
  MetadataComponentDependency,
  ComponentType,
} from './sfDependencyHelper'
import uuid from 'uuid'
import logger from './logger'
import labels from './labels'
import { SfApi, DescribeSObjectResultMap, ToolingQueryResponse, ToolingQueryRecords } from './sfApi' 
import { SystemLoggerLevel } from './sfdc'
import { forceArray } from '../util/general'
import { SALESFORCE_API_VERSION } from './secrets'

const SF_API_VERSION = SALESFORCE_API_VERSION

const TOOLING_QUERY_ENTITYLIST =
  'SELECT DurableId, QualifiedApiName, DeveloperName, KeyPrefix, NamespacePrefix FROM EntityDefinition WHERE IsCustomSetting = false AND IsQueryable = true AND (NOT DeveloperName LIKE \'%Share\') AND (NOT QualifiedApiName LIKE \'%History\') AND (NOT KeyPrefix LIKE \'m0%\')'

const TOOLING_QUERY_CUSTOMOBJECTLIST =
  'SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject'

const TOOLING_QUERY_FIELDSETLIST =
  'SELECT Id, EntityDefinitionId, DeveloperName, NamespacePrefix FROM FieldSet'

const COMPONENT_TYPES_DEPLOYABLE : string[] = 
  ['CustomObject', 'RecordType', 'CustomField', 'FieldSet', 'Layout', 'CompactLayout', 'ListView', 
  'PermissionSet', 'Profile', 'EmailTemplate', 'ValidationRule']

export class SfMigrationAnalysis {
  instanceUrl: string
  ownedNamespace: string
  constructor(instanceUrl: string, ownedNamespace: string) {
    this.instanceUrl = instanceUrl
    this.ownedNamespace = ownedNamespace
  }

  /**
   * 
   * @param objectMapping 
   * @param apiClient 
   * @returns A wrapped list of parameters (maps) we can pass into functions as needed
   */
  async convertMappedObjectsToMaps(
    objectMapping: Map<string, string>,
    overallObjectMapping: Map<string, string>,
    fieldMapping: Map<string, string>,
    apiClient: SfApi,
    config: ReportConfig
  ) : Promise<MappedObjectsInfo> {

    const mappedObjectInfo : MappedObjectsInfo = {
      mappedObjectRecords: [],
      objectMapping: new Map(),
      overallObjectMapping: new Map(),
      fieldMapping: new Map(),
      allMappedObjectNameIdMap: new Map(),
      objectNameObject: new Map(),
      componentNameToItem: new Map(),
      objectIdToInternalName: new Map(),
      objectNameToId: new Map(),
      layoutNames: [],
      objectNames: [],
      entityDefIdToDeveloperNameMap: new Map(),
      durableIdToQualifiedNamesMap: new Map(),
      qualifiedNameToEntityMap : new Map(),
      durableIdToNamespaceMap : new Map()
    }

    //prepare user mapped objects for fetching related items
    //Use object id from Tooling API

    //FSCTA-1626: Filter out any objects whose type is excluded (Custom Object or Standard Entity)
    var objectKeys = Array.from(objectMapping.keys())
    var filteredObjectKeys : Set<string> = new Set()
    objectKeys.forEach(objName => {
      logger.debug(`==Test Obj Name: ${objName}`)
      if(objName.includes('__c')){
        if(shouldProcessMetadata(config, 'CustomObject')){
          filteredObjectKeys.add(objName)
        }else{
          objectMapping.delete(objName)
        }
      }else{
        if(shouldProcessMetadata(config, 'StandardEntity')){
          filteredObjectKeys.add(objName)
        }else{
          objectMapping.delete(objName)
        }
      }
    })
    logger.debug(`==Final key list: ${Array.from(filteredObjectKeys)}`)
    mappedObjectInfo.mappedObjectRecords = await getEntityDefinitions(apiClient, Array.from(filteredObjectKeys))

    mappedObjectInfo.objectMapping = objectMapping
    mappedObjectInfo.overallObjectMapping = overallObjectMapping
    mappedObjectInfo.fieldMapping = fieldMapping

    logger.debug(`objectMapping: ${JSON.stringify([...mappedObjectInfo.objectMapping.entries()])}`)
    // logger.debug(`overallObjectMapping: ${JSON.stringify([...mappedObjectInfo.overallObjectMapping.entries()])}`)

    //Set maps from mapped object records
    if(mappedObjectInfo.mappedObjectRecords && mappedObjectInfo.mappedObjectRecords.length > 0){
      logger.debug(`mappedObjectRecords.length: ${mappedObjectInfo.mappedObjectRecords.length}`)
      mappedObjectInfo.mappedObjectRecords.forEach(mappedObjectRecord => {
        mappedObjectInfo.allMappedObjectNameIdMap.set(mappedObjectRecord.QualifiedApiName, mappedObjectRecord.DurableId)
        mappedObjectInfo.entityDefIdToDeveloperNameMap.set(mappedObjectRecord.DurableId, mappedObjectRecord.DeveloperName)
        mappedObjectInfo.durableIdToQualifiedNamesMap.set(mappedObjectRecord.DurableId, mappedObjectRecord.QualifiedApiName)
        mappedObjectInfo.durableIdToNamespaceMap.set(mappedObjectRecord.DurableId, mappedObjectRecord.NamespacePrefix)
        mappedObjectInfo.qualifiedNameToEntityMap.set(mappedObjectRecord.QualifiedApiName, mappedObjectRecord)
      })
    }
    
    logger.debug(`mappedObjectRecords: ${JSON.stringify(mappedObjectInfo.mappedObjectRecords)}`)
    logger.debug(`allMappedObjectNameIdMap: ${JSON.stringify([...mappedObjectInfo.allMappedObjectNameIdMap.entries()])}`)
    logger.debug(`entityDefIdToDeveloperNameMap: ${JSON.stringify([...mappedObjectInfo.entityDefIdToDeveloperNameMap.entries()])}`)
    logger.debug(`durableIdToQualifiedNamesMap: ${JSON.stringify([...mappedObjectInfo.durableIdToQualifiedNamesMap.entries()])}`)
    logger.debug(`qualifiedNameToEntityMap: ${JSON.stringify([...mappedObjectInfo.qualifiedNameToEntityMap.entries()])}`)
    
    return mappedObjectInfo
  }

  /**
   * 
   * @param dependencies 
   * @param mappedObjectInfo 
   * @param apiClient 
   * @returns Process a flat list of MetadataComponentDependency items returned from the Dependency API in Salesforce format into a tree of MigrationAnalysisItems that represent the compiled apex related metadata 
   * for a top down representation of org dependencies. i.e. parent object > child metadata[] > grandchild metadata[]
   */
  generateAnalysis(
    dependencies: MetadataComponentDependency[],
    mappedObjectInfo : MappedObjectsInfo,
    apiClient: SfApi,
    config: ReportConfig
  ): MigrationAnalysisItem[] {
    
    const dependencyTree: MetadataComponent[] = new SfDependencyHelper(
      this.instanceUrl,
      this.ownedNamespace,
    ).buildDependencyTree(dependencies, mappedObjectInfo, config)

    logger.debug(
      `[sfMigrationAnalysis] [generateAnalysis] Processing ${dependencies.length.toLocaleString()} MetadataComponent nodes`,
    )

    // dependencyTree.forEach(treeItem => {
    //   if(treeItem.Parent){
    //     logger.debug(
    //       `==child dependencyTree item: ${treeItem.Name}. Parent: ${treeItem.Parent.Name}`,
    //     )
    //   }else{
    //     // logger.debug(
    //     //   `==parent dependencyTree item: ${treeItem.Name}.`,
    //     // )
    //   }
      
    // });

    // dependencyTree.forEach(treeItem => {
    //   if(treeItem.Longname == 'Account' && treeItem.Type == ComponentType.STANDARD_OBJECT){
    //     treeItem.Children = treeItem.Children.filter(item => item.Type != 'ApexClass')
    //     // let parent = (({ Id, Type, Name, Namespace, Longname }) => ({ Id, Type, Name, Namespace, Longname }))(treeItem)
    //     logger.debug(
    //       `==parent MetadataComponent item: ${treeItem.Id}, ${treeItem.Type}, ${treeItem.Name}, ${treeItem.Longname}, ${treeItem.Namespace}`,
    //     )
    //     treeItem.Children.forEach(child => {
    //       // let c = (({ Id, Type, Name, Namespace, Longname }) => ({ Id, Type, Name, Namespace, Longname }))(child)
    //       logger.debug(
    //         `==child MetadataComponent item: ${child.Id}, ${child.Type}, ${child.Name}, ${child.Longname}, ${child.Namespace}`,
    //       )
    //     })
        
    //   }else if(treeItem.Type == ComponentType.STANDARD_OBJECT || treeItem.Type == ComponentType.CUSTOM_OBJECT){
    //     // logger.debug(
    //     //   `==parent dependencyTree item: ${JSON.stringify(treeItem)}`,
    //     // )
    //     logger.debug(
    //       `==parent dependencyTree item: ${treeItem.Longname} / ${treeItem.Longname}... ${[...treeItem.ChildKeys]}`,
    //     )
        
    //   }else{
    //     // logger.debug(
    //     //   `==child dependencyTree item: ${JSON.stringify(treeItem)}`,
    //     // )
    //   }
    // });

    return this.filterUnrelatedItems(
      this.buildAnalysisTree(dependencyTree, mappedObjectInfo, config),
    )
  }

  /**
   * Build LWC Tree Grid data list for the Migration Analysis section of the upgrade report
   */
  buildAnalysisTree(
    dependencies: MetadataComponent[],
    mappedObjectInfo : MappedObjectsInfo,
    config: ReportConfig
  ): MigrationAnalysisItem[] {
    const treeGridList: MigrationAnalysisItem[] = []

    for (const componentDependency of dependencies) {
      const item: MigrationAnalysisItem = {
        uuid: uuid.v4(),
        fromComponentId: componentDependency.Id,
        fromComponentName: componentDependency.Longname,
        fromComponentType: componentDependency.Type,
        fromComponentUrl: componentDependency.Url || '',
        children: [],
      }

      //set destination mapping
      if (
        (item.fromComponentType === ComponentType.CUSTOM_OBJECT ||
          item.fromComponentType === ComponentType.STANDARD_OBJECT) &&
          mappedObjectInfo.objectMapping.has(item.fromComponentName)
      ) {
        item.toComponentName = mappedObjectInfo.objectMapping.get(item.fromComponentName)
      }else if(item.fromComponentType === ComponentType.CUSTOM_OBJECT){
        if(mappedObjectInfo.objectMapping.has(item.fromComponentName+'__c')){
          item.toComponentName = mappedObjectInfo.objectMapping.get(item.fromComponentName+'__c')
        }
      }
      //Below commented out fieldMapping now has a notation <objectName>.<fieldName>
      //We would need to retreive CustomField with TableEnumOrId from Tooling API for all custom field component id
      //This might not be needed at all we are setting field mappings in SF in Apex at end of processing results
      else if (
        item.fromComponentType === ComponentType.CUSTOM_FIELD &&
        mappedObjectInfo.fieldMapping.has(item.fromComponentName)
      ) {
        item.toComponentName = mappedObjectInfo.fieldMapping.get(item.fromComponentName)
      }

      //skip process if type fitlered out
      if((item.fromComponentType === ComponentType.CUSTOM_OBJECT || item.fromComponentType === ComponentType.STANDARD_OBJECT) && !shouldProcessMetadata(config, item.fromComponentType)){
        logger.debug(`==Analysis Tree: Skip ${item.fromComponentName}`)
        continue
      }
      

      //skip processing on unmapped objects
      if (
        (item.fromComponentType === ComponentType.CUSTOM_OBJECT ||
          item.fromComponentType === ComponentType.STANDARD_OBJECT) &&
        !item.toComponentName
      ) {
        continue
      }

      //process child nodes
      item.children = this.buildAnalysisTree(
        componentDependency.Children,
        mappedObjectInfo,
        config
      )

      //add to list
      treeGridList.push(item)
    }

    //sort list fromComponent Asc
    treeGridList.sort((a, b) =>
      a.fromComponentName.localeCompare(b.fromComponentName),
    )

    return treeGridList
  }

  /**
   * Filter out unmatched components that will not impact migration
   */
  filterUnrelatedItems(
    migrationAnalysis: MigrationAnalysisItem[],
  ): MigrationAnalysisItem[] {
    logger.debug(
      `[sfMigrationAnalysis] [filterUnrelatedItems] Filtering ${migrationAnalysis.length.toLocaleString()} MigrationAnalysisItem nodes`,
    )
    // return migrationAnalysis.filter((elem) => {
    //   //Allow parent objects and supported leftover types that still need to be recursivley added as grandchildren
    //   return (
    //     elem.fromComponentType === ComponentType.CUSTOM_OBJECT ||
    //     elem.fromComponentType === ComponentType.STANDARD_OBJECT ||
    //     elem.fromComponentType === ComponentType.LAYOUT ||
    //     elem.fromComponentType === ComponentType.LIGHTNING_PAGE ||
    //     elem.fromComponentType === ComponentType.VALIDATION_RULE
    //   )
    // })

    // migrationAnalysis.forEach(migrationAnalysisItem => {
      
    //   if(migrationAnalysisItem.fromComponentName == 'Account' && migrationAnalysisItem.fromComponentType == ComponentType.STANDARD_OBJECT){
    //     migrationAnalysisItem.children = migrationAnalysisItem.children.filter(item => item.fromComponentType != 'ApexClass')

    //     logger.debug(
    //       `==parent migrationAnalysis item: ${JSON.stringify(migrationAnalysisItem)}`,
    //     )
        
    //   }else if(migrationAnalysisItem.fromComponentType == ComponentType.STANDARD_OBJECT || migrationAnalysisItem.fromComponentType == ComponentType.CUSTOM_OBJECT){
    //     // logger.debug(
    //     //   `==parent migrationAnalysis item: ${JSON.stringify(migrationAnalysisItem)}`,
    //     // )
        
    //   }else{
    //     // logger.debug(
    //     //   `==child migrationAnalysis item: ${JSON.stringify(treeItem)}`,
    //     // )
    //   }
    // });

    return migrationAnalysis
  }

  /**
   * 
   * @param migrationAnalysis 
   * @param mappedObjectInfo 
   * @param apiClient 
   * @returns updated array of MigrationAnalysisItems that includes both dependency-related metadata items and metadata items directly related to each of the mapped objects from the assessment, even if the mapped object did not have a dependency item
   */
  async buildMissingRelationships(migrationAnalysis : MigrationAnalysisItem[], mappedObjectInfo : MappedObjectsInfo, apiClient: SfApi, config: ReportConfig) : Promise<MigrationAnalysisItem[]> {
    logger.debug(
      `==START buildMissingRelationships`,
    )
    
    logger.debug(`migrationAnalysis.length: ${migrationAnalysis.length}`)

    //Note: This code block and next block are switched in order from Apex version
    migrationAnalysis.forEach(analysisItem => {
      var objectId : string = mappedObjectInfo.allMappedObjectNameIdMap.get(analysisItem.fromComponentName)!
      if (analysisItem.fromComponentType == ComponentType.CUSTOM_OBJECT) {
        analysisItem.fromComponentName += '__c' //force custom object __c
        mappedObjectInfo.objectNameObject.set(analysisItem.fromComponentName, analysisItem)
      } else if (analysisItem.fromComponentType == ComponentType.STANDARD_OBJECT) {
        mappedObjectInfo.objectNameObject.set(analysisItem.fromComponentName, analysisItem)
      } else if (analysisItem.fromComponentType == ComponentType.LAYOUT) {
        mappedObjectInfo.layoutNames.push(analysisItem.fromComponentName)
        mappedObjectInfo.componentNameToItem.set(analysisItem.fromComponentName, analysisItem)
      } else {
        mappedObjectInfo.componentNameToItem.set(analysisItem.fromComponentName, analysisItem)
      }
    })

    mappedObjectInfo.objectNames = Array.from(mappedObjectInfo.objectNameObject.keys())
    mappedObjectInfo.objectNames.forEach(sourceObjectName => {
      if(sourceObjectName.endsWith('__c')){
        if(shouldProcessMetadata(config, 'CustomObject')){
          //get object id for custom objects from Tooling API
          var objectInternalName : string = sourceObjectName.replace('__c', '')
          if(mappedObjectInfo.allMappedObjectNameIdMap.has(sourceObjectName)){
            var objectId : string = mappedObjectInfo.allMappedObjectNameIdMap.get(sourceObjectName)!
            objectId = objectId.substring(0, 15) //force 15 char id
            mappedObjectInfo.objectIdToInternalName.set(objectId, objectInternalName)
            mappedObjectInfo.objectNameToId.set(sourceObjectName, objectId)
          }
        }
        
      }else{
        //standard object name is id
        if(shouldProcessMetadata(config, 'StandardEntity')){
          mappedObjectInfo.objectIdToInternalName.set(sourceObjectName, sourceObjectName)
          mappedObjectInfo.objectNameToId.set(sourceObjectName, sourceObjectName)
        }
      }
    })

    logger.debug(`allMappedObjectNameIdMap: ${JSON.stringify([...mappedObjectInfo.allMappedObjectNameIdMap.entries()])}`)
    // logger.debug(`objectNameObject: ${JSON.stringify([...mappedObjectInfo.objectNameObject.entries()])}`)
    logger.debug(`objectNames: ${[...mappedObjectInfo.objectNames]}`)
    logger.debug(`objectIdToInternalName: ${JSON.stringify([...mappedObjectInfo.objectIdToInternalName.entries()])}`)
    logger.debug(`objectNameToId: ${JSON.stringify([...mappedObjectInfo.objectNameToId.entries()])}`)
    // logger.debug(`componentNameToItem: ${JSON.stringify([...mappedObjectInfo.componentNameToItem.entries()])}`)
    // logger.debug(`componentNameToItem.keys(): ${[...mappedObjectInfo.componentNameToItem.keys()]}`)

    // componentNameToItem are all non-sobject components
    // mappedObjectInfo.componentNameToItem.forEach((val, key) => {
    //   let item : MigrationAnalysisItem = val
    //   if(item.fromComponentType == 'ApexClass') logger.debug(`==componentNameToItem  key: ${key}, ITEM: ${JSON.stringify(item)}`,)
    // });

    mappedObjectInfo.objectNameObject.forEach((val, key) => {
      let item : MigrationAnalysisItem = val
      // if(item.fromComponentType == ComponentType.CUSTOM_OBJECT || item.fromComponentType == ComponentType.STANDARD_OBJECT) logger.debug(`==objectNameObject  key: ${key}, ITEM: ${JSON.stringify(item)}`)
    })
    

    //describe all layouts to find a match to a mapped object
    //layouts can be returned from DAPI with CustomField references and this is to match it to the object
    if(shouldProcessMetadata(config, 'Layout')){
      if(mappedObjectInfo.layoutNames && mappedObjectInfo.layoutNames.length > 0){
        //Layouts
        const layouts : MetadataComponentDependency[] = await getMissingDependencies(apiClient, mappedObjectInfo.layoutNames, 'Layout', 'Name', 'Name', '', true, true, config)
        if(layouts){
          this.addObjectDependencies(layouts, mappedObjectInfo)
        }
      }
    }
    
    //describe additional components only for mapped objects
    if(mappedObjectInfo.objectNames && mappedObjectInfo.objectNames.length > 0){
      //Object Layouts
      if(shouldProcessMetadata(config, 'Layout')){
        const objectLayouts : MetadataComponentDependency[] = await getMissingDependencies(apiClient, Array.from(mappedObjectInfo.objectNameToId.values()), 'Layout', 'Name', 'TableEnumOrId', '', true, true, config)
        if(objectLayouts){
          this.addObjectDependencies(objectLayouts, mappedObjectInfo)
        }
      }

      //Compact Layouts
      if(shouldProcessMetadata(config, 'CompactLayout')){
        const compactLayouts : MetadataComponentDependency[] = await getMissingDependencies(apiClient, mappedObjectInfo.objectNames, 'CompactLayout', 'DeveloperName', 'SobjectType', '', true, true, config)
        if(compactLayouts){
          this.addObjectDependencies(compactLayouts, mappedObjectInfo)
        }
      }
      
      //Field Sets
      // const fieldSets : MetadataComponentDependency[] = await getMissingDependencies(apiClient, mappedObjectInfo.entityNames.keys(), 'FieldSet', 'DeveloperName', 'EntityDefinitionId', '', true, false)
      if(shouldProcessMetadata(config, 'FieldSet')){
        const fieldSets : MetadataComponentDependency[] = await getObjectFieldSets(apiClient, mappedObjectInfo, config)
        if(fieldSets){        
          this.addObjectDependencies(fieldSets, mappedObjectInfo)
        }
      }
      
      //Record Types
      if(shouldProcessMetadata(config, 'RecordType')){
        const rTypes : MetadataComponentDependency[] = await getObjectRecordTypes(apiClient, mappedObjectInfo.objectNames, config)
        if(rTypes){
          this.addObjectDependencies(rTypes, mappedObjectInfo)
        }
      }
      
      //List Views
      if(shouldProcessMetadata(config, 'ListView')){
        const lViews : MetadataComponentDependency[] = await getMissingDependencies(apiClient, mappedObjectInfo.objectNames, 'ListView', 'DeveloperName', 'SobjectType', '', false, true, config)
        if(lViews){
          this.addObjectDependencies(lViews, mappedObjectInfo)
        }
      }
      
      //Approvals
      if(shouldProcessMetadata(config, 'ApprovalProcess')){
        const approvals : MetadataComponentDependency[] = await getMissingDependencies(apiClient, mappedObjectInfo.objectNames, 'ProcessDefinition', 'Name', 'TableEnumOrId', "State = 'Active'", false, false, config)
        if(approvals){
          this.addObjectDependencies(approvals, mappedObjectInfo)
        }
      }
      
      //Validation Rules
      if(shouldProcessMetadata(config, 'ValidationRule')){
        var objectIds : string[] = Array.from(mappedObjectInfo.objectNameToId.values())
        var correctedIds : string[] = []
        objectIds.forEach(sobjId => {
          correctedIds.push(sobjId.startsWith('01I') ? sobjId.substring(0,15) : sobjId)
        })
        const validationRules : MetadataComponentDependency[] = await getMissingDependencies(apiClient, correctedIds, 'ValidationRule', 'ValidationName', 'EntityDefinitionId', 'Active = true', true, true, config)
        if(validationRules){
          this.addObjectDependencies(validationRules, mappedObjectInfo)
        }
        logger.debug(`validationRules.length: ${validationRules.length}`)
      }
      
      //Process Flows
      if(shouldProcessMetadata(config, 'Flow')){
        const processFlows : MetadataComponentDependency[] = await getObjectProcessFlows(apiClient, mappedObjectInfo.objectNames)
        if(processFlows){
          this.addObjectDependencies(processFlows, mappedObjectInfo)
        }
        logger.debug(`processFlows.length: ${processFlows.length}`)
      }
      
      //Quick Actions
      if(shouldProcessMetadata(config, 'QuickAction')){
        const quickAtions : MetadataComponentDependency[] = await getObjectQuickActions(apiClient, mappedObjectInfo)
        if(quickAtions){
          this.addObjectDependencies(quickAtions, mappedObjectInfo)
        }
        logger.debug(`quickAtions.length: ${quickAtions.length}`)
      }
      
      //Web Links
      if(shouldProcessMetadata(config, 'WebLink')){
        const webLinks : MetadataComponentDependency[] = await getObjectWebLinks(apiClient, mappedObjectInfo.objectNames, mappedObjectInfo.allMappedObjectNameIdMap)
        if(webLinks){
          this.addObjectDependencies(webLinks, mappedObjectInfo)
        }
        logger.debug(`webLinks.length: ${webLinks.length}`)
      }
    }

    if(mappedObjectInfo.objectNameToId.size > 0){
      //Workflows
      if(shouldProcessMetadata(config, 'Workflow')){
        const workflows : MetadataComponentDependency[] = await getObjectWorkflows(apiClient, mappedObjectInfo.objectNameToId, config)
        if(workflows){
          this.addObjectDependencies(workflows, mappedObjectInfo)
        }
        logger.debug(`workflows.length: ${workflows.length}`)
      }
      
      //Report Info
      if(shouldProcessMetadata(config, 'ReportType')){
        const reportInfo : MetadataComponentDependency[] = await getReportInfo(apiClient, mappedObjectInfo.objectNameToId, mappedObjectInfo.objectMapping)
        if(reportInfo){
          this.addObjectDependencies(reportInfo, mappedObjectInfo)
        }
        logger.debug(`reportInfo.length: ${reportInfo.length}`)
      }
    }
    
    mappedObjectInfo.objectNameObject.forEach((value, key) => {
      var objectItem : MigrationAnalysisItem = value
      
      //remove and skip unmapped objects not in the original mapped object list from Salesforce
      var objectDeveloperName : string = objectItem.fromComponentType == ComponentType.CUSTOM_OBJECT && !objectItem.fromComponentName.endsWith('__c') ?
          objectItem.fromComponentName + '__c' : objectItem.fromComponentName
      
      if (!mappedObjectInfo.objectMapping.has(objectDeveloperName)) {
          mappedObjectInfo.objectNameObject.delete(key)
          return
      }

      //reparent other child components back to object level children
      objectItem.children.forEach(objectChild => {
        
        if (mappedObjectInfo.componentNameToItem.has(objectChild.fromComponentName)) {
            var children = mappedObjectInfo.componentNameToItem.get(objectChild.fromComponentName)?.children
            objectChild.children.concat(children!)
            objectChild.children.sort()
          }
      })

      objectItem.children.sort()
    })

    let returnList : MigrationAnalysisItem[] = Array.from(mappedObjectInfo.objectNameObject.values())
    
    logger.debug(
      `==END buildMissingRelationships`,
    )

    return returnList
  }

  /**
   * 
   * @param migrationAnalysis 
   * @param mappedObjectInfo 
   * @returns array of migrationAnalysis items, grouped by parent > child types
   */
  buildTypeGrouping (migrationAnalysis : MigrationAnalysisItem[], mappedObjectInfo : MappedObjectsInfo, apiClient: SfApi, config: ReportConfig) : MigrationAnalysisItem[] {
    logger.debug(
      `==START buildTypeGrouping`,
    )

    var componentText : string[]

    migrationAnalysis.forEach(item => {
      //Get reason text + effort
      componentText = this.getComponentTypeRecommendation(item.fromComponentType)

      if(componentText){
        item.reasonText = componentText[0]
        item.effort = componentText[1]
      } else {
        logger.debug(`==item.fromComponentType: ${item.fromComponentType}`)
      }

      //Special conditions for objects
      if(item.fromComponentType == 'CustomObject' || item.fromComponentType == 'StandardEntity'){

        var objectName : string = (item.fromComponentType === 'CustomObject' && !item.fromComponentName.endsWith('__c')) ? item.fromComponentName + '__c' : item.fromComponentName
        
        //TODO: Get custom object Id, if needed (standard objects just use object name)
        //TODO: Get record count for objects

        if(mappedObjectInfo.overallObjectMapping && mappedObjectInfo.overallObjectMapping.has(item.fromComponentName)){
          item.toComponentName = mappedObjectInfo.overallObjectMapping.get(item.fromComponentName)!
        }

        if(item.toComponentName){
          item.toComponentName = item.toComponentName.replace('{','').replace('}','')
        }

        if(item.toComponentName && item.fromComponentName === item.toComponentName){
          item.reasonText = labels.RecComponentTypeSameTarget
        }else if(item.fromComponentId === 'Contact' && item.toComponentName === 'Account'){
          item.reasonText = labels.RecComponentTypeContactB2C
        }

        //Get children to group types
        const typeNodeMap : Map<string, MigrationAnalysisItem> = new Map()
        var typeNode : MigrationAnalysisItem
        if(item.children){
          item.children.forEach(objChild => {
            if(shouldProcessMetadata(config, objChild.fromComponentType)){
              if(!typeNodeMap.has(objChild.fromComponentType)){
                typeNode = {
                  uuid: uuid.v4(),
                  fromComponentId: '',
                  fromComponentName: objChild.fromComponentType,
                  fromComponentType: objChild.fromComponentType,
                  fromComponentUrl: new MetadataComponent(objChild.fromComponentId, objChild.fromComponentType, objChild.fromComponentName, '').Url!,
                  children: []
                }
              }else{
                typeNode = typeNodeMap.get(objChild.fromComponentType)!
              }
              let parentMetadataComponent = new MetadataComponent(objChild.fromComponentId, objChild.fromComponentType, objChild.fromComponentName, '')
              parentMetadataComponent.ParentObjectId = item.fromComponentId
              parentMetadataComponent.ParentObjectName = item.fromComponentName
              parentMetadataComponent.setUrl()
              objChild.fromComponentUrl = parentMetadataComponent.Url!
              
              componentText = this.getComponentTypeRecommendation(objChild.fromComponentType)
              if(componentText){
                typeNode.reasonText = componentText[0]
                typeNode.effort = componentText[1]
              }
              typeNode.children.push(objChild)
              typeNodeMap.set(typeNode.fromComponentType, typeNode)
            }      
          })

          //After children have been processed, Update Label + Dependency Count
          typeNodeMap.forEach(function(typeNodeItem) { /* ... */ 
            var sectionName  = ''
            if(labels.TYPE_TO_LABEL.has(typeNodeItem.fromComponentName)){
              sectionName = labels.TYPE_TO_LABEL.get(typeNodeItem.fromComponentName)!
            }else{
              sectionName = typeNodeItem.fromComponentType.replace(/([A-Z])/g, ' $1').trim()
            }
            typeNodeItem.fromComponentName = sectionName + ' (' + typeNodeItem.children.length + ')'
            typeNodeItem.children.forEach(componentChild => {
              if(componentChild.fromComponentType === 'CustomField'){
                componentChild.toComponentName = mappedObjectInfo.fieldMapping.get(objectName + '.' + componentChild.fromComponentName + '__c')
              }
            })
          })

          item.children = []
          item.children.push(...Array.from(typeNodeMap.values()))
        }
      }
    })

    logger.debug(
      `==END buildTypeGrouping`,
    )

    //sort child type groupings list by fromComponent Asc
    migrationAnalysis.forEach(parent => {
      parent.children.sort((a, b) =>
        a.fromComponentName.localeCompare(b.fromComponentName),
      )
    })

    return migrationAnalysis
  }

  /**
   * 
   * @param componentType - Metadata type of current analysis item
   * @returns - array of strings, containing: 0 - recommendation text, 1 - effort level
   */
  getComponentTypeRecommendation (componentType : string) : string[] {
    var returnText : string[] = []
    switch(componentType) {
      case 'AuraComponentBundle':
      case 'AuraComponent':
        returnText[0] = labels.RecComponentTypeAuraComponentBundle
        returnText[1] = labels.EffortLabelMedium
        break
      case 'ApexClass':
        returnText[0] = labels.RecComponentTypeApexClass
        returnText[1] = labels.EffortLabelHigh
        break
      case 'ApexPage':
        returnText[0] = labels.RecComponentTypeApexPage
        returnText[1] = labels.EffortLabelHigh
          break
      case 'ApexTrigger':
        returnText[0] = labels.RecComponentTypeApexTrigger
        returnText[1] = labels.EffortLabelHigh
        break
      case 'CustomObject':
        returnText[0] = labels.RecComponentTypeCustomObject
        returnText[1] = labels.EffortLabelMedium
        break
      case 'CustomField':
        returnText[0] = labels.RecComponentTypeCustomField
        returnText[1] = labels.EffortLabelMedium
        break
      case 'FlexiPage':
        returnText[0] = labels.RecComponentTypeFlexiPage
        returnText[1] = labels.EffortLabelMedium
        break
      case 'Flow':
        returnText[0] = labels.RecComponentTypeFlow
        returnText[1] = labels.EffortLabelMedium
        break
      case 'QuickAction':
        returnText[0] = labels.RecComponentTypeQuickAction
        returnText[1] = labels.EffortLabelMedium
        break
      case 'StandardEntity':
        returnText[0] = labels.RecComponentTypeStandardObject
        returnText[1] = labels.EffortLabelMedium
        break
      case 'WebLink':
        returnText[0] = labels.RecComponentTypeWebLink
        returnText[1] = labels.EffortLabelMedium
        break
      case 'WorkflowRule':
        returnText[0] = labels.RecComponentTypeWorkflowRule
        returnText[1] = labels.EffortLabelMedium
        break
      default:
        if(COMPONENT_TYPES_DEPLOYABLE.includes(componentType)){
          returnText[0] = labels.RecComponentTypeAutomateDefault
          if(labels.TYPE_TO_LABEL.has(componentType)){
            returnText[0] = returnText[0].replace('{0}', labels.TYPE_TO_LABEL.get(componentType)!)
          }
          returnText[1] = labels.EffortLabelLow
        }else{
          returnText[0] = labels.RecComponentTypeDefault
          if(labels.TYPE_TO_LABEL.has(componentType)){
            returnText[0] = returnText[0].replace('{0}', labels.TYPE_TO_LABEL.get(componentType)!)
          }
          returnText[1] = labels.EffortLabelLow
        }
    }
    return returnText
  }

  addObjectDependencies (dependencies : MetadataComponentDependency[], mappedObjectInfo : MappedObjectsInfo) {
    
    //group component dependencies into each object
    logger.debug(
      `==START: addObjectDependencies`,
    )
    dependencies.forEach(componentToObject => {
      // logger.debug(`componentToObject: ${componentToObject.MetadataComponentName} ref: ${componentToObject.RefMetadataComponentName}`)
      var srcComponentName : string = componentToObject.MetadataComponentName.startsWith('01I') ? mappedObjectInfo.objectIdToInternalName.get(componentToObject.MetadataComponentName.substring(0, 15)) + '__c' :
          componentToObject.MetadataComponentType == 'CustomObject' && !componentToObject.MetadataComponentName.endsWith('__c') ?
              componentToObject.MetadataComponentName + '__c' :
              componentToObject.MetadataComponentName
      var referencedComponentName : string = componentToObject.RefMetadataComponentName.startsWith('01I') ? mappedObjectInfo.objectIdToInternalName.get(componentToObject.RefMetadataComponentName.substring(0, 15)) + '__c' :
          componentToObject.RefMetadataComponentType == 'CustomObject' && !componentToObject.RefMetadataComponentName.endsWith('__c') ?
              componentToObject.RefMetadataComponentName + '__c' :
              componentToObject.RefMetadataComponentName
              
      // logger.debug(`objectItem: ${JSON.stringify(objectItem)}`)
      // logger.debug(`componentToObject: ${JSON.stringify(componentToObject)}`)
      // logger.debug(`srcComponentName: ${srcComponentName}, MetadataComponentName: ${componentToObject.MetadataComponentName}`)
      // logger.debug(`referencedComponentName: ${referencedComponentName}, RefMetadataComponentName: ${componentToObject.RefMetadataComponentName}`)

      var existingParent : MigrationAnalysisItem
      var relatedComponent : MigrationAnalysisItem
      if(!mappedObjectInfo.objectNameObject.has(referencedComponentName)){
        
        //Create parent new if missing
        var metaComponent : MetadataComponent = new MetadataComponent(componentToObject.RefMetadataComponentId, componentToObject.RefMetadataComponentType, referencedComponentName, componentToObject.RefMetadataComponentNamespace)
        existingParent = {
          uuid: uuid.v4(),
          fromComponentId: componentToObject.RefMetadataComponentId,
          fromComponentName: metaComponent.Longname,
          fromComponentType: componentToObject.RefMetadataComponentType,
          fromComponentUrl: metaComponent.Url!,
          toComponentName: mappedObjectInfo.objectMapping.has(referencedComponentName) ? mappedObjectInfo.objectMapping.get(referencedComponentName) : referencedComponentName,
          children: []
        }
        // logger.debug(`Create parent existingParent: From: ${existingParent.fromComponentName}, Type: ${existingParent.fromComponentType}`)
      }else{
        existingParent = mappedObjectInfo.objectNameObject.get(referencedComponentName)!
        // logger.debug(`existingParent: From: ${existingParent.fromComponentName}, Type: ${existingParent.fromComponentType}`)
      }
      
      //this is a new dependency we are adding that wasn't in previous list
      if(!mappedObjectInfo.componentNameToItem.has(srcComponentName)){
        var metaComponent : MetadataComponent = new MetadataComponent(componentToObject.MetadataComponentId, componentToObject.MetadataComponentType, srcComponentName, componentToObject.MetadataComponentNamespace)
        relatedComponent = {
          uuid: uuid.v4(),
          fromComponentId: componentToObject.MetadataComponentId,
          fromComponentName: srcComponentName,
          fromComponentType: componentToObject.MetadataComponentType,
          fromComponentUrl: metaComponent.Url!,
          children: []
        }        
        if (componentToObject.MetadataComponentType === 'RecordType') {
          var destinationRecordType : string = mappedObjectInfo.objectMapping.get(existingParent.fromComponentName + '.' + relatedComponent.fromComponentName)!
          if (destinationRecordType) {
              relatedComponent.toComponentName = destinationRecordType.split('\\.')[1]
          }
        } else {
            relatedComponent.toComponentName = mappedObjectInfo.objectMapping.get(relatedComponent.fromComponentName)
        }
        // logger.debug(`Create new dependency relatedComponent: From: ${relatedComponent.fromComponentName}, Type: ${relatedComponent.fromComponentType}`)
      }else{
        relatedComponent = mappedObjectInfo.componentNameToItem.get(srcComponentName)!
        // logger.debug(`dependency relatedComponent: From: ${relatedComponent.fromComponentName}, Type: ${relatedComponent.fromComponentType}`)
      }

      //append to collections
      var hasExisting  = false
      existingParent.children.forEach(existingChild => {
        if (existingChild.fromComponentName === relatedComponent.fromComponentName) {
            // if(relatedComponent.fromComponentType != ComponentType.LAYOUT)  logger.debug(`hasExisting relatedComponent: ${JSON.stringify(relatedComponent)}`)
            existingChild.children = existingChild.children.concat(relatedComponent.children)
            hasExisting = true
            return
        }
      })
      if (!hasExisting) {
        // if(relatedComponent.fromComponentType != ComponentType.LAYOUT)  logger.debug(`!hasExisting relatedComponent: ${JSON.stringify(relatedComponent)}`)
        existingParent.children.push(relatedComponent)
      }
      if (existingParent.fromComponentType == 'CustomObject' ||
          existingParent.fromComponentType == 'StandardEntity') {
          mappedObjectInfo.objectNameObject.set(existingParent.fromComponentName, existingParent)
      }
      mappedObjectInfo.componentNameToItem.delete(srcComponentName)
    })
  }
}

// async function getSubscriberCustomObjectResponse(apiClient: SfApi) : Promise<CustomObject[]>{
//   const result = await apiClient.getToolingQuery(
//     TOOLING_QUERY_ENTITYLIST  //TOOLING_QUERY_CUSTOMOBJECTLIST
//   )
//   const customObjectList: CustomObject[] = JSON.parse(JSON.stringify(result.records))
//   return customObjectList
// }

export async function getEntityDefinitions(apiClient: SfApi, durableIds: string[]) : Promise<EntityDefinition[]> {
  const allRecords : EntityDefinition[] = []
  
  //Perform Tooling Query
  const BATCH_SIZE = 100

  for (let index = 0; index < durableIds.length; index+=BATCH_SIZE) {
    var sublist: string[] = []
    if(durableIds.length < index+BATCH_SIZE){
      sublist = durableIds.slice(index, durableIds.length)
    }else{
      sublist = durableIds.slice(index, BATCH_SIZE)
    }

    var query = `SELECT Label, DurableId, QualifiedApiName, DeveloperName, KeyPrefix, NamespacePrefix, ExternalSharingModel, InternalSharingModel FROM EntityDefinition WHERE QualifiedApiName IN ('${sublist.join("', '")}')`
    logger.debug(`query: ${query}`)
    const result = await apiClient.getToolingQuery(
      query
    )
    if(result){
      allRecords.push(...JSON.parse(JSON.stringify(result.records)))
    }
  }
  logger.debug(`allRecords.length: ${allRecords.length}`)
  return allRecords
}

async function getFieldSetRecords(apiClient: SfApi, durableIds: string[]) : Promise<ToolingQueryRecords[]> {
  const allRecords : ToolingQueryRecords[] = []
  
  //Perform Tooling Query
  const BATCH_SIZE = 100

  for (let index = 0; index < durableIds.length; index+=BATCH_SIZE) {
    var sublist: string[] = []
    if(durableIds.length < index+BATCH_SIZE){
      sublist = durableIds.slice(index, durableIds.length)
    }else{
      sublist = durableIds.slice(index, BATCH_SIZE)
    }

    var query = `SELECT Id, EntityDefinitionId, DeveloperName, NamespacePrefix FROM FieldSet WHERE EntityDefinitionId IN ('${sublist.join("', '")}')`
    logger.debug(`query: ${query}`)
    const result = await apiClient.getToolingQuery(
      query
    )
    if(result){
      allRecords.push(...JSON.parse(JSON.stringify(result.records)))
    }
  }
  logger.debug(`allRecords.length: ${allRecords.length}`)
  return allRecords
}

/**
 * 
 * @param apiClient 
 * @param sObjectNames 
 * @param componentType 
 * @param nameField 
 * @param keyField 
 * @param whereStatement 
 * @param useTooling 
 * @param hasNamespacePrefix 
 * @returns array of MetadataComponentDependency items
 */
async function getMissingDependencies(apiClient: SfApi, sObjectNames: string[], componentType: string, nameField: string, keyField: string, whereStatement: string, useTooling: boolean, hasNamespacePrefix: boolean, config: ReportConfig) : Promise<MetadataComponentDependency[]> {
  const finalList : MetadataComponentDependency[] = []
  whereStatement = (whereStatement) ? (' AND ' + whereStatement) : ''
  var namespaceQry : string = hasNamespacePrefix ? ',NamespacePrefix' : ''
  if(useTooling){
    //Perform Tooling Query
    const allRecords: any[] = []
    var keySelection : string = (keyField !== nameField ? keyField : 'TableEnumOrId')
    const BATCH_SIZE = 100

    for (let index = 0; index < sObjectNames.length; index+=BATCH_SIZE) {
      var sublist: string[] = []
      if(sObjectNames.length < index+BATCH_SIZE){
        sublist = sObjectNames.slice(index, sObjectNames.length)
      }else{
        sublist = sObjectNames.slice(index, BATCH_SIZE)
      }

      var query = `SELECT ID, ${nameField}, ${keySelection+namespaceQry} FROM ${componentType} WHERE ${keyField} IN ('${sublist.join("', '")}')${whereStatement}`
      logger.debug(`==getMissingDependencies query: ${query}`)
      const result = await apiClient.getToolingQuery(
        query
      )
      if(result){
        allRecords.push(...result.records)
      }
    }

    if(allRecords){
      if(allRecords && allRecords.length > 0){
        allRecords.forEach(recordObj => {
          if(shouldProcessMetadata(config, componentType)){
            var mcd : MetadataComponentDependency = {
              MetadataComponentId: recordObj.Id,
              MetadataComponentType: componentType,
              MetadataComponentName: recordObj[nameField],
              MetadataComponentNamespace: hasNamespacePrefix ? recordObj['NamespacePrefix'] : null,
              RefMetadataComponentId: '',
              RefMetadataComponentType: recordObj[keySelection] != null && (recordObj[keySelection].endsWith('__c') || recordObj[keySelection].startsWith('01I')) ? 'CustomObject' : 'StandardEntity',
              RefMetadataComponentName: recordObj[keySelection],
              RefMetadataComponentNamespace: ''
            }
            finalList.push(mcd)
          }     
        })
      }
    }
  }else{
    //Perform Regular Query
    const allRecords: any[] = []
    const BATCH_SIZE = 100

    for (let index = 0; index < sObjectNames.length; index+=BATCH_SIZE) {
      var sublist: string[] = []
      if(sObjectNames.length < index+BATCH_SIZE){
        sublist = sObjectNames.slice(index, sObjectNames.length)
      }else{
        sublist = sObjectNames.slice(index, BATCH_SIZE)
      }

      var query = `SELECT ID, ${nameField}, ${keyField+namespaceQry} FROM ${componentType} WHERE ${keyField} IN ('${sublist.join("', '")}')${whereStatement}`
      logger.debug(`==getMissingDependencies query: ${query}`)
      const result = await apiClient.query(
        query
      )
      if(result){
        allRecords.push(...result.records)
      }
    }
    if(allRecords){
      if(allRecords && allRecords.length > 0){
        allRecords.forEach(recordObj => {
          if(shouldProcessMetadata(config, componentType)){
            var mcd : MetadataComponentDependency = {
              MetadataComponentId: recordObj['Id'],
              MetadataComponentType: componentType,
              MetadataComponentName: recordObj[nameField],
              MetadataComponentNamespace: hasNamespacePrefix ? recordObj['NamespacePrefix'] : null,
              RefMetadataComponentId: '',
              RefMetadataComponentType: recordObj[keyField] != null && (recordObj[keyField].endsWith('__c') || recordObj[keyField].startsWith('01I')) ? 'CustomObject' : 'StandardEntity',
              RefMetadataComponentName: recordObj[keyField],
              RefMetadataComponentNamespace: ''
            }
            finalList.push(mcd)
          }
        })
      }
    }
  }
  return finalList
}

async function getObjectFieldSets(apiClient : SfApi, mappedObjectInfo : MappedObjectsInfo, config : ReportConfig) : Promise<MetadataComponentDependency[]> {
  var fieldSetFields : MetadataComponentDependency[] = []
  var fieldSetNameToObjectNameMap : Map<string, string> = new Map() // Namespace__MyCustomObject__c.FieldSetName => QualifiedApiName (Namespace__MyCustomObject__c)
  var fieldSetNameToRecordMap : Map<string, any> = new Map()        // Namespace__MyCustomObject__c.CustomFieldSet => FieldSet record: { Id: string, EntityDefinitionId: string, DeveloperName: string, NamespacePrefix: string }
  var metadataReadMap : Map<string, any> = new Map()                // Namespace__MyCustomObject__c.CustomFieldSet => metadata/read item: { fullName: string, description: string, displayedFields: [ { field: string, isFieldManaged: bool, isRequired: bool } ], label: string }
    
  const customFieldNames : Set<string> = new Set()

  const results = await getFieldSetRecords(apiClient, Array.from(mappedObjectInfo.durableIdToQualifiedNamesMap.keys()))

  logger.debug(`result: ${JSON.stringify(results)}`)

  if(results.length){
    const records: any[] =  results
    logger.debug(`results.length: ${results.length}`)
    records.forEach(fieldSetRecord => {
      const fieldSetNamespace = fieldSetRecord['NamespacePrefix']
      const duraleIdNamespace = mappedObjectInfo.durableIdToNamespaceMap.get(fieldSetNamespace)
      let fieldSetName  = ''
      // logger.debug(`duraleIdNamespace: ${duraleIdNamespace}`)
      if(mappedObjectInfo.durableIdToQualifiedNamesMap.has(fieldSetRecord['EntityDefinitionId']) && (!fieldSetNamespace || (fieldSetNamespace && duraleIdNamespace))) {
        let fullyQualifiedObjectName : string = mappedObjectInfo.durableIdToQualifiedNamesMap.get(fieldSetRecord['EntityDefinitionId'])! // returns QualifiedApiName (Namespace__MyCustomObject__c)
        fieldSetName = fullyQualifiedObjectName + '.' + fieldSetRecord['DeveloperName']  // force Namespace__MyCustomObject__c.FieldSetName
        if(fullyQualifiedObjectName) {
          fieldSetNameToRecordMap.set(fieldSetName, fieldSetRecord)
          fieldSetNameToObjectNameMap.set(fieldSetName, fullyQualifiedObjectName)
        } else {
          // logger.debug(`${fieldSetName} is not in mappedObjectInfo.durableIdToQualifiedNamesMap!`)
        }
      } else {
        // logger.debug(`${fieldSetName} is not in mappedObjectInfo.durableIdToNamespaceMap!`)
      }
    })
  }

  //Fetch metadata for FieldSets
  var metadataRead : any[]
  if(fieldSetNameToRecordMap && fieldSetNameToRecordMap.size){
    
    // apiClient.createJsForceConnection()

    // const chunkSize = 10;
    // for (let i = 0; i < fieldSetNameToRecordMap.size; i += chunkSize) {
    //   const chunk = Array.from(fieldSetNameToRecordMap.keys()).slice(i, i + chunkSize);
    //   logger.debug(`chunk: ${chunk}`)
    //   await apiClient.jsforceConn.metadata.read('FieldSet',Array.from(chunk), function(err: any, fieldSetFieldResults: any) {
    //     if (err) { 
    //       logger.debug(
    //         `==ERROR: ${err}`,
    //       )
    //     }else{
    //       const metadataList : any[] = fieldSetFieldResults
    //       logger.debug(`metadataList.length: ${metadataList.length}`)
    //       if(metadataList && metadataList.length) {
    //         metadataList.forEach(item => {
    //           logger.debug(`item['fullName']: ${item['fullName']}`)
    //           if(item['fullName']) {
    //             metadataReadMap.set(item['fullName'], item)
    //           }
    //         });
    //       }
    //     }
    //   })
    // }

    metadataRead = await apiClient.readMetadata('FieldSet', Array.from(fieldSetNameToRecordMap.keys()))
    logger.debug(`FieldSet metadataList.length: ${metadataRead.length}`)
    if(metadataRead && metadataRead.length) {
      metadataRead.forEach(item => {
        // logger.debug(`item['fullName']: ${item['fullName']}`)
        if(item['fullName']) {
          metadataReadMap.set(item['fullName'], item)
        }
      })
    }
    
    // var failedChunk : string[] = []
    // for (let i = 0; i < fieldSetNameToRecordMap.size; i += chunkSize) {
    //   const chunk = Array.from(fieldSetNameToRecordMap.keys()).slice(i, i + chunkSize);
    //   // logger.debug(`chunk: ${chunk}`)
    //   try {
    //     await apiClient.jsforceConn.metadata.read('FieldSet',Array.from(chunk), function(err: any, fieldSetFieldResults: any) {
    //       if (err) { 
    //         logger.debug(
    //           `==ERROR: ${err}`,
    //         )
    //       }else{
    //         const metadataList : any[] = forceArray(fieldSetFieldResults)
    //         logger.debug(`FieldSet metadataList.length: ${metadataList.length}`)
    //         if(metadataList && metadataList.length) {
    //           metadataList.forEach(item => {
    //             // logger.debug(`item['fullName']: ${item['fullName']}`)
    //             if(item['fullName']) {
    //               metadataReadMap.set(item['fullName'], item)
    //             }
    //           });
    //         }
    //       }
    //     })
    //   } catch (error) {
    //     failedChunk = failedChunk.concat(Array.from(chunk))
    //     logger.debug(`failedChunk: ${failedChunk}`)
    //   }
    // }
    
    // if(failedChunk.length > 0) {
    //   // iterate through the chunk list one-by-one
    //   for (let i = 0; i < failedChunk.length; i++) {
    //     // logger.debug(`failedChunk[i]: ${failedChunk[i]}`)
    //     try {
    //       await apiClient.jsforceConn.metadata.read('FieldSet',Array.from([''+failedChunk[i]]), function(err: any, fieldSetFieldResults: any) {
    //         if (err) { 
    //           logger.debug(
    //             `==ERROR: ${err}`,
    //           )
    //         }else{
    //           const metadataList : any[] = forceArray(fieldSetFieldResults)
    //           logger.debug(`FieldSet failedChunk metadataList.length: ${metadataList.length}`)
    //           if(metadataList && metadataList.length) {
    //             metadataList.forEach(item => {
    //               // logger.debug(`item['fullName']: ${item['fullName']}`)
    //               if(item['fullName']) {
    //                 metadataReadMap.set(item['fullName'], item)
    //               }
    //             });
    //           }
    //         }
    //       })
    //     } catch (error) {
    //       logger.debug(
    //         `==error: ${error}`,
    //       )
    //     }
    //   }
    // }

    logger.debug(`fieldSetNameToRecordMap.size: ${fieldSetNameToRecordMap.size}`)
    Array.from(fieldSetNameToRecordMap.keys()).forEach(fieldSetName => {
      
      var objectName  = ''
      var objectNamespace  = ''
      if(fieldSetNameToObjectNameMap.has(fieldSetName)) {
        objectName = fieldSetNameToObjectNameMap.get(fieldSetName)!
        objectNamespace = mappedObjectInfo.qualifiedNameToEntityMap.has(objectName) ? mappedObjectInfo.qualifiedNameToEntityMap.get(objectName)!.NamespacePrefix : ''
      }
      
      var fieldSetQueryRecord : any = fieldSetNameToRecordMap.get(fieldSetName)!
      var metadataObj : any
      
      if(metadataReadMap.has(fieldSetName)){
        metadataObj = metadataReadMap.get(fieldSetName)!
      }else{
        return
      }

      var displayedFields : any[] = metadataObj['displayedFields']
      
      var parent : MetadataComponentDependency = {
        MetadataComponentId: fieldSetQueryRecord['Id'],
        MetadataComponentType: 'FieldSet',
        // force Namespace__FieldSetName to match records from the dependency API. If no Namespace, then use the DeveloperName
        MetadataComponentName: objectNamespace ? objectNamespace + '__' + fieldSetQueryRecord['DeveloperName'] : fieldSetQueryRecord['DeveloperName'], 
        MetadataComponentNamespace: objectNamespace,
        RefMetadataComponentId: objectName.endsWith('__c') ? mappedObjectInfo.allMappedObjectNameIdMap.get(objectName)! : objectName,
        RefMetadataComponentType: objectName.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
        RefMetadataComponentName: objectName.replace('__c', ''),
        RefMetadataComponentNamespace: ''
      }
      fieldSetFields.push(parent)

      //add dependency for each field
      // if(displayedFields) logger.debug(`displayedFields.length: ${displayedFields.length}`)
      if(displayedFields && displayedFields.length) {
        displayedFields.forEach(displayedField => {
          var fieldName = displayedField['field']
          if(fieldName){
            customFieldNames.add(objectName + '.' + fieldName)
            
            var child : MetadataComponentDependency = {
              MetadataComponentId: '', // unknown from the metadata/read response...we must query all CustomFields later, passing in the names of the CustomFields found in each FieldSet metadata/read record
              MetadataComponentType: fieldName.endsWith('__c') ? 'CustomField' : 'StandardField',
              MetadataComponentName: fieldName,
              MetadataComponentNamespace: objectNamespace,
              RefMetadataComponentId: fieldSetQueryRecord['Id'],
              RefMetadataComponentType: 'FieldSet',
              // force Namespace__FieldSetName to match records from the dependency API. If no Namespace, then use the DeveloperName
              RefMetadataComponentName: objectNamespace ? objectNamespace + '__' + fieldSetQueryRecord['DeveloperName'] : fieldSetQueryRecord['DeveloperName'],
              RefMetadataComponentNamespace: objectNamespace
            }
            fieldSetFields.push(child)
          }
        })
      }
    })
  }

  return fieldSetFields
}

async function getObjectRecordTypes(apiClient : SfApi, sObjectNames : string[], config: ReportConfig) : Promise<MetadataComponentDependency[]> {
  const existingRecordTypes : MetadataComponentDependency[] = await getMissingDependencies(apiClient, sObjectNames, 'RecordType', 'DeveloperName', 'SobjectType', '', false, true, config)
  const objectNameToRecordTypes : Map<string, MetadataComponentDependency[]> = new Map()
  var objectTypeRefs : MetadataComponentDependency[]
  existingRecordTypes.forEach(objectRecordTypeMcd => {
    if(objectNameToRecordTypes.has(objectRecordTypeMcd.RefMetadataComponentName)){
      objectTypeRefs = objectNameToRecordTypes.get(objectRecordTypeMcd.RefMetadataComponentName)!
    }else{
      objectTypeRefs = []
    }
    objectTypeRefs.push(objectRecordTypeMcd)
    objectNameToRecordTypes.set(objectRecordTypeMcd.RefMetadataComponentName, objectTypeRefs)
  })

  sObjectNames.forEach(sObjectName => {
    if(!objectNameToRecordTypes.has(sObjectName)){
      var mcd : MetadataComponentDependency = {
        MetadataComponentId: '',
        MetadataComponentType: 'RecordType',
        MetadataComponentName: 'Master',
        MetadataComponentNamespace: '',
        RefMetadataComponentId: '',
        RefMetadataComponentType: sObjectName.endsWith('__c') || sObjectName.startsWith('01I') ? 'CustomObject' : 'StandardEntity',
        RefMetadataComponentName: sObjectName,
        RefMetadataComponentNamespace: ''
      }
      existingRecordTypes.push(mcd)
    }
  })
  return existingRecordTypes
}

async function getObjectProcessFlows(apiClient : SfApi, sObjectNames : string[]) : Promise<MetadataComponentDependency[]> {
  var activeFlows : MetadataComponentDependency[] = []
  var metadataReadMap : Map<string, any> = new Map()
  const sObjectNameSet : Set<string> = new Set(sObjectNames)

  //Get active Flows
  var query = `SELECT Id, Definition.DeveloperName, ProcessType FROM Flow WHERE Definition.NamespacePrefix = null AND Status = 'Active'`
  const result = await apiClient.getToolingQuery(
    query
  )
  var flowNameToToolingObj : Map<string, any> = new Map()
  if(result){
    const records: any[] =  result.records
    records.forEach(toolingObj => {
      var developerName : string = toolingObj['Definition']['DeveloperName']
      flowNameToToolingObj.set(developerName, toolingObj)
    })
  }
  
  //Fetch metadata for active flows
  var metadataRead : any[]
  if(flowNameToToolingObj && flowNameToToolingObj.size){
    metadataRead = await apiClient.readMetadata('Flow', Array.from(flowNameToToolingObj.keys()))
    logger.debug(`Flow metadataRead.length: ${metadataRead.length}`)
    metadataRead.forEach(item => {
      if(item['fullName']) {
        metadataReadMap.set(item['fullName'], item)
      }
    })
    
    
    // apiClient.createJsForceConnection()

    // const chunkSize = 10;
    // for (let i = 0; i < Array.from(flowNameToToolingObj.keys()).length; i += chunkSize) {
    //   const chunk = Array.from(flowNameToToolingObj.keys()).slice(i, i + chunkSize)
    //   logger.debug(`chunk: ${chunk}`)
    //   const results = await apiClient.jsforceConn.metadata.read('Flow',Array.from(chunk))
    //   if(results){
    //     metadataList = forceArray(results)
    //     metadataList.forEach(item => {
    //       if(item['fullName']) {
    //         metadataReadMap.set(item['fullName'], item)
    //       }
    //     });
    //   }
    // }
    
    // var failedChunk : string[] = []
    // for (let i = 0; i < Array.from(flowNameToToolingObj.keys()).length; i += chunkSize) {
    //   const chunk = Array.from(flowNameToToolingObj.keys()).slice(i, i + chunkSize)
    //   // logger.debug(`chunk: ${chunk}`)
    //   try {
    //     const results = await apiClient.jsforceConn.metadata.read('Flow',Array.from(chunk))
    //     if(results){
    //       metadataList = forceArray(results)
    //       logger.debug(`Flow metadataList.length: ${metadataList.length}`)
    //       if(metadataList && metadataList.length) {
    //         metadataList.forEach(item => {
    //           if(item['fullName']) {
    //             metadataReadMap.set(item['fullName'], item)
    //           }
    //         });
    //       }
    //     }
    //   } catch (error) {
    //     failedChunk = failedChunk.concat(Array.from(chunk))
    //     logger.debug(`failedChunk: ${failedChunk}`)
    //   }
    // }
    
    // if(failedChunk.length > 0) {
    //   // iterate through the chunk list one-by-one
    //   for (let i = 0; i < failedChunk.length; i++) {
    //     // logger.debug(`failedChunk[i]: ${failedChunk[i]}`)
    //     try {
    //       const results = await apiClient.jsforceConn.metadata.read('Flow',[''+failedChunk[i]])
    //       if(results){
    //         metadataList = forceArray(results)
    //         logger.debug(`Flow failedChunk metadataList.length: ${metadataList.length}`)
    //         if(metadataList && metadataList.length) {
    //           metadataList.forEach(item => {
    //             if(item['fullName']) {
    //               metadataReadMap.set(item['fullName'], item)
    //             }
    //           });
    //         }
    //       }
    //     } catch (error) {
    //       logger.debug(
    //         `==error: ${error}`,
    //       )
    //     }
    //   }
    // }

    logger.debug(`metadataReadMap.size: ${metadataReadMap.size}`)
    
    Array.from(flowNameToToolingObj.keys()).forEach(flowName => {
      var toolingObj : any = flowNameToToolingObj.get(flowName)!
      var metadataObj : any
      if(metadataReadMap.has(flowName)){
        metadataObj = metadataReadMap.get(flowName)!
        // logger.debug(`metadataObj: ${JSON.stringify(metadataObj)}`)
      }else{
        return
      }

      // detect and report errors
      var metadataType : string = metadataObj['type']
      if( metadataType == 'ERROR' ) {
        return
      }

      var processType : string = toolingObj['ProcessType']
      // logger.debug(`processType: ${processType}`)
      switch (processType) {
        case 'Workflow':
          //Process Builder
          if(Array.isArray(metadataObj['processMetadataValues'])){
            var metaValueListObj : any[] = metadataObj['processMetadataValues']
            metaValueListObj.forEach(metaValueObj => {
              var oName : string = metaValueObj['name']
              if(oName === 'ObjectType'){
                var sobjectName = metaValueObj['value']['stringValue']
                if(sobjectName && sObjectNameSet.has(sobjectName)){
                  var mcd : MetadataComponentDependency = {
                    MetadataComponentId: toolingObj['Id'],
                    MetadataComponentType: 'Flow',
                    MetadataComponentName: flowName + ' (Process Builder)',
                    MetadataComponentNamespace: '',
                    RefMetadataComponentId: '',
                    RefMetadataComponentType: sobjectName != null && sobjectName.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
                    RefMetadataComponentName: sobjectName,
                    RefMetadataComponentNamespace: ''
                  }
                  activeFlows.push(mcd)
                }
              }
            })
          }
          break
        case 'Flow':
          //Screen Flow
          //find sobject type in metadata
          //find sobject type in recordLookup metadata
          var mcdParse : FlowParse = parseFlowElementForObject(flowName, 'Screen', toolingObj, metadataObj['recordLookups'], sObjectNameSet)
          activeFlows = activeFlows.concat(mcdParse.mcds)

          //find sobject type in recordUpdate metadata
          if (mcdParse.remainingSObjects.size !== 0) {
              mcdParse = parseFlowElementForObject(flowName, 'Screen', toolingObj, metadataObj['recordUpdates'], mcdParse.remainingSObjects)
              activeFlows = activeFlows.concat(mcdParse.mcds)
          }

          //find sobject type in recordDelete metadata
          if (mcdParse.remainingSObjects.size !== 0) {
              mcdParse = parseFlowElementForObject(flowName, 'Screen', toolingObj, metadataObj['recordDeletes'], mcdParse.remainingSObjects)
              activeFlows = activeFlows.concat(mcdParse.mcds)
          }
          break

        case 'AutoLaunchedFlow':
          //Auto launched
          var startObj : any = metadataObj['start']
          if (startObj) {
              //Check for Trigger based Flow
              //only add for requested object name
              var sobjectName : string = startObj['object']
              if (sobjectName && sObjectNameSet.has(sobjectName)) {
                  var mcd : MetadataComponentDependency = {
                    MetadataComponentId: toolingObj['Id'],
                    MetadataComponentType: 'Flow',
                    MetadataComponentName: flowName + ' (Trigger)',
                    MetadataComponentNamespace: '',
                    RefMetadataComponentId: '',
                    RefMetadataComponentType: sobjectName != null && sobjectName.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
                    RefMetadataComponentName: sobjectName,
                    RefMetadataComponentNamespace: ''
                  }
                  activeFlows.push(mcd)
              } 
          }
          //Auto flow non-trigger based
          else {
              //find sobject type in recordLookup metadata
              var mcdParse : FlowParse = parseFlowElementForObject(flowName, 'Flow', toolingObj, metadataObj['recordLookups'], sObjectNameSet)
              activeFlows = activeFlows.concat(mcdParse.mcds)

              //find sobject type in recordUpdate metadata
              if (mcdParse.remainingSObjects.size !== 0) {
                  mcdParse = parseFlowElementForObject(flowName, 'Flow', toolingObj, metadataObj['recordUpdates'], mcdParse.remainingSObjects)
                  activeFlows = activeFlows.concat(mcdParse.mcds)
              }

              //find sobject type in recordDelete metadata
              if (mcdParse.remainingSObjects.size !== 0) {
                  mcdParse = parseFlowElementForObject(flowName, 'Flow', toolingObj, metadataObj['recordDeletes'], mcdParse.remainingSObjects)
                  activeFlows = activeFlows.concat(mcdParse.mcds)
              }
          }
          break
        default:
          break
      }
    })
  }

  return activeFlows
}

function parseFlowElementForObject(flowName: string, flowType: string, toolingObj : any, flowMetadataObj: any, objectNames: Set<string>) : FlowParse {
  const response : FlowParse = {remainingSObjects : new Set(JSON.parse(JSON.stringify(Array.from(objectNames)))), mcds : []}

  if (flowMetadataObj != null) {
    //find sobject type in flow metadata
    //TODO: Might need to revise?
    const recordMetadataObjList : any[] = forceArray(flowMetadataObj)

    //process flow metadata elements
    recordMetadataObjList.forEach(metaValue => {
      var sobjectName : string = metaValue['object']
      //only add for requested object name
      if (sobjectName && response.remainingSObjects.has(sobjectName)) {
          var mcd : MetadataComponentDependency = {
            MetadataComponentId: toolingObj['Id'],
            MetadataComponentType: 'Flow',
            MetadataComponentName: flowName + (flowType != 'Flow' ? (' ('+flowType+')') : ''),
            MetadataComponentNamespace: '',
            RefMetadataComponentId: '',
            RefMetadataComponentName: sobjectName,
            RefMetadataComponentType: sobjectName != null && sobjectName.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
            RefMetadataComponentNamespace: ''
          }

          response.mcds.push(mcd)
          response.remainingSObjects.delete(sobjectName)
      }
    })
  }
  return response
}

async function getObjectQuickActions(apiClient : SfApi, mappedObjectInfo : MappedObjectsInfo) : Promise<MetadataComponentDependency[]> {
  const sObjectNames : string[] = mappedObjectInfo.objectNames
  const quickActionReadMap : Map<string, any> = new Map()
  const quickActionListMap : Map<string, any> = new Map()
  const quickActionDependencies : MetadataComponentDependency[] = []
  const quickActionNames : Set<string> = new Set()
  const QUICK_ACTION_EXCLUDES : string[] = 
    ['NewGroup', //Causes 500 error from metadata read
    'CollaborationGroup.NewGroupRecord', //returns undefined in read response
    'CollaborationGroup.NewGroupMember'] //returns undefined in read response]

  const metadataList : any[] = await apiClient.listMetadata('QuickAction')
  logger.debug(`==QuickAction metadataList.length: ${metadataList.length}`)
  if(metadataList && metadataList.length) {
    metadataList.forEach(item => {
      quickActionListMap.set(item['fullName'], item)
      quickActionNames.add(item['fullName'])
    })
  }

  QUICK_ACTION_EXCLUDES.forEach(excluder => {
    quickActionNames.delete(excluder)
  })

  const metadataRead = await apiClient.readMetadata('QuickAction', Array.from(quickActionNames))
  logger.debug(`==QuickAction metadataRead.length: ${metadataRead.length}`)
  if(metadataRead && metadataRead.length) {
    metadataRead.forEach(item => {
      // logger.debug(`==QuickAction Item: ${item}`)
      // logger.debug(`==QuickAction Item JSON: ${JSON.stringify(item)}`)
      quickActionReadMap.set(item['fullName'], item)
    })
    quickActionReadMap.delete('undefined')
  }
  

  const mappedObjects : Set<string> = new Set(sObjectNames)
  quickActionNames.forEach(quickActionName => {
    var quickActionReadObject : any = quickActionReadMap.get(quickActionName)
    if(!quickActionReadObject){
      return
    }
    // detect and report errors
    var metadataType : string = quickActionReadObject['type']
    if( metadataType == 'ERROR' ) {
        return
    }
    // logger.debug(`quickActionReadObject: ${JSON.stringify(quickActionReadObject)}`)
    //Object will either have a TargetObject value attached, or its name will be prepended to the Action Name
    var targetObject : string = quickActionReadObject['targetObject']
    var targetParent : string = (!quickActionName.includes('.')) ? '' : quickActionName.split('.')[0]
    if(targetParent && !targetObject){
      targetObject = targetParent
    }
    if((!targetObject) || ((targetObject === '' || mappedObjects.has(targetObject) == false) && (targetParent==='' || mappedObjects.has(targetParent) == false))){
      return
    }
    
    // make sure target object is set to the object that is in our mapped list
    if(!mappedObjects.has(targetObject) && mappedObjects.has(targetParent)){
      targetObject = targetParent
    }

    // logger.debug(`made it quickActionName: ${quickActionName}, targetObject: ${targetObject}, targetParent: ${targetParent}, mappedObjects.has(targetObject): ${mappedObjects.has(targetObject)}, mappedObjects.has(targetParent): ${mappedObjects.has(targetParent)}`)

    var quickActionListObject: any = quickActionListMap.get(quickActionName)
    if(!quickActionListObject){
      return
    }
    
    // Look through the existing objectNameObject map to see if we already have a quick action with this name and simply update the name to prevent duplicates. MappedObjects are the top-leel items.
    var quickActionAnalysisItemExists  = false
    var targetObjectItem : MigrationAnalysisItem = Array.from(mappedObjectInfo.objectNameObject.values()).find((parentItem) => {
      return ((parentItem.fromComponentType == ComponentType.CUSTOM_OBJECT || parentItem.fromComponentType == ComponentType.STANDARD_OBJECT)
      && parentItem.fromComponentName == targetObject)
    })!
    
    if(targetObjectItem) {
      var targetQuickActionItem : MigrationAnalysisItem = targetObjectItem.children.find((childItem) => { return childItem.fromComponentType == 'QuickAction' && childItem.fromComponentName == quickActionName.replace(targetParent+'.', '') })!
      
      if(targetQuickActionItem) {
        quickActionAnalysisItemExists = true
        // update the name of the item
        targetQuickActionItem.fromComponentName = targetQuickActionItem.fromComponentName + ' (' + metadataType + ')'
      }
    }

    if(!quickActionAnalysisItemExists) {
      var mcd : MetadataComponentDependency = {
        MetadataComponentId: quickActionReadObject['Id'],
        MetadataComponentType: 'QuickAction',
        MetadataComponentName: quickActionName + ' (' + metadataType + ')',
        MetadataComponentNamespace: '',
        RefMetadataComponentId: targetObject.endsWith('__c') ? mappedObjectInfo.allMappedObjectNameIdMap.get(targetObject.replace('__c', ''))! : targetObject,
        RefMetadataComponentType: targetObject.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
        RefMetadataComponentName: targetObject.replace('__c', ''),
        RefMetadataComponentNamespace: ''
      }
      quickActionDependencies.push(mcd)
    }
  })

  return quickActionDependencies
}

async function getObjectWorkflows(apiClient : SfApi, objectIdMap : Map<string,string>, config: ReportConfig) : Promise<MetadataComponentDependency[]> {
  const activeWorkflows : MetadataComponentDependency[] = []
  const sObjectNames : string[] = Array.from(objectIdMap.keys())
  const allWorkflows : MetadataComponentDependency[] = await getMissingDependencies(apiClient, sObjectNames, 'WorkflowRule', 'Name', 'TableEnumOrId', '', true, true, config)

  if(!allWorkflows || allWorkflows.length===0) {
    return activeWorkflows
  }

  // To filter to only active we need another callout to read from metadata API
  var objectNameToWorkflows : Map<string, any> = new Map()
  // var metadataOutput : any[];

  // const chunkSize = 10;
  // for (let i = 0; i < sObjectNames.length; i += chunkSize) {
  //   const chunk = Array.from(sObjectNames).slice(i, i + chunkSize);

  //   const workflowRead = await apiClient.jsforceConn.metadata.read('Workflow',Array.from(chunk))
  //   if(workflowRead){
  //       metadataOutput = forceArray(workflowRead)
  //       logger.debug(`Workflow metadataOutput.length: ${metadataOutput.length}`)
  //       if(metadataOutput && metadataOutput.length) {
  //         metadataOutput.forEach(item => {
  //           objectNameToWorkflows.set(item['fullName'], item)
  //         });
  //       }
  //   }
  // }
  
  // var failedChunk : string[] = []
  // for (let i = 0; i < sObjectNames.length; i += chunkSize) {
  //   const chunk = Array.from(sObjectNames).slice(i, i + chunkSize);
  //   // logger.debug(`chunk: ${chunk}`)
  //   try {
  //     const workflowRead = await apiClient.jsforceConn.metadata.read('Workflow',Array.from(chunk))
  //     if(workflowRead){
  //       metadataOutput = forceArray(workflowRead)
  //       logger.debug(`Workflow metadataOutput.length: ${metadataOutput.length}`)
  //       if(metadataOutput && metadataOutput.length) {
  //         metadataOutput.forEach(item => {
  //           objectNameToWorkflows.set(item['fullName'], item)
  //         });
  //       }
  //     }
  //   } catch (error) {
  //     failedChunk = failedChunk.concat(Array.from(chunk))
  //     logger.debug(`Workflow failedChunk: ${failedChunk}`)
  //   }
  // }
  
  // if(failedChunk.length > 0) {
  //   // iterate through the chunk list one-by-one
  //   for (let i = 0; i < failedChunk.length; i++) {
  //     // logger.debug(`failedChunk[i]: ${failedChunk[i]}`)
  //     try {
  //       const workflowRead = await apiClient.jsforceConn.metadata.read('Workflow',[''+failedChunk[i]])
  //       if(workflowRead){
  //         metadataOutput = forceArray(workflowRead)
  //         logger.debug(`Workflow failedChunk metadataOutput.length: ${metadataOutput.length}`)
  //         if(metadataOutput && metadataOutput.length) {
  //           metadataOutput.forEach(item => {
  //             objectNameToWorkflows.set(item['fullName'], item)
  //           });
  //         }
  //       }
  //     } catch (error) {
  //       logger.debug(
  //         `==error: ${error}`,
  //       )
  //     }
  //   }
  // }

  const metadataRead : any[] = await apiClient.readMetadata('Workflow', Array.from(sObjectNames))
  logger.debug(`Workflow metadataOutput.length: ${metadataRead.length}`)
  if(metadataRead && metadataRead.length) {
    metadataRead.forEach(item => {
      objectNameToWorkflows.set(item['fullName'], item)
    })
  }

  const activeAlerts : Set<string> = new Set()
  const activeFieldUpdates : Set<string>  = new Set()
  const activeOutboundMessages : Set<string>  = new Set()
  const activeTasks : Set<string>  = new Set()

  allWorkflows.forEach(workflowMcd => {
    var objectWorkflowMetadata : any = objectNameToWorkflows.get(workflowMcd.RefMetadataComponentName)
    if(!objectWorkflowMetadata) {
      return
    }

    // detect and report errors
    var metadataType : string = objectWorkflowMetadata['type']
    if( metadataType == 'ERROR' ) {
      logger.debug(
        `==ERROR: ${JSON.stringify(objectWorkflowMetadata)}`,
      )
      return
    }

    //parse rules object or list
    var rulesObj : any = objectWorkflowMetadata['rules']
    if(!rulesObj) {
        return
    }

    var rulesObjList : any[] = forceArray(rulesObj)

    //loop rules list for the object
    rulesObjList.forEach(workflowMetadata => {
      //remove inactive from workflows
      if (''+workflowMetadata['active'] === 'true' && workflowMcd.MetadataComponentName === ''+workflowMetadata['fullName']) {
        //add to list as active workflow
        activeWorkflows.push(workflowMcd)

        //parse active actions object or list
        var actionObjList : any[] = []
        //capture workflow actions
        if(workflowMetadata['actions']){
          actionObjList = forceArray(workflowMetadata['actions'])
        }

        //capture time trigger actions
        var timeObjList : any[] = []
        if(workflowMetadata['workflowTimeTriggers']){
          timeObjList = forceArray(workflowMetadata['workflowTimeTriggers'])

          timeObjList.forEach(timeEntry => {
            if(timeEntry['actions']){
              actionObjList.concat(forceArray(timeEntry['actions']))
            }
          })
        }

        actionObjList.forEach(actionEntry => {
          switch (''+actionEntry['type']) {
            case 'Alert':
              activeAlerts.add(''+actionEntry['name'])
              break
            case 'FieldUpdate':
              activeFieldUpdates.add(''+actionEntry['name'])
              break
            case 'OutboundMessage':
              activeOutboundMessages.add(''+actionEntry['name'])
              break
            case 'Task':
              activeTasks.add(''+actionEntry['name'])
              break
            default:
              break
          }
        })
      }
    })
  })

  //get related workflow actions and only add active to final list
  const allAlerts : MetadataComponentDependency[] = await getMissingDependencies(apiClient, Array.from(objectIdMap.values()), 'WorkflowAlert', 'DeveloperName', 'EntityDefinitionId', '', true, true, config)
  allAlerts.forEach(alertMcd => {
    if(activeAlerts.has(alertMcd.MetadataComponentName)){ //developer name should exact match
      activeWorkflows.push(alertMcd)
    }
  })

  const allFieldUpdates : MetadataComponentDependency[] = await getMissingDependencies(apiClient, sObjectNames, 'WorkflowFieldUpdate', 'Name', 'SourceTableEnumOrId', '', true, true, config)
  allFieldUpdates.forEach(updateMcd => {
    if(activeFieldUpdates.has(updateMcd.MetadataComponentName.replace(/\s/g, '_'))){ //we can't get developer name to try to match from name
      activeWorkflows.push(updateMcd)
    }
  })

  const allOutboundMessages : MetadataComponentDependency[] = await getMissingDependencies(apiClient, Array.from(objectIdMap.values()), 'WorkflowOutboundMessage', 'Name', 'EntityDefinitionId', '', true, true, config)
  allOutboundMessages.forEach(outboundMsgMcd => {
    if(activeOutboundMessages.has(outboundMsgMcd.MetadataComponentName.replace(/\s/g, '_'))){ //we can't get developer name to try to match from name
      activeWorkflows.push(outboundMsgMcd)
    }
  })

  const allTasks : MetadataComponentDependency[] = await getMissingDependencies(apiClient, Array.from(objectIdMap.values()), 'WorkflowTask', 'Subject', 'EntityDefinitionId', '', true, true, config)
  allTasks.forEach(taskMcd => {
    if(activeTasks.has(taskMcd.MetadataComponentName.replace(/\s/g, '_'))){ //we can't get developer name to try to match from name
      activeWorkflows.push(taskMcd)
    }
  })

  return activeWorkflows
}

async function getReportInfo(apiClient : SfApi, objectIdMap : Map<string,string>, objectMapping: Map<string, string>) : Promise<MetadataComponentDependency[]> {
  logger.debug(
    `==getReportInfo Start`,
  )
  var reportDependencyList : MetadataComponentDependency[] = []

  const reportTypeMetadataMap : Map<string, any> = new Map()
  const reportTypeListMap : Map<string, any> = new Map()

  //Retrieve Dashboards
  apiClient.createJsForceConnection()

  const metadataList : any[] = await apiClient.listMetadata('ReportType')
  logger.debug(`==ReportType metadataList.length: ${metadataList.length}`)
  if(metadataList && metadataList.length) {
    metadataList.forEach(item => {
      reportTypeListMap.set(item['fullName'], item)
    })
  }
  var metadataRead : any[]
  metadataRead = await apiClient.readMetadata('ReportType', Array.from(reportTypeListMap.keys()))
  logger.debug(`ReportType metadataOutput.length: ${metadataRead.length}`)
  if(metadataRead && metadataRead.length) {
    metadataRead.forEach(item => {
      reportTypeMetadataMap.set(item['fullName'], item)
    })
  }
  
  Array.from(reportTypeMetadataMap.keys()).forEach(reportType => {
    var reportTypeInfo : any = reportTypeMetadataMap.get(reportType)

    // detect and report errors
    var metadataType : string = reportTypeInfo['type']
    if( metadataType == 'ERROR' ) {
      logger.debug(
        `==ERROR: ${JSON.stringify(reportTypeInfo)}`,
      )
      return
    }

    var baseObject : string = ''+reportTypeInfo['baseObject']

    //if report type isn't related to user mapped objects skip
    if(!baseObject || !objectMapping.has(baseObject) || reportTypeListMap.get(reportType) == null) {return }

    //Else, proceed
    var reportTypeId : string = ''+(reportTypeListMap.get(reportType)['id'])

    //dependency Report Type to Object
    var mcd : MetadataComponentDependency = {
      MetadataComponentId: reportTypeId,
      MetadataComponentType: 'ReportType',
      MetadataComponentName: reportType,
      MetadataComponentNamespace: '',
      RefMetadataComponentId: ''+objectIdMap.get(baseObject),
      RefMetadataComponentType: baseObject.endsWith('__c') ? 'CustomObject' : 'StandardEntity',
      RefMetadataComponentName: baseObject,
      RefMetadataComponentNamespace: ''
    }
    reportDependencyList.push(mcd)

  })

  return reportDependencyList
}

async function getObjectWebLinks(apiClient : SfApi, sObjectNames : string[], allMappedObjectNameIdMap : Map<string, string>) : Promise<MetadataComponentDependency[]> {
  const webLinkDependencies : MetadataComponentDependency[] = []
  var query = `SELECT PageOrSobjectType, MasterLabel, DisplayType FROM WebLink WHERE PageOrSobjectType IN ('${sObjectNames.join("', '")}')`
  const result = await apiClient.query(
    query
  )
  if(result){
    const records: any[] =  result.records
    records.forEach(objectWeblink => {
      var mcd : MetadataComponentDependency = {
        MetadataComponentId: objectWeblink['Id'],
        MetadataComponentType: 'WebLink',
        MetadataComponentName: objectWeblink['MasterLabel'] + (objectWeblink['DisplayType'] == 'L' ? ' (Link)' : ' (Button)'),
        MetadataComponentNamespace: '',
        RefMetadataComponentId: objectWeblink['PageOrSobjectType'].endsWith('__c') ? allMappedObjectNameIdMap.get(objectWeblink['PageOrSobjectType'].replace('__c', '')) : objectWeblink['PageOrSobjectType'],
        RefMetadataComponentType: objectWeblink['PageOrSobjectType'].endsWith('__c') ? 'CustomObject' : 'StandardEntity',
        RefMetadataComponentName: objectWeblink['PageOrSobjectType'].replace('__c', ''),
        RefMetadataComponentNamespace: ''
      }
      webLinkDependencies.push(mcd)
    })
  }
  return webLinkDependencies
}

// async function getReportConfig(apiClient: SfApi, user : String) : Promise<ReportConfig> {
//   var resultConfig = await new Promise<{"ExcludedSections" : string[], "ExcludedMetadata" : string[]}>((resolve, reject) => {
//     apiClient.redis.get('config:'+user, (err, data) => {
//       var result : {"ExcludedSections" : string[], "ExcludedMetadata" : string[]} = {"ExcludedSections" : [], "ExcludedMetadata" : []};
//       if (err){
//         logger.debug(`==Error getting from Redis: ${err}`,)
//       }
//       if(data){
//         logger.debug(`==Data: ${data}`);
//         if(data !== 'nil'){
//           result = JSON.parse(data);
//         }
//       }
//       resolve(result);
//     })
//   });

//   return resultConfig;
// }

export function shouldProcessSection(config: ReportConfig, sectionName : string) : boolean {
  var shouldProcess = true
  if(config && config.ExcludedSections && config.ExcludedSections.length > 0){
    return !config.ExcludedSections.includes(sectionName)
  }
  return shouldProcess
}

export function shouldProcessMetadata(config: ReportConfig, apiName : string) : boolean {
  var shouldProcess = true
  if(config && config.ExcludedMetadata && config.ExcludedMetadata.length > 0){
    return !config.ExcludedMetadata.includes(apiName)
  }
  return shouldProcess
}

export interface MigrationAnalysisItem {
  uuid: string
  fromComponentId: string
  fromComponentName: string
  fromComponentType: string
  fromComponentUrl: string
  fromComponentSize?: string
  toComponentName?: string
  toComponentUrl?: string
  fromComponentInternalSharing?: string
  fromComponentExternalSharing?: string
  fromComponentArchiveAfterMonths?: string
  fromComponentArchiveRetentionYears?: string
  reasonText?: string
  effort?: string
  children: MigrationAnalysisItem[]
}

export interface CustomObject {
  Id: string,
  DeveloperName: string,
  NamespacePrefix: string
}

export interface EntityDefinition {
  DurableId: string,
  Label: string,
  QualifiedApiName: string,
  DeveloperName: string,
  KeyPrefix: string,
  NamespacePrefix: string,
  InternalSharingModel: string,
  ExternalSharingModel: string
}

export interface MappedObjectsInfo {
  mappedObjectRecords: EntityDefinition[],                // [ { DurableId: string, QualifiedApiName: string, DeveloperName: string, KeyPrefix: string, NamespacePrefix: string } ]
  objectMapping: Map<string, string>,                     // QualifiedApiName (Namespace__MyCustomObject__c) => Namespace__DestinationObject__c
  overallObjectMapping: Map<string, string>,              // QualifiedApiName (Namespace__MyCustomObject__c) => { Namespace__DestinationObject__c, Namespace__DestinationObject2__c }
  fieldMapping: Map<string, string>,
  allMappedObjectNameIdMap : Map<string, string>          // MyCustomObject => ID
  objectNameObject: Map<string, MigrationAnalysisItem>    // MyCustomObject__c => MigrationAnalysisItem
  componentNameToItem: Map<string, MigrationAnalysisItem> // "ComponentName" => MigrationAnalysisItem
  objectIdToInternalName: Map<string, string>             // ID => DeveloperName (MyCustomObject)
  objectNameToId: Map<string, string>                     // MyCustomObject__c => ID
  layoutNames: string[]                                   // "Layout Name"
  objectNames: string[]                                   // MyCustomObject__c
  entityDefIdToDeveloperNameMap: Map<string, string>      // EntityDefinitionId (StandardObjectName || "01I...") => DeveloperName (MyCustomObject) (FIELD SET: EntityDefinitionId for standard objects are names, custom objects are Ids)
  durableIdToQualifiedNamesMap: Map<string, string>       // DurableId (StandardObjectName || "01I...") => QualifiedApiName (Namespace__MyCustomObject__c)
  qualifiedNameToEntityMap: Map<string, EntityDefinition> // QualifiedApiName (Namespace__MyCustomObject__c) => EntityDefinition: [ { DurableId: string, QualifiedApiName: string, DeveloperName: string, KeyPrefix: string, NamespacePrefix: string } ]
  durableIdToNamespaceMap: Map<string, string>            // DurableId (StandardObjectName || "01I...") => NamespacePrefix
}

export interface FlowParse {
  remainingSObjects : Set<string>;
  mcds : MetadataComponentDependency[];
}

export interface ReportConfig {
  ExcludedSections: string[],
  ExcludedMetadata: string[]
}
