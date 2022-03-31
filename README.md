# README.md

## Summary

This repo (RabbitMQ to EventHub Shovel) is a template that contains a NodeJS app that will consume messages from a RabbitMQ queue and immediately send them to an Azure EventHub. It can be run directly using node, nvm or Docker (recommended).

## Dependencies

**Install NPM Dependencies**

* From the **/app** directory, run `npm i`.

**Secrets, CA_Certificate**

* You need a **secrets.json5** file in **/app/conf**.
* See the template **secrets-template.json5** for the structure.

* If your RMQ host uses AMQP, you'll need the CA Certfile for the server in **ca_certfile.pem**.
* Be sure to set the environment variable **amqpProtocol="amqps"**.
* Also, in **secrets.json5**, make sure **amqpCACertName=""** contains the name of your cert file (default name is **ca_certfile.pem**).

**Environment**

* You need environment variables set. See the file corresponding to your run method.
  * If you're running natively, see the template **/app/environment.template** and use it to create a .env file in **/app**.
  * If you're running **rabbitmq-to-eventhub-dev**, see the template **/rabbitmq-to-eventhub-dev/environment.template** and use it to create a **.env** file in **/rabbitmq-to-eventhub-dev**.
  * If you're running **rabbitmq-to-eventhub-prod**, see the template **/rabbitmq-to-eventhub-prod/environment.template** and use it to create a **.env** file in **/rabbitmq-to-eventhub-prod**.

**RabbitMQ & Azure**

* Last, you need an RMQ server and an Azure Event Hub. Messages from a queue in the RMQ server will be sent to the Azure Event Hub. Note the routing key sent to RMQ will be passed into Azure Event Hub via the properties bag. (EventHub sends your program an EventData object that has the properties "body" and "properties". The routing key will be passed into **EventData.properties.routingKey**).

## How to run the app

> **Note:** See the Dependencies section before trying to run!

* Running natively via NVM (Node Version Manager)
  * **.env** in **/app**, **secrets.json5** in **/app/conf**, possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * Be sure you've done `npm i`
  * Run with: `nvm index.js`

* Running natively via NodeJS
  * **.env** in **/app**, **secrets.json5** in **/app/conf**, possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * Be sure you've done `npm i`
  * `node index.js`

* Running locally using the Docker dev config
  * **.env** in **/rabbitmq-to-eventhub-dev**, **secrets.json5** in **/app/conf**, possibly **ca_certificate.pem** (if needed) in **/app/conf**
  * Be sure you've done `npm i`
  * `docker compose up` to run interactively or `docker compose up -d` to run in the background
  
## Deploying and Running on your PROD remote server

> **Note:** See the Dependencies section before trying to build/deploy!

* When deploying to a remote host, either of the following should work:
  * Copy the whole repo (with the **secrets.json5** and **ca_certificate.pem** if required) and then build the production docker compose in-place.
    * On the target server
      * Change into the **rabbitmq-to-eventhub-prod** folder
      * Ensure you have the proper values in **.env**
      * `docker compose build`
      * `docker compose up` to run the container interactively. It is recommended that you run the first time with "ackAfterConsume=false" so you don't lose any messages if there's a container error.
      * Once satisfied the container is working properly, stop the interactive mode, change "ackAfterConsume=true" and run with `docker compose up -d` to run in the background
  * The production docker compose build can be done in a remote machine and then the docker container can be exported using Docker's export command.
    * On your build workstation
      * Change into the **rabbitmq-to-eventhub-prod** folder
      * Ensure you have the proper values in **.env**
      * `docker compose build`
      * `docker export rabbitmq-to-eventhub-prod > rabbitmq-to-eventhub-prod.tar`
    * On the host
      * Copy the three files (**.env**, **docker-compose.yml**, **rabbitmq-to-eventhub-prod.tar** to the host)
      * `docker import rabbitmq-to-eventhub-prod.tar`
      * `docker compose up` to run the container interactively. It is recommended that you run the first time with "ackAfterConsume=false" so you don't lose any messages if there's a container error.
      * Once satisfied the container is working properly, stop the interactive mode, change "ackAfterConsume=true" and run with `docker compose up -d` to run in the background
      
Environment variable notes for running in-place at an RMQ server (it's assumed said server is using AMQPS / AMQP over TLS):

  * The prod container rabbitmq-to-eventhub-prod is suitable to run on the RMQ server itself. Therefore, the RMQ host in this case will be the docker host (using the special "host-gateway" alias).
  * To avoid TLS issues, we used docker's extra_hosts to create a docker compose level HOSTS entry to map the TLS hostname to "host-gateway". See the section ["To run the Docker container on your RMQ host"](#To run the Docker container on your RMQ host)

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

```bash
ssh -N -i "/path/to/your/key.pem" -L 127.0.0.1:15671:127.0.0.1:5671 -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes -o ServerAliveCountMax=3 -p YOUR-PORT-NUMBER YOUR-USERNAME@YOU-HOST-IP-OR-NAME
```

## TODO:

- Nothing identified at the moment.

