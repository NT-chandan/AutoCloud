# salesforce-fsc-upgrade-services
Microservices hosted off-platform to support the Salesforce Financial Services Cloud Transition Assistant

# Pre-reqs
To build and run this app locally you will need a few things:
- Install [Docker](https://docs.docker.com/get-docker/)
- (Optional) Install [Docker Compose](https://docs.docker.com/compose/install/)
- (Optional) Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

# Getting started
- Clone the repository
```
git clone https://github.com/Zennify/salesforce-fsc-upgrade-services
```
- Install Node modules
```
cd salesforce-fsc-upgrade-services
npm install
```

# Local Deploy (docker-compose)
Using `docker-compose` you can deploy the nodejs api, postgres, and redis locally in docker containers. This is easiest when using VSCode with Docker extension you can right click on `docker-compose*.yaml` files and select "Compose Up". You can then select Docker icon tab and right click running image to view Logs. To do this via CLI perform the following:
## Production
```bash
docker-compose up --build
```
## Development (auto rebuild on local code changes)
```bash
docker-compose -f docker-compose.dev.yaml up --build 
```

## Building and Run Individual Images
### Web
```bash
docker build -f Dockerfile.web --tag salesforce-fsc-upgrade-services_web .
docker run --env-file .env -p 3000:3000/tcp salesforce-fsc-upgrade-services_web 
```
### Worker
```bash
docker build -f Dockerfile.worker --tag salesforce-fsc-upgrade-services_worker .
docker run --env-file .env salesforce-fsc-upgrade-services_worker
```

## Maintenance and Troubleshooting
Please see [Steps to setup Docker locally to develop and debug](Steps%20to%20setup%20Docker%20locally%20to%20develop%20and%20debug.md)



# Heroku Deploy

## Setup
* [Getting Started](https://devcenter.heroku.com/articles/container-registry-and-runtime#getting-started)
* [Logging In](https://devcenter.heroku.com/articles/container-registry-and-runtime#logging-in-to-the-registry)
* [Set Environment Variables](https://devcenter.heroku.com/articles/config-vars) _Note:_ Heroku configured env variables will overwrite variables defined in the `.env` file


## [Build and Deploy Images](https://devcenter.heroku.com/articles/container-registry-and-runtime#build-an-image-and-push)
```bash
heroku container:push web worker --recursive -a <app_name>
heroku container:release web worker -a <app_name>
# View logs of running processes
heroku logs -a <app_name> --tail
```
__OR__
## [Push Existing Docker Images](https://devcenter.heroku.com/articles/container-registry-and-runtime#pushing-an-existing-image)
```bash
docker tag salesforce-fsc-upgrade-services_web:prod registry.heroku.com/<app>/web
docker tag salesforce-fsc-upgrade-services_worker:prod registry.heroku.com/<app>/worker 
docker push registry.heroku.com/<app>/web
docker push registry.heroku.com/<app>/worker
```

# Generate HTTPS Self-Signed Certificate
Generate self signed cert for running application with TLS locally or off Heroku platform
```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```
Place generated files into `certs` folder in main project directory.

# File structure
| Name | Description |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **/dist**                | Contains the distributable (or output) from your TypeScript build. This is the code you ship          |
| **/node_modules**        | Contains all your npm dependencies                                                                    |
| **/src**                 | Contains your source code that will be compiled to the dist dir                                       |
| **/src/models**          | Contains relational database models                                                                   |
| **/src/controllers**     | Controllers define functions that respond to various http requests                                    |
| **/src/services**        | Contains various services used in the app ( api/express, database/postgres, redis, messenger queue)   |
| **/src/util**            | Contains various general utilities used throughout the app (logging, secrets, sfapi class, exc)       |
| **/src**/server.ts       | Entry point to the app                                                                                |
| **/test**                | Contains your tests. Separate from source because there is a different build process                  |
| .env                     | API keys, tokens, passwords, database URI. (`.gitignore`'d)                                           |
| jest.config.js           | Used to configure Jest running tests written in TypeScript                                            |
| package.json             | File that contains npm dependencies as well as build scripts                                          |
| tsconfig.json            | Config settings for compiling server code written in TypeScript                                       |
| .eslintrc                | Config settings for ESLint code style checking                                                        |
| .eslintignore            | Config settings for paths to exclude from linting                                                     |
| certs/server.cert        | HTTPS certificate (optional, `.gitignore`'d)                                                          |
| certs/server.key         | HTTPS key (optional, `.gitignore`'d)                                                                  |
| certs/sfdc_key.pem       | Salesforce key used to sign the JWT used in the [Server to Server Integration](https://help.salesforce.com/articleView?id=remoteaccess_oauth_jwt_flow.htm)                                                              |
| scripts/                 | Contains scripts used for different purposes.                                                         |

# NPM Scripts

| Npm Script                | Description |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `start`                   | Does the same as 'npm run serve'. Can be invoked with `npm start`                                 |
| `build`                   | Full build. Runs ALL build tasks (`build-ts`, `lint`)                                             |
| `serve`                   | Runs node on `dist/server.js` which is the apps entry point                                       |
| `watch`                   | Runs build and serve tasks on watch mode and with --inspect flag (`build-ts-watch`, `serve-debug-watch`). |
| `test`                    | Runs tests using Jest test runner                                                                 |
| `test-watch`              | Runs tests in watch mode                                                                          |
| `build-ts`                | Compiles all source `.ts` files to `.js` files in the `dist` folder                               |
| `build-ts-watch`          | Same as `build-ts` but continuously watches `.ts` files and re-compiles when needed               |
| `lint`                    | Runs ESLint on project files                                                                      |
| `serve-debug-watch`       | Runs the app with the --inspect flag and nodemon, restarting on any build change.                 |
| `serve-debug-prod`        | Runs the app with the --inspect flag but on port 9091 and without `nodemon`. Intended for use in Heroku. |

> `serve` (and `start`), `serve-debug-watch`, `serve-debug-prod`, and `watch` are intended to be run in an prod-like environment, such as in Heroku or Docker. They won't run in Windows or locally as how the build and serving is setup for both apps.

# Environment Variables

| Variable ( `*` = optional)            | Description |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Database connection URL                                                               |
| `DEBUG`*                              | Enable inspection on Node.js on custom port 9091 for launch from `run.sh`. Set to `1` to enable. Intended for debugging in Heroku. |
| `HOST`                                | Host used by HTTP web server (0.0.0.0 required for heroku)                            |
| `PORT`                                | Port used by HTTP web server                                                          |
| `HTTPS_CERT`*                         | Cert used for HTTPS web server                                                        |
| `HTTPS_KEY`*                          | Key used for HTTPS web server                                                         |
| `REDIS_URL`                           | Redis connection URL                                                                  |
| `REDIS_STRICT_SSL`*                   | Reject Unauthorized SSL connections. Defaults to `true`. Set `false` to allow Self-Signed certs without truststore (e.g. Heroku Redis Private) |
| `PROXY_URL`*                          | HTTP/S Proxy URL (e.g. Fixie, IP Burger, custom, etc). Also accepts `FIXIE_URL` and `IPB_HTTP` |
| `SALESFORCE_CLIENT_ID`                | Salesforce Client ID (a.k.a Consumer Key)                                             |
| `SALESFORCE_PRIVATE_KEY_PASSPHRASE`   | Password used when generating the PEM file from the self-signed certificate           |
| `SALESFORCE_KEY`                      | Salesforce key filename (example: `sfdc_key.pem`)                                     |
| `SALESFORCE_KEY_STRING`*              | Contents of the PEM file generated from the self-signed certificate (overrides SALESFORCE_KEY) |
| `SALESFORCE_API_VERSION`              | Salesforce API version to fall back to if not provided in HTTP request body           |
| `SECRET_KEY`                          | 32-character random key used for encrypting / decrypting redis data (not to be confused with the Salesforce Client/Consumer Secret) |
| `SCHEMA_DESCRIBE_TTL`*                | How long (in seconds) to cache Schema objects in redis for (default 7 days)           |
| `SCHEMA_USER`                         | Username to connect to the Schema org           |
| `SCHEMA_INSTANCE_URL`                 | Schema org containing FSC/HC objects           |

# Salesforce Connected App
This application requires a Salesforce Connected App setup for performing JWT OAuth. Follow steps below to setup a new Connected App and obtain Salesforce Client ID (a.k.a Consumer Key) and private key for environment variables.

1. Generate a Self-Signed Certificate in "Certificates and Key Management" of Salesforce Setup menu
2. Download Certificate
3. Create Connected App, enable OAuth settings, enable Digital Certificates, select and upload .crt, add api and refresh_token scopes, add dummy https://localhost callback URL. Upon Save, navigate to Manage Connected Apps, change policy to Admin approved Users, add System Administrator (Or Permission Set) assignment for access to integration user supplied as SALESFORCE_USERNAME
4. Export Keystore (JKS) with a password (from "Certificates and Key Management")
5. Execute command to export PKCS12 `keytool -importkeystore -srckeystore <orgIdJksFile>.jks -destkeystore <orgIdJksFile>.p12 -deststoretype PKCS12 -srcalias <self-signed-cert-name> -srcstorepass <password> -deststorepass <password> -destkeypass <password>`
6. Execute command to export PEM `openssl pkcs12 -in <orgIdJksFile>.p12 -nocerts -out <sf_key_filename>.pem`
7. Supply private key PEM filename as SALESFORCE_KEY env variable and include file in `/certs` folder
8. Supply Connected App Consumer Key as SALESFORCE_CLIENT_ID

# Steps to deploy changes to Heroku

1. ```heroku login```

2. start docker

3. ```heroku container:login```

4. NAME_OF_THE_HEROKU_APP can be salesforce-fsc-transition-dev, salesforce-fsc-transition-uat, salesforce-hc-transition-dev, salesforce-hc-transition-uat, salesforce-fsc-transition, salesforce-hc-transition

```APP=NAME_OF_THE_HEROKU_APP sh -c 'heroku container:push web worker -a $APP --recursive && heroku container:release web worker -a $APP && heroku logs -a $APP --tail'```

For Windows:

```$APP="salesforce-fsc-transition-dev" && heroku container:push web worker -a $APP --recursive -v && heroku container:release web worker -a $APP -v && heroku logs -a $APP --tail```

### Debugging on Heroku

Make sure the apps aren't running locally or the Docker containers as ports may conflict as they are the same.

1. Make sure to have `DEBUG` config var on heroku set to `1`. Restart app or dynos if change was needed. This will restart the processes with inspector enabled.
2. Use the following to forward your local port to the corresponding dyno:
   1. For the Web app use `heroku ps:forward -a <heroku-app-name> -d web.1 9229:9091`.
   2. For the Worker app use `heroku ps:forward -a <heroku-app-name> -d worker.1 9230:9091`.
3. Make sure that your code is clean of changes as how it would be when Heroku checkouts your changes.  
   Also, because TypeScript is compiled and we use source maps, we need to make sure our local source maps are clean of changes as well. Run `npm run build-ts` after being sure your source code matched what Heroku checked out from git.
4. You can connect to either process to debug them, use the VS Code debug configurations intended for docker (but not the watch version, e.g. `Docker: Attach to worker Node`).

There seems to be a limitation on Heroku to forward ports on an app only a dyno at a time because error of port 1080 already in use (needs to confirm).

> There is a way to also debug running the process locally on Docker. This involves using a local port exposing tunnel service like `ngrok` and make SF temporarily point to such exposed public ephemeral/temporal URL generated by it, to debug locally.
