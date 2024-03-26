import JSZip from 'jszip'
import { RedisClient } from 'redis'
import RSMQWorker from 'rsmq-worker'
import Stream from 'stream'
import * as xml2js from 'xml2js'
import { firstCharLowerCase, forceArray } from '../../util/general'
import {
  OracleFieldToSfField,
  SfFieldToOracleField,
} from '../../util/listViewStandardFieldTranslation'
import logger from '../../util/logger'
import { QUEUE_INTERVAL } from '../../util/secrets'
import { SfApi } from '../../util/sfApi'
import {
  Component,
  componentToMemberType,
  ComponentType,
  componentTypeToExtension,
  customObjectTypes,
  DeploymentList,
  excludeMetadataRetrieveTypes,
  filterIgnored,
  parseChildRelationship,
} from '../../util/sfDependencyHelper'
import { DeploymentPackage } from '../../util/sfDeploymentPackage'
import {
  generateComponentXml,
  generateDeploymentZip,
  generatePackageXml,
  PackageFile,
} from '../../util/sfDeploymentPackageGenerator'
import {
  CustomField,
  CustomObject,
  EmailTemplate,
  FieldPermission,
  FieldSet,
  Layout,
  LayoutAssignment,
  LayoutColumn,
  LayoutItem,
  ListView,
  ObjectPermission,
  PermissionSet,
  PermissionSetRecordTypeVisibility,
  Profile,
  ProfileRecordTypeVisibility,
  RecordType,
} from '../../util/sfPackageType'

interface MessageObj {
  OrgInfo: {
    InstanceUrl: string
    IsSandbox: boolean
    Username: string
    OrgId: string
    AccessToken: string
    ApiVersion: string
  }
  DeploymentChecklistFileId: string
  AssessmentId: string
  Namespace: string
  RequestId: string
}

const REDIS_WORKER_QUEUE_NAME = 'deploymentPackageQueue'
const SF_DEPLOYMENT_LIST_FILENAME = 'deploymentList.json'
const SF_PACKAGE_FILENAME = 'DeploymentPackage.zip'
const SF_ASSESSMENT_OBJECT = 'Assessment__c'
const SF_ASSESSMENT_SUB_STATUS = 'Sub_Status__c'
const SF_ASSESSMENT_LAST_PACKAGE_DATE = 'Last_Package_Created_Date__c'
const SF_RECORD_STATUS_COMPLETE = 'Deployment Package Ready'
const TOOLING_QUERY_SINGLEPROFILEQUERY =
  'SELECT Id, Name, FullName FROM Profile WHERE Name = '

class GenerateDeploymentPackageQueue {
  client!: RSMQWorker.Client

  start(redis: RedisClient) {
    this.client = new RSMQWorker(REDIS_WORKER_QUEUE_NAME, {
      redis,
      autostart: true,
      timeout: 6 * 60 * 1000,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // NOTE: interval DOES except number | number[] but the @types definition have not been updated
      //  https://github.com/mpneuried/rsmq-worker/blob/master/README.md#options-interval
      interval: QUEUE_INTERVAL,
    })

    this.client.on('message', async function (msg, next, id) {
      try {
        const {
          OrgInfo: { Username, OrgId, InstanceUrl, IsSandbox, ApiVersion },
          AssessmentId,
          Namespace,
          DeploymentChecklistFileId,
          RequestId,
        } = JSON.parse(msg) as MessageObj
        logger.debug(`[${REDIS_WORKER_QUEUE_NAME}:${id}] ${msg}`, RequestId)
        const sfApi = await new SfApi(
          InstanceUrl,
          Username,
          OrgId,
          ApiVersion,
          IsSandbox,
          redis,
          RequestId,
          AssessmentId,
          Namespace,
        )

        sfApi.createJsForceConnection()
        // get contentversionId from documentId: SELECT Id FROM ContentVersion WHERE ContentDocumentId = :fileDocId AND IsLatest = true
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching latest ContentVersion Id from Document ${DeploymentChecklistFileId}`,
          RequestId,
        )
        const contentVersionId = (await sfApi.getContentVersionIds(
          DeploymentChecklistFileId,
          true,
        )) as string
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetched latest ContentVersion Id ${contentVersionId} from Document ${DeploymentChecklistFileId}`,
          RequestId,
        )

        // Download mapping/deployment file (ContentVersion.Body)
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetching ${SF_DEPLOYMENT_LIST_FILENAME}...`,
          RequestId,
        )
        const { deployment, mapping }: DeploymentList = JSON.parse(
          (
            await sfApi.fetchRecord('ContentVersion', contentVersionId)
          ).toString(),
        )
        logger.debug(
          `[${REDIS_WORKER_QUEUE_NAME}:${id}] Fetched ${SF_DEPLOYMENT_LIST_FILENAME}`,
          RequestId,
        )

        logger.debug(deployment, RequestId)
        logger.debug(
          {
            sourceToDestinationObject: mapping.sourceToDestinationObject,
            sourceToDestinationField: mapping.sourceToDestinationField,
            sourceToDestinationRecordType:
              mapping.sourceToDestinationRecordType,
          },
          RequestId,
        )

        const deploymentPackage = new DeploymentPackage()
        const targetLayoutObjects = new Map<string, Layout>()
        const targetProfiles = new Map<string, Profile>()
        const targetPermissionsSets = new Map<string, PermissionSet>()
        const targetEmailTemplates = new Map<string, EmailTemplate>()
        const targetEmailTemplateBodies = new Map<string, string>()

        // Initialize Custom objects
        const targetCustomObjects = new Map<string, CustomObject>()
        deployment
          .filter((section) => customObjectTypes.includes(section.sectionName)) // Filter out non-CustomObject type sections/components
          .forEach((section) =>
            section.components.forEach(({ targetObject, componentType }) => {
              if (section.sectionName === ComponentType.CHILD_RELATIONSHIP) {
                targetObject = parseChildRelationship(targetObject)
              }

              if (targetObject && !targetCustomObjects.get(targetObject)) {
                targetCustomObjects.set(targetObject, {
                  fieldSets: [],
                  fields: [],
                  recordTypes: [],
                  compactLayouts: [],
                  validationRules: [],
                  listViews: [],
                  type: ComponentType.CUSTOM_OBJECT,
                })
              }
            }),
          )

        // NOTE: do loop to create retrieve metadata request
        //  THEN loop over components to apply logic for metadata type

        // Metadata API Retrieve Existing Metadata components related to Legacy Objects
        // TODO: there is probably a way to reduce code redundancy w/ SfApi.fetchRecord()
        // TODO: dont run this if there are no excludeMetadataRetrieveTypes
        const packageZip: Buffer = await new Promise(async (resolve) => {
          const data: Uint8Array[] = []
          const writableStream = new Stream.Writable()
          writableStream._write = (chunk, encoding, next) => {
            data.push(chunk)
            next()
          }
          writableStream._final = () => {
            resolve(Buffer.concat(data))
          }
          // Create types to retrieve metadata for
          // Exclude metadata retrieve on types that do not require it ie CustomFields/RecordTypes

          // Metadata API Retrieve
          const types = deployment
            .filter(
              (section) =>
                !excludeMetadataRetrieveTypes.includes(section.sectionName),
            )
            .map(({ sectionName, components }) => ({
              name: (sectionName === ComponentType.CHILD_RELATIONSHIP
                ? ComponentType.CUSTOM_FIELD
                : sectionName) as ComponentType,
              members: components
                .map((component) =>
                  componentToMemberType({ sectionName, ...component }),
                )
                .filter((member) => member.length),
            }))

          //Get Custom Objects along with Profiles
          // ## NOTE: This will only get Profiles which are associated with the enumerated Custom Objects - not all of them
          const objectMembers = {
            name: ComponentType.CUSTOM_OBJECT,
            members: mapping.mappedObjects,
          }
          types.push(objectMembers)

          //Get Custom Fields along with Profiles
          const fieldMembers = {
            name: ComponentType.CUSTOM_FIELD,
            members: mapping.mappedFields,
          }
          types.push(fieldMembers)

          // Loop over the 'types' nested Array and "fix" / swap out the Profile Names in types
          // call function to query Profile FullName by Name one at a time
          // storing all queriedProfiles in Array object: resolvedProfiles
          const resolvedProfiles: string[] = await new Promise(
            async (resolve) => {
              const profileMembers = types.filter((node) =>
                node.name.startsWith('Profile'),
              )
              logger.debug(`Types Profiles: ${JSON.stringify(profileMembers)}`)
              let profileNameObject: any
              // Only try to build resolvedProfiles Array if at least 1 Profile is unchecked in Deploy Checklist
              if (profileMembers.length > 0) {
                profileNameObject = await generateProfileMap(
                  profileMembers,
                  sfApi,
                )
              }
              resolve(profileNameObject)
            },
          )
          // logger.debug(`ProfileNameObject: ${JSON.stringify(resolvedProfiles)}`)

          const typesObject: any[] = Object.values(
            JSON.parse(JSON.stringify(types)),
          )

          const typesArrayIndexListView = typesObject.findIndex(
            (element) => element.name === 'ListView',
          )
          const typesArrayIndexProfile = typesObject.findIndex(
            (element) => element.name === 'Profile',
          )

          // Should be index of 0
          logger.debug(
            `Index of 'ListView' in types: ${typesArrayIndexListView}`,
          )
          // Should be index of 1 or 2
          logger.debug(`Index of 'Profile' in types: ${typesArrayIndexProfile}`)

          // Replace Profile 'Name'(s) with Profile 'FullName' (s) in the types Array so that the retrieve call uses the correct names
          // Add conditional check in case to ensure at least 1 Profile is checked in Deployment List
          if (typesArrayIndexProfile !== -1 && resolvedProfiles.length > 1) {
            types[typesArrayIndexProfile].members = resolvedProfiles

            logger.debug(
              `New types 'Profile' values: ${types[typesArrayIndexProfile].members}`,
            )
            logger.debug(`resolvedProfiles values: ${resolvedProfiles}`) // looks like this: ServiceCloud,Silver Partner User,SolutionManager,StandardAul,Standard,Admin
          }

          logger.debug(`Retrieve Types: ${JSON.stringify(types)}`, RequestId)

          sfApi.jsforceConn.metadata
            .retrieve({
              unpackaged: {
                types,
                version: ApiVersion,
              },
            })
            // Note: for some reason .stream() does not exist on type 'RetrieveResultLocator '.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            .stream()
            .pipe(writableStream)
        })
        const zip = await new JSZip().loadAsync(packageZip)
        logger.debug(
          `Retrieved Metadata Files: ${JSON.stringify(Object.keys(zip.files))}`,
          RequestId,
        )

        for (const section of deployment) {
          const { sectionName } = section
          logger.debug(`Processing ${sectionName} components`, RequestId)
          switch (sectionName) {
            case ComponentType.RECORD_TYPE: {
              // Iterate components custom fields
              section.components.forEach(({ newMeta, targetObject }) => {
                const { apiName, label, active, description } = newMeta
                // Build and populate customObjects
                const customRecord: RecordType = {
                  fullName: apiName,
                  label,
                  active,
                }
                if (description) customRecord['description'] = description
                const targetCustomObject = targetCustomObjects.get(targetObject)
                if (targetCustomObject) {
                  targetCustomObject.recordTypes.push(customRecord)
                }
                // Populate packageTypes
                deploymentPackage.addPackageMember(
                  sectionName,
                  `${targetObject}.${customRecord.fullName}`,
                )
              })
              break
            }
            case ComponentType.CHILD_RELATIONSHIP:
            case ComponentType.CUSTOM_FIELD: {
              // Iterate components custom fields
              for (const component of section.components) {
                let { sourceObject, targetObject } = component
                const { newMeta, componentId, componentLabel } = component
                const metadataKeyTranslator = (
                  key: string,
                  value: string,
                ): Record<string, string> | null => {
                  switch (key) {
                    case 'apiName':
                      return { fullName: value }
                    case 'dataType':
                      return { type: value.replace('-', '') }
                    case 'helpText':
                      return { inlineHelpText: value }
                    case 'defaultValue':
                      return { [key]: `"${value}"` }
                    case 'childRelationshipName':
                      return { relationshipName: value }
                    case 'connectedObject': {
                      return { referenceTo: value }
                    }
                    default:
                      return { [key]: value }
                  }
                }
                // Filter out null values and 'defaultValue' key (due to falsy nature of 0's, the presence of scale is an exception to this rule)
                const targetField: CustomField = Object.entries(newMeta)
                .filter((entry) => (!!entry[1] || (entry[0] === 'scale')))
                  // Translate the metadata
                  .reduce(
                    (accumulator, entry) => ({
                      ...accumulator,
                      ...metadataKeyTranslator(...entry),
                    }),
                    {} as CustomField,
                  )

                if (sectionName === ComponentType.CHILD_RELATIONSHIP) {
                  // Remove everything after '-> '
                  targetObject = parseChildRelationship(targetObject)
                  sourceObject = parseChildRelationship(sourceObject)
                  // Populate the customField.label with the source component's label
                  const metadataType = customObjectTypes.includes(sectionName)
                    ? ComponentType.CUSTOM_OBJECT
                    : sectionName
                  const extension =
                    componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible
                  const metadataFile =
                    zip.files[
                      `unpackaged/${extension}s/${targetObject}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                    ]
                  if (!metadataFile) {
                    logger.error(
                      `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${sourceObject}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                    )
                    continue
                  }
                  const xmlNodeStream:
                    | string
                    | undefined = await metadataFile?.async('string')

                  if (!xmlNodeStream) {
                    logger.error(
                      `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                      RequestId,
                    )
                    continue
                  }
                  // Parse the xml to json
                  // https://www.npmjs.com/package/xml2js#options
                  const xmlParser = new xml2js.Parser({
                    explicitArray: false,
                  })

                  const parsed: CustomObject = (
                    await xmlParser.parseStringPromise(xmlNodeStream)
                  )[metadataType]
                  const fields = forceArray(parsed.fields)
                  const sourceField = fields.find(
                    (field) => field.fullName === componentId,
                  )
                  if (sourceField) {
                    targetField.label = sourceField.label
                  } else {
                    logger.error(
                      `Unable to extract corresponding source field label from ${sourceObject}.${componentId}`,
                      RequestId,
                    )
                  }
                }

                // logger.debug(targetObject)
                // logger.debug(targetCustomObjects)
                const targetCustomObject = targetCustomObjects.get(targetObject)
                if (targetCustomObject) {
                  targetCustomObject.fields.push(targetField)
                }
                // Populate packageTypes
                deploymentPackage.addPackageMember(
                  ComponentType.CUSTOM_FIELD,
                  `${targetObject}.${targetField.fullName}`,
                )
              }
              break
            }
            case ComponentType.FIELD_SET: {
              const metadataType = customObjectTypes.includes(sectionName)
                ? ComponentType.CUSTOM_OBJECT
                : sectionName

              // Get file by
              const extension = componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible

              // Group components by sourceObject
              const groupedComponents = section.components.reduce(
                (accumulator, component) => {
                  if (accumulator[component.sourceObject]) {
                    accumulator[component.sourceObject] = [
                      ...accumulator[component.sourceObject],
                      component,
                    ]
                  } else {
                    accumulator[component.sourceObject] = [component]
                  }
                  return accumulator
                },
                {} as Record<string, Component[]>,
              )

              for (const [sourceObject, components] of Object.entries(
                groupedComponents,
              )) {
                const metadataFile =
                  zip.files[
                    `unpackaged/${extension}s/${sourceObject}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                  ]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${sourceObject}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }
                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }
                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                const xmlParser = new xml2js.Parser({ explicitArray: false })

                const parsed = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[metadataType]

                // NOTE: 'parsed[firstCharLowerCase(sectionName) + 's']' may not work with other metadata types. Maybe make map?
                let sourceFieldSets: FieldSet[] =
                  parsed[firstCharLowerCase(sectionName) + 's']

                // Note: xmlParser will return FieldSet if there is only one fieldset and FieldSet[] if there is >1
                sourceFieldSets = forceArray(sourceFieldSets)

                const targetCustomObject = targetCustomObjects.get(
                  mapping.sourceToDestinationObject[sourceObject],
                )
                if (targetCustomObject) {
                  if (Object.keys(mapping.sourceToDestinationField).length) {
                    for (const component of components) {
                      const sourceFieldSet = sourceFieldSets.find(
                        (sourceFieldSet) =>
                          sourceFieldSet.fullName === component.componentName,
                      )
                      if (sourceFieldSet) {
                        const targetDisplayedFields = []
                        if (sourceFieldSet.displayedFields) {
                          // Convert to array if not array already
                          sourceFieldSet.displayedFields = forceArray(
                            sourceFieldSet.displayedFields,
                          )
                          const setOfFieldNames: string[] = []
                          for (const sourceDisplayField of sourceFieldSet.displayedFields) {
                            const destinationField =
                              mapping.sourceToDestinationField[
                                `${sourceObject}.${sourceDisplayField.field}`
                              ]
                            if (destinationField) {
                              sourceDisplayField.field = destinationField
                                .split('.')
                                .pop() as string

                              if (
                                !setOfFieldNames.includes(
                                  sourceDisplayField.field,
                                )
                              ) {
                                targetDisplayedFields.push(sourceDisplayField)
                                setOfFieldNames.push(sourceDisplayField.field)
                              }
                            }
                          }
                          sourceFieldSet.displayedFields = targetDisplayedFields
                        }

                        if (sourceFieldSet.availableFields) {
                          sourceFieldSet.availableFields = forceArray(
                            sourceFieldSet.availableFields,
                          )
                          const setOfFieldNames: string[] = []
                          for (const sourceAvailableFields of sourceFieldSet.availableFields) {
                            const destinationField =
                              mapping.sourceToDestinationField[
                                `${sourceObject}.${sourceAvailableFields.field}`
                              ]
                            if (destinationField) {
                              sourceAvailableFields.field = destinationField
                                .split('.')
                                .pop() as string
                              if (
                                !setOfFieldNames.includes(
                                  sourceAvailableFields.field,
                                )
                              ) {
                                targetDisplayedFields.push(
                                  sourceAvailableFields,
                                )
                                setOfFieldNames.push(
                                  sourceAvailableFields.field,
                                )
                              }
                            }
                          }
                          sourceFieldSet.availableFields = targetDisplayedFields
                        }
                        targetCustomObject.fieldSets.push(sourceFieldSet)
                      } else {
                        logger.warn(
                          `Unable to locate sourceFieldSet '${component.componentName}' in '${metadataFile.name}'`,
                          RequestId,
                        )
                      }
                    }
                  } else {
                    // If no field mappings are required then delete all displayFields and add to targetCustomObject
                    for (const component of components) {
                      const sourceFieldSet = sourceFieldSets.find(
                        (sourceFieldSet) =>
                          sourceFieldSet.fullName === component.componentName,
                      )
                      if (sourceFieldSet) {
                        delete sourceFieldSet.displayedFields
                        // delete sourceFieldSet.availableFields
                        targetCustomObject.fieldSets.push(sourceFieldSet)
                      }
                    }
                  }
                  targetCustomObject.fieldSets.forEach((fieldSet) => {
                    deploymentPackage.addPackageMember(
                      sectionName,
                      `${mapping.sourceToDestinationObject[sourceObject]}.${fieldSet.fullName}`, // short term fix
                    )
                  })
                } else
                  logger.error(
                    `Unable to locate customObjects[${targetCustomObject}]} using mapping.sourceToDestinationObject[${sourceObject}]`,
                    RequestId,
                  )
              }
              break
            }
            // M. Boyle - 4/4/22 fix for Profiles using Name instead of FullName # HCTA-359
            case ComponentType.PROFILE: {
              for (const {
                componentName,
                componentType,
              } of section.components) {
                // call function to query Profile Name & FullName one at a time
                // then return the FullName (not storing all queriedProfiles in a Map variable at this time)
                // ## Possible enhancement: extract the Profile FullName from the ProfileNameObject instead of re-querying against the org
                const profileFullName = await querySingleProfile(
                  sfApi,
                  componentName,
                )

                //TODO: Profile Name - use the profileFullName (not FullName) because that is what's stored in md file
                const xmlNodeStream:
                  | string
                  | undefined = await readMetadataFile(
                  componentType,
                  profileFullName, // componentName,
                  RequestId,
                  zip,
                )
                if (xmlNodeStream === 'SKIP_FILE') {
                  continue
                }

                const parsedProfile: Profile = (await parseXml(xmlNodeStream))[
                  componentType
                ]

                const objectPermissions: ObjectPermission[] = forceArray(
                  parsedProfile.objectPermissions,
                )
                let fieldPermissions: FieldPermission[] = forceArray(
                  parsedProfile.fieldPermissions,
                )

                const layoutAssignments: LayoutAssignment[] = forceArray(
                  parsedProfile.layoutAssignments,
                )

                const recordTypeVisibilities: ProfileRecordTypeVisibility[] = forceArray(
                  parsedProfile.recordTypeVisibilities,
                )

                // Group components by sourceObject
                const objectToPermissions = objectPermissions.reduce(
                  (accumulator, objectPermission) => {
                    accumulator[objectPermission.object] = objectPermission
                    return accumulator
                  },
                  {} as Record<string, ObjectPermission>,
                )

                // Group components by sourceObject
                const fieldToPermissions = fieldPermissions.reduce(
                  (accumulator, fieldPermission) => {
                    accumulator[fieldPermission.field] = fieldPermission
                    return accumulator
                  },
                  {} as Record<string, FieldPermission>,
                )

                // Object Permissions
                const targetObjectPermissions = []
                for (const [sourceObject, destinationObject] of Object.entries(
                  mapping.sourceToDestinationObject,
                )) {
                  const targetPermission = objectToPermissions[sourceObject]
                  if (targetPermission) {
                    targetPermission.object = destinationObject
                    targetObjectPermissions.push(targetPermission)
                  }
                }

                // Field Permissions
                // Filter out ignored fields (NOTE: this is temporary)
                const sourceToDestinationFields = filterIgnored(
                  mapping.sourceToDestinationField,
                )
                if (Object.keys(sourceToDestinationFields).length) {
                  for (const [sourceField, destinationField] of Object.entries(
                    sourceToDestinationFields,
                  )) {
                    //Don't need to process the same object
                    if (sourceField === destinationField) continue
                    const sourcePermissions = fieldToPermissions[sourceField]
                    const targetPermissions = { ...sourcePermissions }
                    delete fieldToPermissions[sourceField]
                    targetPermissions.field = destinationField
                    fieldToPermissions[destinationField] = targetPermissions
                  }
                  fieldPermissions = []
                  for (const [fieldName, permissions] of Object.entries(
                    fieldToPermissions,
                  )) {
                    fieldPermissions.push(permissions)
                  }
                } else {
                  fieldPermissions = []
                }

                // Layout assignments
                let targetLayoutAssignments: LayoutAssignment[] = []
                const pageLayouts = deployment.find(
                  (section) => section.sectionName === ComponentType.LAYOUT,
                )?.components
                if (pageLayouts) {
                  targetLayoutAssignments = layoutAssignments.reduce(
                    (accumulator, { layout, recordType }) => {
                      const pageLayout = pageLayouts.find(
                        (pageLayout) =>
                          layout ===
                            `${pageLayout.sourceObject}-${pageLayout.componentName}` &&
                          (!recordType ||
                            Object.keys(
                              mapping.sourceToDestinationRecordType,
                            ).includes(recordType)),
                      )
                      if (pageLayout) {
                        const { sourceObject, targetObject } = pageLayout
                        const targetLayoutAssignment: LayoutAssignment = {
                          layout: layout.replace(
                            `${sourceObject}-`,
                            `${targetObject}-`,
                          ),
                        }
                        if (recordType)
                          targetLayoutAssignment.recordType = recordType.replace(
                            recordType,
                            mapping.sourceToDestinationRecordType[recordType],
                          )
                        accumulator.push(targetLayoutAssignment)
                      }
                      return accumulator
                    },
                    [] as LayoutAssignment[],
                  )
                }

                // Record Type Visibility
                const targetRecordTypeVisibilities: ProfileRecordTypeVisibility[] = recordTypeVisibilities.reduce(
                  (accumulator, recordTypeVisibility) => {
                    // Match the source recordType to a source record in the assessment mapping
                    const targetRecordType =
                      mapping.sourceToDestinationRecordType[
                        recordTypeVisibility.recordType
                      ]
                    if (targetRecordType) {
                      recordTypeVisibility.recordType = targetRecordType
                      accumulator.push(recordTypeVisibility)
                    }
                    return accumulator
                  },
                  [] as ProfileRecordTypeVisibility[],
                )

                //Updated the profile with new permissions
                parsedProfile.objectPermissions = targetObjectPermissions
                parsedProfile.fieldPermissions = fieldPermissions
                parsedProfile.layoutAssignments = targetLayoutAssignments
                parsedProfile.recordTypeVisibilities = targetRecordTypeVisibilities
                // TODO:  Decide whether or not these need to be changed back
                targetProfiles.set(profileFullName, parsedProfile) //componentName
                deploymentPackage.addPackageMember(sectionName, profileFullName) //change 4/18/22 from componentName
              }
              break
            }
            // TODO???:  Will this use the correct Profile Name?
            case ComponentType.PERMISSION_SET: {
              for (const {
                componentName,
                componentType,
              } of section.components) {
                //Profile Name
                const xmlNodeStream:
                  | string
                  | undefined = await readMetadataFile(
                  componentType,
                  componentName,
                  RequestId,
                  zip,
                )
                if (xmlNodeStream === 'SKIP_FILE') {
                  continue
                }

                const parsedPermissionSet: PermissionSet = (
                  await parseXml(xmlNodeStream)
                )[componentType]

                const objectPermissions: ObjectPermission[] = forceArray(
                  parsedPermissionSet.objectPermissions,
                )
                const fieldPermissions: FieldPermission[] = forceArray(
                  parsedPermissionSet.fieldPermissions,
                )

                const recordTypeVisibilities: PermissionSetRecordTypeVisibility[] = forceArray(
                  parsedPermissionSet.recordTypeVisibilities,
                )

                // Object Permissions
                for (const [sourceObject, destinationObject] of Object.entries(
                  mapping.sourceToDestinationObject,
                )) {
                  //Don't need to process the same object
                  if (sourceObject === destinationObject) continue
                  // Find the target permission we need to copy from the source permission and shallow clone it
                  const targetPermission = {
                    ...(objectPermissions.find(
                      (objectPermission) =>
                        objectPermission.object === sourceObject,
                    ) as ObjectPermission),
                  }
                  if (Object.keys(targetPermission).length) {
                    // Check if destination object already exists
                    const destinationPermission = objectPermissions.find(
                      (objectPermission) =>
                        objectPermission.object === destinationObject,
                    )
                    // If destination object already exists remove it
                    if (destinationPermission) {
                      objectPermissions.splice(
                        objectPermissions.indexOf(destinationPermission),
                        1,
                      )
                    }
                    // Update permission object name and add to target permission
                    targetPermission.object = destinationObject
                    objectPermissions.push(targetPermission)
                  } else {
                    logger.warn(
                      `Unable to find targetPermission object ${sourceObject} in ${componentName}'s PermissionSet `,
                      RequestId,
                    )
                  }
                }

                // Field Permissions
                // Filter out ignored fields (NOTE: this is temporary)
                const sourceToDestinationFields = filterIgnored(
                  mapping.sourceToDestinationField,
                )
                if (Object.keys(sourceToDestinationFields).length) {
                  for (const [sourceField, destinationField] of Object.entries(
                    sourceToDestinationFields,
                  )) {
                    //Don't need to process the same object
                    if (sourceField === destinationField) continue
                    // Find the target permission we need to copy from the source permission and shallow clone it
                    const targetPermission = {
                      ...(fieldPermissions.find(
                        (fieldPermission) =>
                          fieldPermission.field === sourceField,
                      ) as FieldPermission),
                    }
                    if (Object.keys(targetPermission).length) {
                      // Check if destination object already exists
                      const destinationPermission = fieldPermissions.find(
                        (fieldPermission) =>
                          fieldPermission.field === destinationField,
                      )
                      // If destination object already exists remove it
                      if (destinationPermission) {
                        fieldPermissions.splice(
                          fieldPermissions.indexOf(destinationPermission),
                          1,
                        )
                      }
                      // Update permission object name and add to target permission
                      targetPermission.field = destinationField
                      fieldPermissions.push(targetPermission)
                    } else {
                      logger.warn(
                        `Unable to find targetPermission field ${sourceField} in ${componentName}'s PermissionSet `,
                        RequestId,
                      )
                    }
                  }
                }

                // Record Type Visibility
                const targetRecordTypeVisibilities: PermissionSetRecordTypeVisibility[] = recordTypeVisibilities.reduce(
                  (accumulator, recordTypeVisibility) => {
                    // Match the source recordType to a source record in the assessment mapping
                    const targetRecordType =
                      mapping.sourceToDestinationRecordType[
                        recordTypeVisibility.recordType
                      ]
                    if (targetRecordType) {
                      recordTypeVisibility.recordType = targetRecordType
                      accumulator.push(recordTypeVisibility)
                    }
                    return accumulator
                  },
                  [] as PermissionSetRecordTypeVisibility[],
                )

                // Updated the permissions set with new permissions
                // NOTE: we re-assign objectPermissions[] back to parsedPermissionSet.objectPermissions because its
                //  possible parsedPermissionSet.objectPermissions could have been parsed from XML as an object and not an array
                parsedPermissionSet.objectPermissions = objectPermissions
                parsedPermissionSet.fieldPermissions = fieldPermissions
                parsedPermissionSet.recordTypeVisibilities = targetRecordTypeVisibilities
                targetPermissionsSets.set(componentName, parsedPermissionSet)
                deploymentPackage.addPackageMember(sectionName, componentName)
              }
              break
            }
            case ComponentType.LAYOUT:
              // eslint-disable-next-line no-case-declarations
              const extension =
                componentTypeToExtension.get(section.sectionName) || '' // TODO: '' should not be possible
              for (const component of section.components) {
                const filePath = `unpackaged/${extension}s/${componentToMemberType(
                  { sectionName, ...component },
                )}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                const metadataFile = zip.files[filePath]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${filePath}' from Metadata Retrieve zip`,
                  )
                  continue
                }
                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }
                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                const xmlParser = new xml2js.Parser({ explicitArray: false })

                const sourceLayout: Layout = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[section.sectionName]

                const targetObject: Layout = {
                  layoutSections: [],
                }
                if (Object.keys(mapping.sourceToDestinationField).length) {
                  // Iterate Sections
                  sourceLayout.layoutSections = forceArray(
                    sourceLayout.layoutSections,
                  )
                  for (const sourceLayoutSection of sourceLayout.layoutSections) {
                    const targetLayoutColumns: LayoutColumn[] = []
                    sourceLayoutSection.layoutColumns = forceArray(
                      sourceLayoutSection.layoutColumns,
                    )
                    // Iterate Columns
                    for (const sourceLayoutColumn of sourceLayoutSection.layoutColumns) {
                      if (sourceLayoutColumn) {
                        sourceLayoutColumn.layoutItems = forceArray(
                          sourceLayoutColumn.layoutItems,
                        )
                        const targetLayoutItems: LayoutItem[] = []
                        // Iterate layouts
                        for (const sourceLayoutItem of sourceLayoutColumn.layoutItems) {
                          const destinationField =
                            mapping.sourceToDestinationField[
                              `${component.sourceObject}.${sourceLayoutItem.field}`
                            ]
                          if (destinationField) {
                            sourceLayoutItem.field = destinationField
                              .split('.')
                              .pop() as string
                            targetLayoutItems.push(sourceLayoutItem)
                          }
                        }
                        targetLayoutColumns.push({
                          layoutItems: targetLayoutItems,
                        })
                      }
                    }
                    sourceLayoutSection.layoutColumns = targetLayoutColumns // Replace the layout columns, but keep the section properties
                    targetObject.layoutSections.push(sourceLayoutSection)
                  }
                } else {
                  // If no field mappings are required then delete all layoutColumns and add to targetCustomObject
                  sourceLayout.layoutSections.forEach((sourceLayoutSection) => {
                    sourceLayoutSection.layoutColumns = []
                  })

                  targetObject.layoutSections.push(
                    ...sourceLayout.layoutSections,
                  )
                }
                targetLayoutObjects.set(
                  `${component.targetObject}-${component.componentName}`,
                  targetObject,
                )
                deploymentPackage.addPackageMember(
                  sectionName,
                  `${component.targetObject}-${component.componentName}`,
                )
              }
              break
            case ComponentType.COMPACT_LAYOUT: {
              const metadataType = customObjectTypes.includes(sectionName)
                ? ComponentType.CUSTOM_OBJECT
                : sectionName

              // Get file by
              const extension = componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible

              // Group components by sourceObject
              const groupedComponents = section.components.reduce(
                (accumulator, component) => {
                  if (accumulator[component.sourceObject]) {
                    accumulator[component.sourceObject] = [
                      ...accumulator[component.sourceObject],
                      component,
                    ]
                  } else {
                    accumulator[component.sourceObject] = [component]
                  }
                  return accumulator
                },
                {} as Record<string, Component[]>,
              )

              for (const [sourceObject, components] of Object.entries(
                groupedComponents,
              )) {
                const metadataFile =
                  zip.files[
                    `unpackaged/${extension}s/${sourceObject}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                  ]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${sourceObject}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }
                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }
                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                const xmlParser = new xml2js.Parser({ explicitArray: false })

                const sourceCustomObject: CustomObject = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[metadataType]

                // Get compact layouts from source object
                const sourceCompactLayouts = forceArray(
                  sourceCustomObject.compactLayouts,
                )

                // Dont add to package.xml or sourceCompactLayouts if there are no mapping.sourceToDestinationField entries for this
                if (Object.keys(mapping.sourceToDestinationField).length) {
                  for (const component of components) {
                    const targetCustomObject = targetCustomObjects.get(
                      component.targetObject,
                    )
                    if (targetCustomObject) {
                      // Grab source compact layout from the custom objects' compact layouts
                      const sourceCompactLayout = sourceCompactLayouts.find(
                        (sourceCompactLayout) =>
                          sourceCompactLayout.fullName ===
                          component.componentName,
                      )
                      if (sourceCompactLayout) {
                        const targetFields: string[] = []
                        for (const sourceField of forceArray(
                          sourceCompactLayout.fields,
                        )) {
                          const destinationField =
                            mapping.sourceToDestinationField[
                              `${sourceObject}.${sourceField}`
                            ]
                          if (destinationField) {
                            targetFields.push(
                              destinationField.split('.').pop() as string,
                            )
                          }
                        }
                        if (targetFields.length) {
                          sourceCompactLayout.fields = targetFields
                          targetCustomObject.compactLayouts.push(
                            sourceCompactLayout,
                          )
                        }
                        deploymentPackage.addPackageMember(
                          sectionName,
                          `${component.targetObject}.${sourceCompactLayout.fullName}`,
                        )
                      } else {
                        logger.warn(
                          `Unable to find source CompactLayout: ${component.sourceObject}.${component.componentName}`,
                          RequestId,
                        )
                      }
                    } else
                      logger.error(
                        `Unable to locate customObjects[${component.targetObject}]}`,
                        RequestId,
                      )
                  }
                }
              }

              break
            }
            case ComponentType.VALIDATION_RULE: {
              const metadataType = customObjectTypes.includes(sectionName)
                ? ComponentType.CUSTOM_OBJECT
                : sectionName

              // Get file by
              const extension = componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible

              // Group components by sourceObject
              const groupedComponents = section.components.reduce(
                (accumulator, component) => {
                  if (accumulator[component.sourceObject]) {
                    accumulator[component.sourceObject] = [
                      ...accumulator[component.sourceObject],
                      component,
                    ]
                  } else {
                    accumulator[component.sourceObject] = [component]
                  }
                  return accumulator
                },
                {} as Record<string, Component[]>,
              )

              for (const [sourceObject, components] of Object.entries(
                groupedComponents,
              )) {
                const metadataFile =
                  zip.files[
                    `unpackaged/${extension}s/${sourceObject}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                  ]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${sourceObject}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }
                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }
                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                const xmlParser = new xml2js.Parser({ explicitArray: false })

                const sourceCustomObject: CustomObject = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[metadataType]

                const sourceValidationRules = forceArray(
                  sourceCustomObject.validationRules,
                )
                // Parse source object fields from mapping
                const sourceObjectTargetFields = Object.entries(
                  mapping.sourceToDestinationField,
                ).filter(([key, value]) => key.startsWith(`${sourceObject}.`))
                for (const component of components) {
                  const sourceValidationRule = sourceValidationRules.find(
                    (sourceValidationRule) =>
                      sourceValidationRule.fullName === component.componentName,
                  )
                  if (sourceValidationRule) {
                    const targetObjectTargetFields = sourceObjectTargetFields
                      // Filter only components that target field starts with the target object
                      .filter(([sourceField, targetField]) =>
                        targetField.startsWith(`${component.targetObject}.`),
                      )
                      // Parse the field names from the key/value strings. Object.FirstName -> FirstName
                      .map(([sourceField, targetField]) => [
                        sourceField.split('.')[1],
                        targetField.split('.')[1],
                      ])
                      // Filter out source/target fields that haven't changed name
                      .filter(
                        ([sourceField, targetField]) =>
                          sourceField !== targetField,
                      )
                    // Update the source validation rule with new fields
                    targetObjectTargetFields.forEach(
                      ([sourceField, targetField]) => {
                        // Match on sourceField that isnt surrounded by other alphabet numbers and is not wrapped in ' or "
                        const regex = new RegExp(
                          `(?!\\B\'[^\']*|\\B"[^"]*)\\b${sourceField}\\b(?![^\']*\'\\B|[^"]*"\\B)`,
                          'g',
                        )
                        sourceValidationRule.errorConditionFormula = sourceValidationRule.errorConditionFormula.replace(
                          regex,
                          targetField,
                        )
                      },
                    )
                    const targetCustomObject = targetCustomObjects.get(
                      component.targetObject,
                    )
                    if (targetCustomObject) {
                      targetCustomObject.validationRules.push(
                        sourceValidationRule,
                      )
                    }
                    // Populate packageTypes
                    deploymentPackage.addPackageMember(
                      sectionName,
                      `${component.targetObject}.${sourceValidationRule.fullName}`,
                    )
                  }
                }
              }
              break
            }
            case ComponentType.EMAIL_TEMPLATE: {
              const metadataType = customObjectTypes.includes(sectionName)
                ? ComponentType.CUSTOM_OBJECT
                : sectionName

              // Get file by
              const extension = componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible
              for (const component of section.components) {
                // TODO: replace `unfiled$public/${component.componentName}` with just ${component.componentName} since it will contain the folder name
                const metadataFile =
                  zip.files[
                    `unpackaged/email/${component.componentName}.${extension}`
                  ]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/email/${component.componentName}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }

                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }

                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                // Parse email templates AND objects bc they are separate files
                const xmlParser = new xml2js.Parser({ explicitArray: false })
                const sourceEmailObject: EmailTemplate = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[metadataType]

                const emailTemplateFile =
                  zip.files[`unpackaged/email/${component.componentName}.email`]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/email/${component.componentName}.email`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }
                let sourceEmailBody:
                  | string
                  | undefined = await emailTemplateFile?.async('string')

                if (!sourceEmailBody) {
                  logger.error(
                    `xmlNodeStream for ${emailTemplateFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }

                const sourceFields = Object.entries(
                  mapping.sourceToDestinationField,
                ).filter(
                  ([key, value]) =>
                    key.startsWith(`${component.sourceObject}.`) &&
                    value.startsWith(`${component.targetObject}.`),
                )
                for (const [
                  sourceFieldString,
                  destinationFieldString,
                ] of sourceFields) {
                  const [sourceObject, sourceField] = sourceFieldString.split(
                    '.',
                  )
                  const [
                    destinationObject,
                    destinationField,
                  ] = destinationFieldString.split('.')

                  // Regex to match multiple strings within '{!' and '}'
                  // * strings must end wih '.' and are not in quotes
                  let regex = new RegExp(
                    `({!.*?)(?!\\B\'[^\']*|\\B"[^"]*)${sourceObject}(.)(?![^\']*\'\\B|[^"]*"\\B)(.*?})`,
                    'g',
                  )
                  let replaceValue = `$1${destinationObject}$2$3`
                  // Replace object portion first
                  sourceEmailObject.subject = sourceEmailObject.subject.replace(
                    regex,
                    replaceValue,
                  )
                  sourceEmailBody = sourceEmailBody.replace(regex, replaceValue)
                  // Replace field portion
                  regex = new RegExp(
                    `({!.*?)(?!\\B\'[^\']*|\\B"[^"]*)${destinationObject}.${sourceField}(?![^\']*\'\\B|[^"]*"\\B)(.*?})`,
                    'g',
                  )
                  replaceValue = `$1${destinationObject}.${destinationField}$2`

                  sourceEmailObject.subject = sourceEmailObject.subject.replace(
                    regex,
                    replaceValue,
                  )
                  sourceEmailBody = sourceEmailBody.replace(regex, replaceValue)
                }
                logger.debug(sourceEmailBody)
                targetEmailTemplates.set(
                  component.componentName,
                  sourceEmailObject,
                )
                targetEmailTemplateBodies.set(
                  component.componentName,
                  sourceEmailBody,
                )
                deploymentPackage.addPackageMember(
                  sectionName,
                  component.componentName,
                )
              }
              break
            }
            case ComponentType.LIST_VIEW: {
              // If no field level mapping exist then there is no need to proceed
              if (!Object.keys(mapping.sourceToDestinationField).length) {
                logger.info(
                  'Skipping ListView(s) section since no sourceToDestinationField mappings are specified',
                  RequestId,
                )
                break
              }
              const metadataType = customObjectTypes.includes(sectionName)
                ? ComponentType.CUSTOM_OBJECT
                : sectionName

              // Get file by
              const extension = componentTypeToExtension.get(metadataType) || '' // TODO: '' should not be possible

              // Group components by sourceObject
              const groupedComponents = section.components.reduce(
                (accumulator, component) => {
                  if (accumulator[component.sourceObject]) {
                    accumulator[component.sourceObject] = [
                      ...accumulator[component.sourceObject],
                      component,
                    ]
                  } else {
                    accumulator[component.sourceObject] = [component]
                  }
                  return accumulator
                },
                {} as Record<string, Component[]>,
              )

              for (const [sourceObject, components] of Object.entries(
                groupedComponents,
              )) {
                logger.debug(sourceObject)
                const metadataFile =
                  zip.files[
                    `unpackaged/${extension}s/${sourceObject}.${extension}` // Note: '${extension}s' this might not always work, in that case we need a map
                  ]
                if (!metadataFile) {
                  logger.error(
                    `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${sourceObject}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
                  )
                  continue
                }
                const xmlNodeStream:
                  | string
                  | undefined = await metadataFile?.async('string')

                if (!xmlNodeStream) {
                  logger.error(
                    `xmlNodeStream for ${metadataFile.name} is null|undefined`,
                    RequestId,
                  )
                  continue
                }
                // Parse the xml to json
                // https://www.npmjs.com/package/xml2js#options
                const xmlParser = new xml2js.Parser({ explicitArray: false })

                const parsed = (
                  await xmlParser.parseStringPromise(xmlNodeStream)
                )[metadataType]
                let listViews: ListView[] =
                  parsed[firstCharLowerCase(sectionName) + 's']
                listViews = forceArray(listViews)

                const sourceObjectTargetFields = Object.entries(
                  mapping.sourceToDestinationField,
                ).filter(([key]) => key.startsWith(`${sourceObject}.`))

                for (const { targetObject, componentName } of components) {
                  const sourceListView = listViews.find(
                    (sourceListView) =>
                      sourceListView.fullName === componentName,
                  )
                  if (sourceListView) {
                    // process columns
                    sourceListView.columns = forceArray(sourceListView.columns)
                    const targetColumns: string[] = []
                    for (const column of sourceListView.columns) {
                      const mappedField = sourceObjectTargetFields.find(
                        ([sourceField]) =>
                          sourceField.toLowerCase() ===
                          OracleFieldToSfField(
                            column,
                            sourceObject,
                          ).toLowerCase(),
                      )
                      if (mappedField) {
                        const targetField = mappedField[1]
                        targetColumns.push(
                          column.replace(
                            column,
                            SfFieldToOracleField(targetField.split('.')[1]),
                          ),
                        )
                      }
                    }
                    sourceListView.columns = targetColumns

                    // process filters.filed and filters.value
                    sourceListView.filters = forceArray(sourceListView.filters)
                    const targetFilters: {
                      field: string
                      operation: string
                      value: string
                    }[] = []
                    for (const filter of sourceListView.filters) {
                      const mappedField = sourceObjectTargetFields.find(
                        // Match on object.field or just field (if it's a custom object) on filter.field or filter.value
                        ([sourceField]) => {
                          logger.debug(
                            `${OracleFieldToSfField(
                              filter.field,
                              sourceObject,
                            ).toLowerCase()} === ${sourceField.toLowerCase()}`,
                          )
                          return (
                            sourceField.toLowerCase() ===
                              OracleFieldToSfField(
                                filter.field,
                                sourceObject,
                              ).toLowerCase() ||
                            (filter.value &&
                              sourceField.toLowerCase() ===
                                OracleFieldToSfField(
                                  filter.value,
                                  sourceObject,
                                ).toLowerCase())
                          )
                        },
                      )
                      if (mappedField) {
                        const targetField = mappedField[1].split('.')[1]
                        // Note: use full object.field path when the target field is NOT a custom field
                        filter.field = filter.field?.replace(
                          filter.field,
                          SfFieldToOracleField(targetField),
                        )
                        filter.value = filter.value?.replace(
                          filter.field,
                          SfFieldToOracleField(targetField),
                        )
                        targetFilters.push(filter)
                      }
                    }
                    sourceListView.filters = targetFilters

                    // Only add to deployment package if we have at least one mapped column
                    if (sourceListView.columns.length) {
                      const targetCustomObject = targetCustomObjects.get(
                        targetObject,
                      )
                      if (targetCustomObject) {
                        targetCustomObject.listViews.push(sourceListView)
                      }
                      // Populate packageTypes
                      deploymentPackage.addPackageMember(
                        sectionName,
                        `${targetObject}.${sourceListView.fullName}`,
                      )
                    }
                  } else {
                    logger.warn(
                      `Unable to find source ListView: ${sourceObject}.${componentName}`,
                      RequestId,
                    )
                  }
                }
              }
              break
            }
            default:
              logger.warn(
                `Unsupported Section type: ${section.sectionName}`,
                RequestId,
              )
          }
        }

        logger.debug(
          `Done processing ${SF_DEPLOYMENT_LIST_FILENAME}`,
          RequestId,
        )

        const packageFiles: PackageFile[] = []
        // Handle CustomObject individual package files
        // logger.debug(targetCustomObjects)
        Array.from(targetCustomObjects).forEach(
          ([
            componentName,
            {
              fields,
              recordTypes,
              fieldSets,
              compactLayouts,
              type,
              validationRules,
              listViews,
            },
          ]) => {
            // Only generate component XML if at least one property has items in it
            if (
              fields.length ||
              recordTypes.length ||
              fieldSets.length ||
              compactLayouts.length ||
              validationRules.length ||
              listViews.length
            ) {
              packageFiles.push(
                generateComponentXml(type, componentName, {
                  fields,
                  recordTypes,
                  fieldSets,
                  compactLayouts,
                  validationRules,
                  listViews,
                }),
              )
            }
          },
        )

        // Handle Layout Object individual package files
        // logger.debug(targetLayoutObjects)
        Array.from(targetLayoutObjects).forEach(
          ([componentName, customObject]) => {
            packageFiles.push(
              generateComponentXml(ComponentType.LAYOUT, componentName, {
                layoutSections: customObject.layoutSections,
              }),
            )
          },
        )

        // Handle Profiles package files
        // logger.debug(targetProfiles)
        Array.from(targetProfiles).map(([profileName, profileConfig]) => {
          packageFiles.push(
            generateComponentXml(ComponentType.PROFILE, profileName, {
              objectPermissions: profileConfig.objectPermissions,
              fieldPermissions: profileConfig.fieldPermissions,
              layoutAssignments: profileConfig.layoutAssignments,
              recordTypeVisibilities: profileConfig.recordTypeVisibilities,
            }),
          )
        })

        // Handle Permission Set package files
        Array.from(targetPermissionsSets).map(
          ([permissionSetName, permissionSetConfig]) => {
            packageFiles.push(
              generateComponentXml(
                ComponentType.PERMISSION_SET,
                permissionSetName,
                permissionSetConfig,
              ),
            )
          },
        )

        // Handle Email Template package files
        Array.from(targetEmailTemplates).map(([componentName, object]) => {
          packageFiles.push(
            generateComponentXml(
              ComponentType.EMAIL_TEMPLATE,
              componentName,
              object,
            ),
          )
        })

        // Handle Email Template Body package files
        Array.from(targetEmailTemplateBodies).map(([componentName, object]) => {
          packageFiles.push({
            name: `${componentName}.email`,
            dataXml: object,
            type: ComponentType.EMAIL_TEMPLATE_BODY,
          })
        })

        // Create root pacakgeXml
        const packageXml = generatePackageXml(deploymentPackage.packageTypes)

        // Combine all into zip
        const zipBuffer = await generateDeploymentZip(packageXml, packageFiles)
        const success = await sfApi.insertFile(
          AssessmentId,
          SF_PACKAGE_FILENAME,
          zipBuffer,
        )
        logger.debug(`Inserted File ${SF_PACKAGE_FILENAME}: ${success}`)
        // Update status
        await sfApi.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_ASSESSMENT_SUB_STATUS}`]: SF_RECORD_STATUS_COMPLETE,
          },
        )

        // Let SF know to refresh
        await sfApi.updateRecordData(
          `${Namespace}${SF_ASSESSMENT_OBJECT}`,
          AssessmentId,
          {
            [`${Namespace}${SF_ASSESSMENT_LAST_PACKAGE_DATE}`]: new Date().toISOString(),
          },
        )
        //ACK MQ
        next()
      } catch (error) {
        if (error instanceof Error) {
        logger.error(error.stack)
        //ACK MQ
        next()
        }
      }
    })

    this.client.on('connected', (err, msg) => {
      console.log(err, msg)
    })

    // optional error listeners
    this.client.on('error', function (err, msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}]${err}`)
    })
    this.client.on('exceeded', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] EXCEEDED`)
    })
    this.client.on('timeout', function (msg) {
      logger.error(`[${REDIS_WORKER_QUEUE_NAME}:${msg.id}] TIMEOUT ${msg.rc}`)
    })
  }
}

export async function readMetadataFile(
  componentType: ComponentType,
  componentName: string,
  RequestId: string,
  zip: JSZip,
): Promise<string> {
  // Get file by
  const extension = componentTypeToExtension.get(componentType) || '' // TODO: '' should not be possible
  // Get Object Profile settings for Source Object
  const metadataFile =
    zip.files[
      `unpackaged/${extension}s/${componentName // Note: '${extension}s' this might not always work, in that case we need a map
        // Encode : and .
        .replace(':', '%3A')
        .replace('.', '%2E')}.${extension}`
    ]

  if (!metadataFile) {
    logger.error(
      `[${RequestId}] Unable to unpack '${`unpackaged/${extension}s/${componentName}.${extension}`}' from ${SF_PACKAGE_FILENAME}`,
      RequestId,
    )
    return 'SKIP_FILE'
  }

  const xmlNodeStream: string | undefined = await metadataFile?.async('string')

  if (!xmlNodeStream) {
    logger.error(
      `xmlNodeStream for ${metadataFile.name} is null|undefined`,
      RequestId,
    )
    return 'SKIP_FILE'
  }

  return xmlNodeStream
}

export async function parseXml(xmlNodeStream: string): Promise<any> {
  // Parse the xml to json
  // https://www.npmjs.com/package/xml2js#options
  const xmlParser = new xml2js.Parser({ explicitArray: false })

  /* const parsed = (
    await xmlParser.parseStringPromise(xmlNodeStream)
  )[ComponentType.PROFILE] */
  return await xmlParser.parseStringPromise(xmlNodeStream)
}

// get SF Profile Name by querying using FullName via Tooling API
async function querySingleProfile(
  apiClient: SfApi,
  profileName: string,
): Promise<string> {
  const profileResult = await apiClient.getToolingQuery(
    TOOLING_QUERY_SINGLEPROFILEQUERY.concat(" '" + profileName + "'"),
  )

  // Create a placeholder for the FullName value
  let resultString = ''

  // parse the query result to get FullName
  const profileString: any = {
    ...JSON.parse(JSON.stringify(profileResult.records)),
  }
  logger.debug(
    `[SfApi:getToolingQuery] Fetched Type / value: ${
      typeof profileString + ' / ' + JSON.stringify(profileString)
    }`,
  )
  //const profileString: unknown = { ...profileTyped }
  logger.debug(
    `[SfApi:getToolingQuery] Fetched value from Array: ${profileString[0].FullName}`,
  )
  resultString = profileString[0].FullName

  return resultString
}

async function generateProfileMap(
  profileMembers: { name: ComponentType; members: string[] }[],
  sfApi: SfApi,
) {
  // const profileNameMap = new Map<string, string>() // map variable is coming back null
  const profObject = JSON.parse(JSON.stringify(profileMembers[0].members))
  const profileObjectMap: [string, string][] = Object.entries(profObject)
  const returnedProfileObject = []
  for (const profileName of profileObjectMap) {
    const profileFullName = await querySingleProfile(sfApi, profileName[1])
    logger.debug(`[generateProfileMap] inserts value ${profileFullName}`)
    // TODO: we don't need the first argument of the push function - just the FullName // profileName[0] -- MAYBE...
    returnedProfileObject.push(profileFullName)
  }
  logger.debug(
    `[generateProfileMap] map type / value ${typeof returnedProfileObject}, ${JSON.stringify(
      returnedProfileObject,
    )}`,
  )
  return returnedProfileObject
}

export default new GenerateDeploymentPackageQueue()
