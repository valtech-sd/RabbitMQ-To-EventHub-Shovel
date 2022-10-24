// Support for File System
const fs = require('fs');
const path = require('path');
// Enter either "amqp" or "amqps"
const amqpProtocol = process.env.amqpProtocol || 'amqps';
// Port is automatically selected if amqpPort is null
// Otherwise, to force a specific port, enter it here!
const amqpPort = process.env.amqpPort;

const directoryPath = path.join(__dirname, 'cert');

// console.log("cert",fs.readFileSync(
//      directoryPath + '/' + (process.env.amqpCACertName || 'ca_certificate.pem'),'utf8'))

const amqpConfig = {
  // Protocol should be "amqps" or "amqp"
  protocol: amqpProtocol,
  // Username + Password on the RabbitMQ host
  username: process.env.amqpUsername,
  password: process.env.amqpPassword,
  // Host
  host: process.env.amqpHost || 'localhost',
  // Virtual Host inside Host
  vhost: process.env.amqpVhost || '',
  // Port AMQPS=5671, AMQP=5672
  port: amqpPort || (amqpProtocol === 'amqps' ? 5671 : 5672),
  // AMQP Options which should conform to <AmqpConnectionManagerOptions>
  amqp_opts: {
    // Pass options to node amqp connection manager (a wrapper around AMQPLIB)
    // See connect(urls, options) in https://www.npmjs.com/package/amqp-connection-manager
    heartbeatIntervalInSeconds: 5, // Default
    reconnectTimeInSeconds: 5, // Default

    // Pass options into the underlying AMQPLIB.
    // See AMQPLIB SocketOptions https://www.squaremobius.net/amqp.node/channel_api.html#connect
    connectionOptions: {
      // If using AMQPS, we need to pass the contents of your CA file as a buffer into the broker host via amqp_opts.
      // This is facilitated for you here. Just copy your CA CERT file to the same location as this config file
      // then edit the shovel.env file to enter the NAME of your CA CERT file! Don't forget to set 'amqps' and
      // 'port' to the corresponding AMQPS values also in this configuration!
      // See https://www.squaremobius.net/amqp.node/ssl.html for more details.
      ca:
          amqpProtocol === 'amqps' && process.env.amqpCACertName !== ''
          ? [
                fs.readFileSync(
                    directoryPath + '/' + (process.env.amqpCACertName || 'ca_certificate.pem')
                ),
            ]
          : null,
    },
  },
  consumeQueue: process.env.amqpConsumeQueue || 'example-queue',
  // Environment vars come in as strings, so convert to TRUE bool if we were passed 'true', otherwise, we use FALSE bool.
  ackAfterConsume: process.env.ackAfterConsume === 'true' || false,
};


const eventHubConfig = {
  eventHubConnectionString:
      process.env.eventHubConnectionString,
  eventHubName: process.env.eventHubName || 'example-eventhub-name',
};

module.exports = {
  amqpConfig: amqpConfig,
  eventHubConfig: eventHubConfig,
};
