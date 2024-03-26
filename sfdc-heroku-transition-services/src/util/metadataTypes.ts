import { ComponentType } from './sfDependencyHelper'

export interface DeployResult {
  checkOnly: boolean
  completedDate: Date
  createdBy: string
  createdByName: string
  createdDate: Date
  details: {
    componentFailures: ComponentFailure[]
    componentSuccesses: ComponentSuccess[]
    runTestResult?: {
      numFailures: number
      numTestsRun: number
      totalTime: number
    }
  }
  done: boolean
  id: string
  ignoreWarnings: boolean
  lastModifiedDate: Date
  numberComponentErrors: number
  numberComponentsDeployed: number
  numberComponentsTotal: number
  numberTestErrors: number
  numberTestsCompleted: number
  numberTestsTotal: number
  rollbackOnError: boolean
  runTestsEnabled: boolean
  startDate: Date
  status: string
  success: boolean
}

interface ComponentSuccess {
  changed: boolean
  componentType: ComponentType
  created: boolean
  createdDate: Date
  deleted: boolean
  fileName: string
  fullName: string
  success: boolean
}

interface ComponentFailure {
  changed: boolean
  columnNumber: string
  componentType: ComponentType
  created: boolean
  createdDate: Date
  deleted: boolean
  fileName: string
  fullName: string
  lineNumber: number
  problem: string
  problemType: string
  success: boolean
}

// Map for stripping unncessary fields from Metadata API Read calls
export const ReadMapDefinitions = (metadata: any[], metadataType : string, operation: string) : any[] => {
  let fieldsToKeep : string[] = []
  //Note: For each new metadata type you wish to strip, add a new case below (ternary statement included to distinguish between Metadata List and Metadata Read)
  switch (metadataType) {
    case 'ReportType':
      fieldsToKeep = (operation==='read') ? ['baseObject'] : ['type']
      break
    default:
      break
  }
  if(fieldsToKeep.length > 0 ){
    //In all cases, we want the Id + Fullname for display
    fieldsToKeep.push('id')
    fieldsToKeep.push('fullName')

    //Delete attributes for all fields not in our full list
    metadata.forEach(meta => {
      Object.keys(meta).forEach(attribute => {
        if(!fieldsToKeep.includes(attribute)){
          delete meta[attribute]
        }
      })
    })
  }
  return metadata
}

