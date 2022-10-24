# README.md

## Summary

This repo (RabbitMQ to EventHub Shovel) is a template that contains a NodeJS app that will consume messages from a RabbitMQ queue and immediately send them to an Azure EventHub. It can be run directly using node, nvm or Docker (recommended).

## Dependencies

**Install NPM Dependencies**

* From the **/app** directory, run `npm i`.

**Environment,Secrets, CA_Certificate**

See [Environment Variables Explained](#Environment-Variables-Explained).

**RabbitMQ & Azure**

* Last, you need an RMQ server and an Azure Event Hub. Messages from a queue in the RMQ server will be sent to the Azure Event Hub. Note the routing key set in RMQ will be passed into Azure Event Hub via the properties bag. (EventHub sends your program an EventData object that has the properties "body" and "properties". The routing key will be passed into **EventData.properties.routingKey**).


When sending events to Azure Event Hubs with the Advanced Message Queuing Protocol (AMQP) protocol (the protocol we utilize through RabbitMQ), you may need to [open some firewall ports](https://docs.microsoft.com/en-us/azure/event-hubs/troubleshooting-guide) (5671 and 5672).

## Environment Variables Explained

The `app/conf/shovel.env `file is used to control all the parameters and secrets for the app. 

* You need environment variables set. Set the file corresponding to your run method according to the `How to run the app` section below.

### Rabbit Parameters

```text
# Set a log level that suits your needs.
# Supported Log Levels:
# OFF	 - nothing is logged
# FATAL - fatal errors are logged
# ERROR - errors are logged
# WARN	 - warnings are logged
# INFO	 - infos are logged
# DEBUG - debug infos are logged
# TRACE - traces are logged
# ALL   - everything is logged
logLevel=all

# RMQ (AMQP) Properties
amqpHost="some.host.com"
# vhost can be left blank or no vhost.
amqpVhost=""
# leave port blank to let the library automatically choose
amqpPort=
# Which Protocol to use to connect to AMQP (amqp, amqps)
amqpProtocol="amqps"
# Name of the queue to consume from (must exist on the RMQ host)
amqpConsumeQueue=""
# Should messages be ACK after consume? This will tell RMQ to remove them from the Queue once processed. (true, false)
# Note that setting ackAfterConsume to false might lead to consuming the same messages repeatedly!
ackAfterConsume=false

# Advanced Shovel Parameters

# ************
# Batch Mode *
# ************
# If working in batch mode, uncomment these parameters and comment the oneEach parameters
consumeMode=batch
# AMQP Prefetch Count (the maximum number of messages sent over the channel that can be awaiting acknowledgement).
# Default is unlimited. Either comment this out for unlimited OR set a sufficiently large number to meet your needs.
#amqpPrefetch=300
# How many bytes in flight before a batch is released for consumption
batchMaxSizeBytes=100000
# How many seconds in light before a batch is release for consumption
batchMaxTimeMs=5000

# **************
# OneEach Mode *
# **************
# If working in oneEach mode, uncomment these parameters and comment the batch parameters
#consumeMode=oneEach
# AMQP Prefetch Count (the maximum number of messages sent over the channel that can be awaiting acknowledgement).
# If using consumeLimit, set this to a number less than or equal your limit.
#amqpPrefetch=10
# How many messages to consume (0=all, otherwise enter a limit)
# Should be a multiple of amqpPrefetch (which should not be set to unlimited for limiting to work).
#consumeLimit=10
```

# EventHub Properties

```text
  eventHubName="mkalx-inputeventhub-test"
  eventHubConnectionString=Endpoint=sb://SOMEENDPOINT/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SOMEKEY
```

### Rabbit Secrets

```text
  "amqpUsername": "ENTER USERNAME HERE",
  "amqpPassword": "ENTER PASSWORD HERE",
  "amqpCACertName": "ENTER THE NAME OF YOUR CA CERT FILE",
  "eventHubConnectionString": "Enter the Event Hub Connection String Here"
```

* If your RMQ host uses AMQPS (AMQP over TLS), you'll need the CA Certfile for the server in **/app/conf/ca_certfile.pem**.
* Be sure to set the environment variable **amqpProtocol="amqps"**.
* The field **amqpCACertName=""** should contain the name of your cert file (it will look for the path above) (recommended name is **ca_certfile.pem**).

Note there are two modes for **consumeMode**:
- oneEach - consumes one message at a time and is suitable for testing or very low volume queues. Messages will be sent to Eventhub one at a time, not in batches.
- batch - consumes messages in batches controlled by batch size. Suitable for high volume queues. Messages will be sent to Eventhub in batches.

**What is Prefetch?**

Prefetch is the number of messages "in flight" that a connection into RMQ is allowed. "In flight" means messages that have been sent to a consumer but are not yet ACK by said consumer. The default is unlimited and should be used unless you specifically want to slow down message consumption. Setting a value of 1 would beam that each message must be sent to Eventhub (and then ACK) before RMQ will release a new one. 


## How to run the app

> **Note:** See the Dependencies section before trying to run!

* Running natively via NVM (Node Version Manager)
  * **.env** (same template as **shovel.env**) in **/app** possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * Be sure you've done `npm i` and `nvm i`
  * Run with: `nvm run index.js`

* Running natively via NodeJS
  * **.env** (same template as **shovel.env**) in **/app** possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * `node index.js`

  * note: if you happen to be trying to receive messages from a locally running rabbit instance (such as message-broker from ipb-dev-standup) you're going to need to adjust your .env to be pointing to the localhost (obviously) but also to choose the insecure amqpProtocol and associated port)
    * amqpHost=localhost
    * amqpPort=5672 
    * amqpProtocol=amqp

* Running locally using the Docker dev config
  * **shovel.env** in **/app/conf/**, possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * Be sure you've done `npm i`
  * `docker compose up` to run interactively or `docker compose up -d` to run in the background
  
## Deploying and Running on your PROD remote server

> **Note:** See the Dependencies section before trying to build/deploy!

* When deploying to a remote host, either of the following should work:
  * Copy the whole repo (with **ca_certificate.pem** if required) and then build the production docker compose in-place.
    * On the target server
      * On servers, Docker Compose needs to be installed. Ensure it's installed. If not, see [Docker Compose Install](https://docs.docker.com/compose/install/).
      * Change into the **rabbitmq-to-eventhub-prod** folder
      * Ensure you have the proper values in **app/conf/.env**
      * * If you need a **ca_certificate.pem**, make sure it's in **app/conf**.
      * `docker-compose build`
      * `docker-compose up` to run the container interactively. It is recommended that you run the first time with "ackAfterConsume=false" so you don't lose any messages if there's a container error.
      * Once satisfied the container is working properly, stop the interactive mode, change "ackAfterConsume=true" and run with `docker compose up -d` to run in the background
      * Note that if you update your **ca_certificate.pem**, you must repeat the Docker build step. Changing values in **.env** does not require a rebuild.
  * The production docker compose build can be done in a remote machine and then the docker container can be exported using Docker's export command.
    * On your build workstation
      * Change into the **rabbitmq-to-eventhub-prod** folder
      * Ensure you have the proper values in **app/conf/.env**
      * * If you need a **ca_certificate.pem**, make sure it's in **app/conf**.
      * `docker compose build`
      * `docker export rabbitmq-to-eventhub-prod > rabbitmq-to-eventhub-prod.tar`
    * On the host
      * Copy the three files (**.env**, **docker-compose.yml**, **rabbitmq-to-eventhub-prod.tar** to the host)
      * `docker import rabbitmq-to-eventhub-prod.tar`
      * `docker compose up` to run the container interactively. It is recommended that you run the first time with "ackAfterConsume=false" so you don't lose any messages if there's a container error.
      * Once satisfied the container is working properly, stop the interactive mode, change "ackAfterConsume=true" and run with `docker compose up -d` to run in the background
      * Note that if you update your **ca_certificate.pem**, you must repeat the Docker build step (and export/upload/import to your host).
      
Environment variable notes for running in-place at an RMQ server (it's assumed said server is using AMQPS / AMQP over TLS):

  * The prod container rabbitmq-to-eventhub-prod is suitable to run on the RMQ server itself. Therefore, the RMQ host in this case will be the docker host (using the special "host-gateway" alias).
  * To avoid TLS issues, we used docker's extra_hosts to create a docker compose level HOSTS entry to map the TLS hostname to "host-gateway". See the section [To run the Docker container on your RMQ host](#to-run-the-docker-container-prod-on-your-rmq-host).

## Azure EventHub Capture

During testing, it might be useful to capture what you send into EventHub in an Azure Storage Container.

* If capturing files to Azure Storage, those will be in AVRO format.
  * There are AVRO viewers. In fact, JetBrains WebStorm has one as a plugin. Install [Avro and Parquet Viewer](https://plugins.jetbrains.com/plugin/12281-avro-and-parquet-viewer) from the JetBrains IDE Plugins manager.
  * To download the files there are options:
    * [Azure Storage Explorer](https://github.com/microsoft/AzureStorageExplorer/releases) to see the files and download.
      * Use the full connection string from STORAGE ACCOUNT | ACCESS KEYS | key1 or key2 connection string
    * Azure Portal also lets you navigate into the folder/files and download.

## Edge Cases

### To run the Docker container (prod) on your RMQ host

In this edge case, the RMQ hostname needs to be mapped to the Docker host. To avoid TLS issues, we do this by adding the following to the  docker-compose.yml service entry for rmq-to-eventhub:

```yml
    extra_hosts:
      # If this container will be run on the RMQ host directly, we need to map the RMQ hostname with the internal special host gateway 
      # in order send the traffic to the docker host! This is like setting the HOSTS file inside the container.
      - "${amqpHost}:host-gateway"
```
- The ${amqpHost} will come from your .env file and is the hostname for the RMQ server.
- "host-gateway" is a special docker setting that represents the host's IP internally.

### RMQ host requires an SSH Tunnel in order to connect

In this edge case, the RMQ host is only accessible via an SSH tunnel running on the workstation executing the app. This is not a problem when running NodeJS or NVM natively, but it is a challenge when running inside Docker since the container needs to connect to the host instead of the remote RMQ server.

To do this we add the following to docker-compose.yml service entry for rmq-to-eventhub:

```yml
    extra_hosts:
      # If the RMQ host requires an SSH tunnel, we need to map the RMQ hostname with the internal special host gateway 
      # in order send the traffic to the docker host! This is like setting the HOSTS file inside the container.
      - "${amqpHost}:host-gateway"
```
- The ${amqpHost} will come from your .env file and is the hostname for the RMQ server.
- "host-gateway" is a special docker setting that represents the host's IP internally.

An example SSH tunnel on the docker host: (on the host, port 15671 will be forwarded to the RMQ's port 5671)
`bash
ssh -N -i "/path/to/your/key.pem" -L 127.0.0.1:15671:127.0.0.1:5671 -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes -o ServerAliveCountMax=3 -p YOUR-PORT-NUMBER YOUR-USERNAME@YOU-HOST-IP-OR-NAME
```

## TODO:

- The package "@azure/event-hubs" doesn't provide any errors or feedback if it can't connect to the Eventhub for any reason. This is undesirable as the awaits all just hang and there does not appear to be a way to trap a connection issue.
  - Need to research this further to see if there's a provided way to trap connection errors. If not, need to open an ISSUE on the repo for this package. See [@azure/event-hubs NPM page](https://www.npmjs.com/package/@azure/event-hubs).
  - Might be easier to use the API directly with something like AXIOS. See "send.js" below for an example that just uses the HTTP API.
- Under a scenario where we set batch size from RMQ to 300, while testing, was not seeing the same 300 messages go to EventHub. Not sure if EventHub has a limit or there's a need to detect the batch is "full" before flushing perhaps in multiple steps. Requires research.
  - Tracking under https://github.com/valtech-sd/RabbitMQ-To-EventHub-Shovel/issues/2

## Appendixes

### Send.JS - example sending to Azure EventHub using the HTTP API

```javascript
#!/usr/bin/env node

// Package Dependencies
const axios = require('axios');
const utf8 = require('utf8');
const crypto = require('crypto');
const dotenv = require('dotenv')
dotenv.config()

// Ensure we loaded from .env
if (!process.env ||
  !process.env.EVENTHUB_URI ||
  !process.env.EVENTHUB_NAME ||
  !process.env.SHARED_ACCESS_KEY_NAME ||
  !process.env.SHARED_ACCESS_KEY) {
  console.error(`.env does not have the required values!`)
  process.exit(-1)
}

// Constants, load from .env file in the project root
EVENTHUB_URI=process.env.EVENTHUB_URI
EVENTHUB_NAME=process.env.EVENTHUB_NAME
SHARED_ACCESS_KEY_NAME=process.env.SHARED_ACCESS_KEY_NAME
SHARED_ACCESS_KEY=process.env.SHARED_ACCESS_KEY
SEND_COUNT=process.env.SEND_COUNT

// Test Data To Send (random stuff, random count)
// Note this sends 1 to 10 events of random data
var dataArray=[];
const howManyRecordsToGenerate = SEND_COUNT || Math.floor(Math.random() * 10) + 1;
for (var i = howManyRecordsToGenerate; i > 0; i--) {
  dataArray.push(generateTestDataObject())
}
const data = JSON.stringify(dataArray);

// Request Config - POST to Azure Event Hub
// Azure Horrible Doc Here: https://docs.microsoft.com/en-us/rest/api/eventhub/send-event
// And here for BATCH: https://docs.microsoft.com/en-us/rest/api/eventhub/send-batch-events
var config = {
  method: 'post',
  url: `${EVENTHUB_URI}${EVENTHUB_NAME}/messages?timeout=60&api-version=2014-01`,
  headers: {
    'Authorization': `${createSharedAccessToken(EVENTHUB_URI, SHARED_ACCESS_KEY_NAME, SHARED_ACCESS_KEY)}`,
    'Content-Type': 'application/json'
  },
  data : data
};

// Output a banner
const banner = `send.js is sending...
- Namespace: ${EVENTHUB_URI}
- Hub: ${EVENTHUB_NAME}
- Data (Events = ${dataArray.length}): ${data}`
console.log(banner);

// Axios Send
axios(config)
  .then(function (response) {
    console.log(`Result: ${response.status} - ${response.statusText}`);
  })
  .catch(function (error) {
    console.log(`Error: ${error}`);
  });

// Helper Functions

/**
 * Generates a test data item with random data
 * Note the object structure is per Azure Batch Spec,
 * an object with at most 3 top level properties:
 * - Body
 * - BrokerProperties
 * - UserProperties
 *
 * Each property in turn can contain further structure!
 */
function generateTestDataObject() {
  return {
    "Body": {
      "deviceId": `dev-${Math.floor(Math.random() * 10)+1}`,
      "timestamp": `${Math.floor(new Date().getTime()/1000.0)}`,
      "temperature": `${Math.floor(Math.random() * 10100)/100}`
    },
    "BrokerProperties": {},
    "UserProperties": {
      "sentFrom": "send.js"
    }
  }
}

/**
 * Creates a SAS Token per MS
 * Comes from: https://docs.microsoft.com/en-us/rest/api/eventhub/generate-sas-token
 */
function createSharedAccessToken(uri, saName, saKey) {
  if (!uri || !saName || !saKey) {
    throw "Missing required parameter";
  }
  var encoded = encodeURIComponent(uri);
  var now = new Date();
  var week = 60*60*24*7;
  var ttl = Math.round(now.getTime() / 1000) + week;
  var signature = encoded + '\n' + ttl;
  var signatureUTF8 = utf8.encode(signature);
  var hash = crypto.createHmac('sha256', saKey).update(signatureUTF8).digest('base64');
  return 'SharedAccessSignature sr=' + encoded + '&sig=' +
    encodeURIComponent(hash) + '&se=' + ttl + '&skn=' + saName;
}
```

