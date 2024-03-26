Set-PSDebug -Trace 0 # use 1 to trace running commands; 2 to also trace variable assignments, function calls, and script calls

$OrgName="KSWIGGUM"
$LatestPackageVersion="04t5e000000aSJEAA2"
$InstallKey="hcta2021"
$PermSetName="HCTransition__HC_Transition_Assistant"
sfdx force:package:install --wait 10 --publishwait 10 --package $LatestPackageVersion -k $InstallKey -r -u $OrgName -a package -s AdminsOnly
sfdx force:user:permset:assign -n $PermSetName -u $OrgName
sfdx force:org:open -u $OrgName