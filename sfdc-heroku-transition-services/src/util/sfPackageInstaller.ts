import { ComponentType } from './sfDependencyHelper'
import {
  generateComponentXml,
  generateDeploymentZip,
  generatePackageXml,
  PackageType,
} from './sfDeploymentPackageGenerator'
import logger from './logger'

interface Package {
  Name: string
  Version: string
}

/**
 * Install list of managed or unmanaged Saleforce packages into an org
 * @param packageList - Package list of public Salesforce packages to install
 */
export function installPackages(packageList: Package[]): void {
  for (const packageObj of packageList) {
    generateInstalledPackage(packageObj)
    //todo deploy package using sfApi and await success to proceed with next install
  }
}

/**
 * Generate deployment .zip for InstalledPackage type to deploy installation of a package into Salesforce
 * @param packageInfo - Package object with info on name and version of package to install
 */
export function generateInstalledPackage(packageInfo: Package): void {
  //create package xml manifest for InstalledPackage
  const packageType: PackageType = {
    name: ComponentType.INSTALLED_PACKAGE,
    members: ['*'],
  }
  const packageXml = generatePackageXml([packageType])

  //create InstalledPackage file
  const packageComponentFile = generateComponentXml(
    ComponentType.INSTALLED_PACKAGE,
    packageInfo.Name,
    {
      activateRSS: true,
      versionNumber: packageInfo.Version,
    },
  )

  //bundle into zip for deployment
  const packageName = generateDeploymentZip(packageXml, [packageComponentFile])

  logger.debug(
    `[sfPackageInstaller] [generateInstalledPackage] generated package zip ${packageName}`,
  )

  //todo determine return filename or stream/buffer
}
