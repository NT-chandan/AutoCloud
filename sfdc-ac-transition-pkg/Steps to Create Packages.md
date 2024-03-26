# Steps to create packages

 1. Create New folder
    
 2. VSCode > New Project (Empty Project Template)
    
 3. on terminal:  go to the project folder, 
 `git init`, `git remote add origin <paste here the git URL>`
    
 5. on terminal:  `get fetch --all`
    
 6. you may need to close and reopen VSCode to make the other
    branches appear in the list
    
6. delete the existing project SFDX subfolders and files (or copy
    them somewhere else to restore later) to prevent a failed pull
    
7. select branch ("FSCTransitionUAT-Managed" if packaging for UAT, "unlocked-package" for QA) and it checks out the branch when you do
    it (if it doesn't, do a pull from the VSCode Git menu)
    
8. restore the old SFDX Project structure files (that were deleted/moved in 4b)
    
9. (optionally) Do a git pull of the submodules if needed (the folder will be empty in VSCode but still linked)
    
10. `git pull --recurse-submodules` (if you get Permission denied, see below)
    
11. to resolve Permission denied:  
        `ssh-keygen -t ed25519 -C "yourEmail@zennify.com"`
        `ssh-add -K /Users/yourUser/.ssh/id_ed25519`
        `pbcopy < ~/.ssh/id_ed25519.pub`
        add SSH key to your GitHub account at user menu/settings/SSH/New SSH key
        your key will be in your clipboard and start with "ssh-ed25519 ..."
    
12. add the submodules (core / shared package)
    
13. Select a default org (or connect to one)
    
14. If changes are made in the org, refresh the package.xml
    
15. retrieve manifest/managed.package.xml from org
    
16. update version # on sfdx-project.json (for UAT package only)
    
17. (for UAT only) execute command to create package version:  `sfdx force:package:version:create --package "Financial Services Cloud
    Transition Assistant (UAT)" --codecoverage --installationkey
    fscta2021 --wait 30 -f config/project-scratch-def.json`
    
18. (for QA only) `sfdx force:package:version:create --package "Financial Services Cloud Transition Assistant (QA)"
    --installationkey zennifySFDC2021 --wait 30 -f config/project-scratch-def.json`
    
19. update document with new version and URLs:  https://docs.google.com/document/d/1MWnwQezDe2UwLEIDL1WWg3HLKvjxMIOneIyGKDMaasU/edit
    
20. commit changes to the branch ("FSCTransitionUAT-Managed" for UAT, "unlocked-package" for QA)
