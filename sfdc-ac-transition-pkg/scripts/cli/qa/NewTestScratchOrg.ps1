Set-PSDebug -Trace 0 # use 1 to trace running commands; 2 to also trace variable assignments, function calls, and script calls

$ScratchOrgName="HCTAScratch"
$LatestPackageVersion="04t2J000000MDXgQAO"
sfdx force:org:create -s --nonamespace --definitionfile config/project-scratch-def.json --durationdays 30 --setalias $ScratchOrgName -v zennify
sfdx force:user:password:generate --targetusername $ScratchOrgName
sfdx force:user:display --targetusername $ScratchOrgName
sfdx force:package:install --wait 10 --publishwait 10 --package $LatestPackageVersion -k zennifySFDC2021 -r -u $ScratchOrgName
sfdx force:user:permset:assign -n HC_Transition_Assistant -u $ScratchOrgName
sfdx force:org:open -u $ScratchOrgName
