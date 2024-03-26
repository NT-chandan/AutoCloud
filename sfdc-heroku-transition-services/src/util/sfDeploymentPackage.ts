import { ComponentType, customObjectTypes } from './sfDependencyHelper'
import { PackageType } from './sfDeploymentPackageGenerator'
import { CustomObject } from './sfPackageType'

export class DeploymentPackage {
  private _packageTypes = new Map<ComponentType, string[]>()
  private customObjects = new Map<string, CustomObject>()
  // Add a member to a package type. If the package type  does not exist yet then create it
  addPackageMember(type: ComponentType, newMember: string): void {
    const packageTypeMembers = this._packageTypes.get(type)
    if (packageTypeMembers) {
      this._packageTypes.set(type, [...packageTypeMembers, newMember])
    } else {
      // New package type
      this._packageTypes.set(type, [newMember])
    }
  }
  /**
   * Fetch current _packageTypes and return as an array of PackageType
   * @returns {PackageType[]}
   */
  get packageTypes(): PackageType[] {
    return Array.from(this._packageTypes.entries()).map(([name, members]) => ({
      name,
      members,
    }))
  }
}
