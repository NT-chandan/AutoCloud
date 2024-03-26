import JSZip from 'jszip'
import xml2js from 'xml2js'
import logger from './logger'
import { SALESFORCE_API_VERSION } from './secrets'
import { ComponentType, componentTypeToExtension } from './sfDependencyHelper'

const SF_XMLNS = 'http://soap.sforce.com/2006/04/metadata'
const SF_API_VERSION = SALESFORCE_API_VERSION
const SF_FILENAME_PACKAGE_XML = 'package.xml'
const SF_PACKAGE_FOLDER_OBJECTS = 'objects/'
const SF_PACKAGE_FOLDER_INSTALLED_PACKAGES = 'installedPackages/'
const SF_PACKAGE_LAYOUTS = 'layouts/'
const SF_PACKAGE_PROFILES = 'profiles/'
const SF_PACKAGE_PERMISSIONS = 'permissionsets/'
const SF_PACKAGE_EMAIL_TEMPLATE = 'email/'

const SF_COMPONENT_TYPE_TO_FOLDER: Record<string, string> = {
  [ComponentType.CUSTOM_OBJECT]: SF_PACKAGE_FOLDER_OBJECTS,
  [ComponentType.INSTALLED_PACKAGE]: SF_PACKAGE_FOLDER_INSTALLED_PACKAGES,
  [ComponentType.LAYOUT]: SF_PACKAGE_LAYOUTS,
  [ComponentType.PROFILE]: SF_PACKAGE_PROFILES,
  [ComponentType.PERMISSION_SET]: SF_PACKAGE_PERMISSIONS,
  [ComponentType.EMAIL_TEMPLATE]: SF_PACKAGE_EMAIL_TEMPLATE,
  [ComponentType.EMAIL_TEMPLATE_BODY]: SF_PACKAGE_EMAIL_TEMPLATE,
}

const TEMPLATE_PACKAGE_XML = {
  Package: {
    $: {
      xmlns: SF_XMLNS,
    },
    version: SF_API_VERSION,
  },
}

const XML_OPTIONS = {
  xmldec: { version: '1.0', encoding: 'UTF-8' },
}

/**
 * Type to merge into package.xml for package deployment types
 */
export interface PackageType {
  members: string[]
  name: string
}

/**
 * Metadata to create component xml for package deployment types
 */
export interface PackageFile {
  name: string
  dataXml: string
  type: ComponentType
  subFolder?: string
}

/**
 * Generate package.xml file content to use for Salesforce Metadata API
 * @param componentTypes - List of PackageType with components to merge into the package.xml
 * @returns - string value of package.xml content
 */
export function generatePackageXml(componentTypes: PackageType[]): string {
  //create package xml
  const packageXmlObj: Record<
    string,
    Record<string, unknown>
  > = TEMPLATE_PACKAGE_XML
  const packageTypes = []
  for (const componentType of componentTypes) {
    packageTypes.push(componentType)
  }
  packageXmlObj.Package['types'] = packageTypes
  const packageXml: string = new xml2js.Builder(XML_OPTIONS).buildObject(
    packageXmlObj,
  )

  logger.debug(`[sfDeploymentPackageGenerator] [package.xml] ${packageXml}`)

  return packageXml
}

/**
 * Generate XML content for Metadata API component to deploy
 * @param componentType - Type of Metadata API component
 * @param componentName - DeveloperName of component for filename
 * @param data - Object record content for metadata component to merge into XML template
 * @returns - string value of compent XML content
 */
export function generateComponentXml(
  componentType: ComponentType,
  componentName: string,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  data: any,
): PackageFile {
  //create component xml
  const componentXmlObj = {
    [componentType]: {
      $: {
        xmlns: SF_XMLNS,
      },
      ...data,
    },
  }
  const fileName = `${componentName}.${
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    componentTypeToExtension.get(componentType)
      ? componentTypeToExtension.get(componentType)
      : componentType.charAt(0).toLocaleLowerCase() + componentType.substring(1)
  }`
  const componentXml: string = new xml2js.Builder(XML_OPTIONS).buildObject(
    componentXmlObj,
  )

  return {
    dataXml: componentXml,
    name: fileName,
    type: componentType,
  }
}

/**
 * Geneerates a .zip archive for deployment to Salesforce Metadata API
 * @param packageXml - package.xml file content
 * @param componentFiles - list of PackageFile with file content to write components in the src/ folder
 * @returns - file Buffer of .zip archive generated
 */
export async function generateDeploymentZip(
  packageXml: string,
  componentFiles: PackageFile[],
): Promise<Buffer> {
  //construct zip structure
  const zip = new JSZip()

  //add package xml
  zip.file(SF_FILENAME_PACKAGE_XML, packageXml)

  //add each component type
  setZipFiles(zip, componentFiles)

  //build zip file
  return await generateZip(zip)
}

/**
 * Geneerates a .zip archive for deployment to Salesforce Metadata API
 * @param packageXml - package.xml file content
 * @param componentFiles - list of PackageFile with file content to write components in the src/ folder
 * @returns - file Buffer of .zip archive generated
 */
export function setZipFiles(zip: JSZip, componentFiles: PackageFile[]): JSZip {
  //update each component type
  for (const componentFile of componentFiles) {
    const subFolder = SF_COMPONENT_TYPE_TO_FOLDER[componentFile.type]
    if (subFolder) {
      zip.folder(subFolder)?.file(componentFile.name, componentFile.dataXml)
    }
  }
  return zip
}

/**
 * Generates a .zip archive for deployment to Salesforce Metadata API
 * @param zip - JSZip file instance
 * @returns - file Buffer of .zip archive generated
 */
export async function generateZip(zip: JSZip): Promise<Buffer> {
  //build zip file buffer for Unix
  return await zip.generateAsync({
    type: 'nodebuffer',
    platform: 'UNIX',
    streamFiles: true,
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9,
    },
  })
}

/**
 * Generates a JS object from XML file within .zip loaded in JSZip
 * @param zip - JSZip file instance
 * @param filePath - folder and file path for XML data
 * @param componentName - Name of element to return within XML structure
 * @returns - JS Object converted from XML
 */
export async function unpackZipXmlObject<T>(
  zip: JSZip,
  filePath: string,
  componentName: string,
): Promise<T> {
  const file = zip.files[filePath]
  if (!file) throw Error(`${filePath} does not exist`)
  const xmlNodeStream: string | undefined = await file?.async('string')

  if (!xmlNodeStream)
    throw Error(`xmlNodeStream for ${file.name} is null|undefined`)

  // Parse the xml to json
  // https://www.npmjs.com/package/xml2js#options
  const xmlParser = new xml2js.Parser({ explicitArray: false })

  return (await xmlParser.parseStringPromise(xmlNodeStream))[componentName]
}
