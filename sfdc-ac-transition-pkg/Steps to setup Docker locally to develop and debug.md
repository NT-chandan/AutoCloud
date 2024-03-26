
## Steps to setup Docker locally to develop the Heroku FSCTA/HCTA microsservices:

1.  Install/start docker  
    
2.  Download sfdc-industries-transition-services from GitHub 
    
3.  Execute in the Terminal app in the local folder:

      ```
      npm install
      npm install -D typescript
      ```

optionally:

        
        npm i --save-dev typescript @typescript-eslin/parser
        npm i --save-dev @typescript-eslint/eslint-plugin
        


4.  Create certificates (this will create server.key and server.cert):

       `openssl req -nodes -new -x509 -keyout server.key -out server.cert`
5.  Copy cert files server.key and server.cert into the certs folder  

6.  In the dev org, go to Setup/Certificates and Key Management and export keystore JKS with a password (one you come up with, in the example below the password was 2hard2get2)  
 
7.  Import the JKS file just downloaded:

```
keytool -importkeystore -srckeystore 00D4x000003vb62.jks -destkeystore 00D4x000003vb62.p12 -deststoretype PKCS12 -srcalias Salesforce_Industries_Upgrade -srcstorepass 2hard2get2 -deststorepass 2hard2get2 -destkeypass 2hard2get2

openssl pkcs12 -in 00D4x000003vb62.p12 -nocerts -out 00D4x000003vb62.pem
```

8.  Copy pem filename above to certs folder  
    
9.  Create .env file as follows:

```
HOST=localhost
PORT=3000
REDIS_URL=redis://redis:6379
REDIS_STRICT_SSL=false
SCHEMA_DESCRIBE_TTL=1200
SALESFORCE_CLIENT_ID=*copy this from dev org connected app client id*
SECRET_KEY=*copy this from dev org connected app client secret*
SALESFORCE_PRIVATE_KEY_PASSPHRASE=*same password given to the key store JKS*
SALESFORCE_API_VERSION=52.0
SCHEMA_INSTANCE_URL=https://fscschema.my.salesforce.com
SCHEMA_USER=fsctransitionapi@fscschema.org
SALESFORCE_KEY=*PEM filename that you generated locally*
HTTPS_CERT=
HTTPS_KEY=
DATABASE_URL=
```

10.  Alternatively, you can copy some .env entries from Heroku Config Vars:  
![](https://lh6.googleusercontent.com/GPwoU8zWDwsC5oTFAg_cWyJBeqvJ4fWWdnho-53c8uVqUfJvSU2KljtcUaal68kb06LQ0QtT7ct0oYEmffn01eKL_G1SnCKSbfIEavhFVWwaMroLBb2mxhNlDF861S7xNBW_gB6c)
    
11.  The ones to copy will be


```
SALESFORCE_CLIENT_ID=*copy this from Heroku config vars*
SALESFORCE_PRIVATE_KEY_PASSPHRASE=*copy this from Heroku config vars*
SECRET_KEY=*copy this from Heroku config vars*
SALESFORCE_KEY_STRING=*name of the PEM file with the content pasted from SALESFORCE_KEY_STRING in Heroku*
```

12.  (optionally) Add to server.ts to make it report stack trace on the TS files instead of JS:

`import 'source-map-support/register'` 
      
    

13.  Run the docker command to build and start the services:

`clear && docker-compose -f docker-compose.dev.yaml up --build`

14.  Here is what should be expected on the terminal after starting the services:
![](https://lh6.googleusercontent.com/H3Lh2PbSgX6ArEPfexmYooGm-WhWDwTMChQ1UHBkiEcBbQ1jK64x9200fqYQAmf2M_m62Az_JDfkRw6yc4hJlkXt2-2MPly2PxypWVIkgz5NNo45MUACz3QdZS-hGKP-gbtCYmRT)

15.  Test the services are running using Postman/Insomnia or curl: 
- GET [http://localhost:3000](http://localhost:3000)
It should return status 200

-   POST [http://localhost:3000/scan  
    ](http://localhost:3000/scan)Example body=  
```
 {
    
"Username": "yourUserName@zennify.com.fscupgrade.dev",

"OrgId": "00D4x000003vb62EAA",

"IsSandbox": false,

"InstanceUrl": "https://fsc-upgrade-development-dev-ed.my.salesforce.com",

"ApiVersion": "52.0"

}
```

It should return an id or a JSON error message
    

  

## Steps to enable debugging from VSCode:

  

1.  This assumes the above setup was completed and is working properly
    
2.  If you started the services, Ctrl-C to cancel it (you will run them again later)  
      
    
3.  Edit package.json and modify the line for “watch-node” to:

`"watch-node": "nodemon --inspect=0.0.0.0 dist/**/server.js",`

4.  Edit docker-compose.dev.yaml to add port 9229 under “web” under the line  --‘3000:3000’

`-- '9229:9229'`

5.  Edit docker-compose.dev.yaml to add port 9230 under “worker” under the line for --‘3001:3001’

`-- '9230:9230'`

6.  Create folder .vscode  

7.  Create file launch.json in the .vscode folder with configurations for the web and worker debugging:

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "attach",
            "name": "Docker: Attach to web Node",
            "port": 9229,
            "remoteRoot": "/app",
            "protocol": "inspector",
            "restart": true,
            "sourceMaps": true
        }
        ,
        {
            "type": "node",
            "request": "attach",
            "name": "Docker: Attach to worker Node",
            "port": 9230,
            "remoteRoot": "/app",
            "protocol": "inspector",
            "restart": true,
            "sourceMaps": true
        }
    ]
}
```

8.  Execute command to generate local compiled files (this should create a dist folder):

`npm run build`

9.  Start Docker and run the command to start the app:

`clear && docker-compose -f docker-compose.dev.yaml up --build`

10.  Open a .ts source code file (either from web or worker), place breakpoints in it and open the debug tab in VSCode  

11.  Open the Debug menu at the top and select the Docker entry (web or worker) you want to debug and click the green arrow icon:

![](https://lh4.googleusercontent.com/6Q50bGBRCiN3rBG9vuq7ewgbsQkwWkkpEJatifOFbimn4n3sdnO8pxDNNJGdzQlkv-fXCs7CZIu-5OQblXNqQuj4of0Et0gSq8qgoyjtKc_l9FCaBFTaYhKxhNQK-VuuyRyYnzWo)  
      
    
12.  If successful, you will see “Debugger attached” in the terminal and the footer of VSCode will become orange, any breakpoints will get a bright red dot and you’re ready to set breakpoints and step through execution

![](https://lh6.googleusercontent.com/MN8JY7B7768xMnvv3akTR9_BCPuwp5XaaQCAmeik73g7YfxDHqSldwh_kO0_kL-pZXyt4b7suh410MHEqRocbbzfxUXLSZDa5tKnZkhFl1sjZidT-DF16tSmsb5rJXhogIMpuHzN)  
      
    
13.  Enjoy debugging:

![](https://lh5.googleusercontent.com/1cCK-_W5rggLVLjlHGnmidnOamrkxp_wNeMe8gthLx6gAGvwMnBRTYdXpqI-l4001TVArGO0v_qNKCVdHPEtTxoU8RM9F5U3PCtVfmWDdl-xBK8aVm7UvVGutygO9koXKvQUiFv8)
