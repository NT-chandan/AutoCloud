# Salesforce HC Transition Assistant

Salesforce managed package development source code for the official Financial Services Cloud Transition Assistant

## Salesforce Connected App
This application requires a Salesforce Connected App setup for [sfdc-industries-transition-services](https://github.com/Zennify/sfdc-industries-transition-services) performing OAuth. Follow steps below to setup a new Connected App for external services to perform Salesforce API operations.

1. Generate a Self-Signed Certificate in "Certificates and Key Management" of Salesforce Setup menu
2. Download Certificate
3. Create Connected App, enable OAuth settings, enable Digital Certificates, select and upload .crt, add api and refresh_token scopes, add dummy https://localhost callback URL. Upon Save, navigate to Manage Connected Apps, change policy to Admin approved Users, add System Administrator (Or Permission Set) assignment for access to users.
4. Export Keystore (JKS) with a password (from "Certificates and Key Management")
5. Execute command to export PKCS12 `keytool -importkeystore -srckeystore <orgIdJksFile>.jks -destkeystore <orgIdJksFile>.p12 -deststoretype PKCS12 -srcalias <self-signed-cert-name> -srcstorepass <password> -deststorepass <password> -destkeypass <password>`
6. Execute command to export PEM `openssl pkcs12 -in <orgIdJksFile>.p12 -nocerts -out <sf_key_filename>.pem`
7. Supply private key PEM to [sfdc-industries-transition-services](https://github.com/Zennify/sfdc-industries-transition-services)
8. Supply Connected App Consumer Key to [sfdc-industries-transition-services](https://github.com/Zennify/sfdc-industries-transition-services)

## Packaging
This SFDX project uses Second Generation Packaging (2GP). This app uses a namespace for packaging into both Unlocked and Managed Packages. 
Please see [Steps to Create Packages](Steps%20to%20Create%20Packages.md)

### Setup Packaging Org
To obtain new namespace complete the following:
- Create a Salesforce Developer Edition org from Env Hub/Dev Hub
- Establish a namespace in the Developer Edition org
- Link namespace within Dev Hub via Namespace Registries from App Launcher

### Verify Named Credential
* Verify heroku/external app API endpoint is correct in `namedCredentials/HC_Transition_Assistant_API.namedCredential-meta.xml`
    * Dev/QA: `https://salesforce-hc-transition-dev.herokuapp.com`
    * UAT: `https://salesforce-hc-transition-uat.herokuapp.com`
    * Prod: `https://salesforce-hc-transition.herokuapp.com`

### Unlocked Package (DEV/QA)
Namespace: `HCTransitionQA`
- Checkout branch `unlocked-package`
- Current release and installation: https://docs.google.com/document/d/1MWnwQezDe2UwLEIDL1WWg3HLKvjxMIOneIyGKDMaasU

#### Build Unlocked Package Release
1. Checkout `unlocked-package` branch and pull for changes
    * NOTE: pull using `git pull --recurse-submodules` to ensure the [sfdc-industries-transition-core](https://github.com/Zennify/sfdc-industries-transition-core) submodule is updated
    * NOTE: `sfdx-project.json` includes `namespace` populated with correct namepsace of unlocked package
2. Retrieve `manifest/managed.package.xml`
    * NOTE: `unlocked-package` branch excludes `connectedApps` folder (we can't put the connected app in and unlocked package)
    * NOTE: Any components that might have been deleted from dev org make sure delete from local source
3. Execute command to build package version (see `scripts/cli/buildUnlockedPackage.sfdx`)
4. After build complete, commit & push `sfdx-project.json` file with new package version ID to branch
    * Avoid opening a pull request on this branch or merging into master
    * Merge master into this branch to keep up to date

### Managed Package (UAT)
Namespace: `HCTransitionUA`
- Checkout branch `HCTransitionUA-managed`
- Current release and installation: https://docs.google.com/document/d/1YqZGmZWkAYUfyfBQlAWBRzJg2SvWCupdDZfxuvmM23I

#### Setup Managed Connected App
Follow these steps if publishing a Connected App for the first time to a new namespace
1. Configure the Connected App within Salesforce packaging org that owns the namespace.
    * See [Salesforce Connected App](#Salesforce-Connected-App) section
2. Verify the Connected App is published in a 1GP managed package release (producing `HCTransitionUA__FSC_Transition_Assistant_UAT` -- note `UAT` in developer name) and reference it in the source connectedApp file for building it into the 2GP package (i.e. `connectedApps/FSC_Transition_Assistant_UAT.connectedApp-meta.xml`)
    * Follow 1GP steps to build into 2GP release: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp_connected_app.htm

#### Build Managed Package Release
1. Checkout `HCTransitionUA-managed` branch and pull for changes
    * NOTE: pull using `git pull --recurse-submodules` to ensure the [sfdc-industries-transition-core](https://github.com/Zennify/sfdc-industries-transition-core) submodule is updated
    * NOTE: `sfdx-project.json` includes `namespace` populated with correct namepsace of unlocked package
    * NOTE: This branch does not always have latest code changes, it only maintains the settings needed for building the package. You can `git merge master` to merge current master changes into this branch to keep source up to date.
2. Retrieve `manifest/managed.package.xml`. 
    * NOTE: This step should only be performed if connected to a Developer Edition or Scratch Org environment that has current source of project.
    * NOTE: Careful not to overwrite namedCredentials, connectedApp settings, and System Logger Outbound Message which are coupled to the API and namespace. These components are omitted from the manifest on this branch to prevent this.
    * NOTE: Any components that might have been deleted from dev org make sure delete from local source
3. Verify `connectedApps` folder contains managed app (See [Setup Managed Connected App](#Setup-Managed-Connected-App) above)
4. Update `versionNumber` in `sfdx-project.json` increment to next appropriate major.minor.patch version
    * Verify `ancestorVersion` is set as needed with appropriate ancestor for supporting release upgrades from prior version
6. Execute commands to build and release package version (see `scripts/cli/buildManagedPackage.sfdx`)
    * Create package via SFDX cli (one time operation if first version)
    * Create package version via cli
    * Promote package release (must release so package is not Beta and can be upgradeable)
    * Confirm release/tag/get URL
7. After build complete, commit & push `sfdx-project.json` file with new package ID to branch
    * Avoid opening a pull request on this branch or merging into master
    * Merge master into this branch to keep up to date

### Managed Package (Production)
Namespace: `HCTransition`
- Checkout branch `HCTransition-managed`
- Current release and installation: TBD

#### Setup Managed Connected App
Follow these steps if publishing a Connected App for the first time to a new namespace
1. Configure the Connected App within Salesforce packaging org that owns the namespace.
    * See [Salesforce Connected App](#Salesforce-Connected-App) section
2. Verify the Connected App is published in a 1GP managed package release (producing `HCTransition__FSC_Transition_Assistant`) and reference it in the source connectedApp file for building it into the 2GP package (i.e. `connectedApps/FSC_Transition_Assistant.connectedApp-meta.xml`)
    * For detailed steps on building Connected App into 2GP release see: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp_connected_app.htm

#### Build Managed Package Release
1. Checkout `HCTransition-managed` branch and pull for changes
    * NOTE: pull using `git pull --recurse-submodules` to ensure the [sfdc-industries-transition-core](https://github.com/Zennify/sfdc-industries-transition-core) submodule is updated
    * NOTE: `sfdx-project.json` includes `namespace` populated with correct namepsace of unlocked package
    * NOTE: This branch does not always have latest code changes, it only maintains the settings needed for building the package. You can `git merge master` to merge current master changes into this branch to keep source up to date.
2. Retrieve `manifest/managed.package.xml`. 
    * NOTE: This step should only be performed if connected to a Developer Edition or Scratch Org environment that has current source of project. For production release builds this step most likely is to be skipped and use latest source in `master` branch merged from previous step.
    * NOTE: Careful not to overwrite namedCredentials and connectedApp settings which are coupled to the API and namespace. NamedCredential and ConnectedApp are removed from the manifest on this branch to prevent this.
    * NOTE: Any components that might have been deleted from dev org make sure delete from local source
3. Verify `connectedApps` folder contains managed app (See [Setup Managed Connected App](#Setup-Managed-Connected-App-1) above)
4. Update `versionNumber` in `sfdx-project.json` increment to next appropriate major.minor.patch version
    * Verify `ancestorVersion` is set as needed with appropriate ancestor for supporting release upgrades from prior version
6. Execute commands to build and release package version (see `scripts/cli/buildManagedPackage.sfdx`)
    * Create package via SFDX cli (one time operation if first version)
    * Create package version via cli
    * Promote package release (must release so package is not Beta and can be upgradeable)
    * Confirm release/tag/get URL
7. After build complete, commit & push `sfdx-project.json` file with new package ID to branch
    * Avoid opening a pull request on this branch or merging into master
    * Merge master into this branch to keep up to date


## Maintenance and Troubleshooting
Please see [Steps to setup Docker locally to develop and debug](Steps%20to%20setup%20Docker%20locally%20to%20develop%20and%20debug.md)

