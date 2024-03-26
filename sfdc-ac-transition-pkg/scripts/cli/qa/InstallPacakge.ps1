Set-PSDebug -Trace 0 # use 1 to trace running commands; 2 to also trace variable assignments, function calls, and script calls

$ScratchOrgName="QASandbox"
$LatestPackageVersion="04t2J000000J064QAC"
$InstallKey="zennifySFDC2021"
$PermSetName="HCTransitionQA__HC_Transition_Assistant"
sfdx force:package:install --wait 10 --publishwait 10 --package $LatestPackageVersion -k $InstallKey -r -u $ScratchOrgName -a package -s AdminsOnly
sfdx force:user:permset:assign -n $PermSetName -u $ScratchOrgName
sfdx force:org:open -u $ScratchOrgName