# All packages versions to json file with verbosity
# sfdx force:package:version:list -v zennify --packages 0Ho5e000000CaSyCAK --verbose --json > scripts/cli/dev/data/packageversion.json

# Dev package versions
# sfdx force:package:version:list -v zennify --packages 0Ho5e000000CaSyCAK --verbose --json > scripts/cli/dev/data/packageversion.json

# All packages versions to file
# sfdx force:package:version:list -v zennify > scripts/cli/dev/data/packageversion.txt

# modified in the last N days to file
# sfdx force:package:version:list -v zennify --packages 0Ho5e000000CaSyCAK--modifiedlastdays 0 > scripts/cli/dev/data/packageversion_lastndays.txt

# Dev package versions concise to file
# sfdx force:package:version:list -v zennify --packages 0Ho5e000000CaSyCAK --concise > scripts/cli/dev/data/packageversion_concise.txt

# Dev package versions to file
# sfdx force:package:version:list -v zennify --packages 0Ho5e000000CaSyCAK > scripts/cli/dev/data/packageversion_0Ho5e000000CaSyCAK.txt