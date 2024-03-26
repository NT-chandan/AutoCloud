Set-PSDebug -Trace 0 # use 1 to trace running commands; 2 to also trace variable assignments, function calls, and script calls

$ScratchOrgName="HCTA360"
sfdx force:org:create -s --nonamespace --definitionfile config/project-scratch-def.json --durationdays 30 --setalias $ScratchOrgName -v zennify
sfdx force:user:password:generate --targetusername $ScratchOrgName
sfdx force:user:display --targetusername $ScratchOrgName
sfdx force:org:open -u $ScratchOrgName