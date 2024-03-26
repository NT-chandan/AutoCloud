import { exec } from 'child_process'
import { tryJsonParse } from './general'
const BASE_DIR = '/tmp/sfdx'
/**
 * Sfdx class used as a wrapper for sfdx-cli
 * https://www.npmjs.com/package/sfdx-cli
 */
export class Sfdx {
  clientId: string
  username: string
  instanceUrl: string
  keyFilePath: string
  orgId: string
  projectDir: string
  constructor(
    clientId: string,
    username: string,
    instanceUrl: string,
    keyFilePath: string,
    orgId: string,
  ) {
    this.clientId = clientId
    this.username = username
    this.instanceUrl = instanceUrl
    this.keyFilePath = keyFilePath
    this.orgId = orgId
    this.projectDir = `${BASE_DIR}/${this.orgId}`
  }

  login = async () => {
    return await Sfdx.execSync(
      `sfdx force:auth:jwt:grant -u "${this.username}" -f ${this.keyFilePath} -i "${this.clientId}" -a "${this.username}" --instanceurl "${this.instanceUrl}" --json`,
      true,
    )
  }

  installPackage = async (packageId: string) =>
    await Sfdx.execSync(
      `sfdx force:package:install --package ${packageId} -u ${this.username} --wait 30 --securitytype AllUsers --json`,
      true,
    )

  logout = async () =>
    await Sfdx.execSync(
      `sfdx force:auth:logout -p -u "${this.username}" --json`,
      true,
    )

  /**
   *
   * @param {string} cmd - command for child_process.exec() to execute
   * @param {boolean} json - flag to parse stdout/stderr as json
   * @returns {Promise<unknown>}
   */
  // TODO: use try/catch json parsing error handling
  static execSync = async (cmd: string, json = false): Promise<unknown> => {
    return await new Promise((resolve, reject) =>
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject({
            error,
            stderr: json ? tryJsonParse(stderr) : stderr,
            stdout: json ? tryJsonParse(stdout) : stdout,
            command: cmd,
          })
        } else if (stderr) {
          resolve(stderr)
        } else {
          resolve(stdout)
        }
      }),
    )
  }
}
