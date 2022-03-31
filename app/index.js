/**
 * Dependencies
 */
// Bring in Core Node Dependencies
const util = require('util');
// Bring in Package Dependencies
const { default: AmqpCacoon } = require('amqp-cacoon');
const { EventHubProducerClient } = require('@azure/event-hubs');
// Use dotenv to pull from a local .env file in the root of the project
// Any variables in that file will be available as 'process.env.VAR_NAME'.
// NOTE: THIS MUST BE VERY EARLY BEFORE OTHER LOCAL FILES LOAD SO THEY HAVE
//       ACCESS TO THE HYDRATED process.env.
require('dotenv').config();

// Bring in other Application Specific dependencies
const logger = require('./custom-logger');
// Bring in our AMQP Broker configuration
const config = require('./conf/config');

/**
 * AMQP Cacoon is a library that makes it easy to connect to RabbitMQ.
 */
let amqpCacoon = new AmqpCacoon({
  protocol: config.amqpConfig.protocol,
  username: config.amqpConfig.username,
  password: config.amqpConfig.password,
  host: config.amqpConfig.host,
  port: config.amqpConfig.port,
  vhost: config.amqpConfig.vhost,
  amqp_opts: config.amqpConfig.amqp_opts,
  providers: {
    logger: logger,
  },
  onBrokerConnect: async (connection, url) => {
    // This is an example "Connect" event fired off by AMQP Connection Manager
    logger.info(
      `AMQP connected to broker: "${config.amqpConfig.host}" on port ${config.amqpConfig.port} over "${config.amqpConfig.protocol}".`
    );
    logger.info(
      `After messages are processed, the AMQP consumer will ${
        config.amqpConfig.ackAfterConsume ? 'ACK' : 'NACK'
      } messages.`
    );
  },
  onBrokerDisconnect: async (err) => {
    // This is an example "Disconnect" event fired off by AMQP Connection Manager
    logger.error(`AMQP broker disconnected with error "${err.err.message}"`);
  },
  // Important - onChannelConnect will ensure a certain configuration exists in RMQ.
  // This might not be needed in environments where RMQ is setup by some other process!
  onChannelConnect: async (channel) => {
    try {
      logger.info(`AMQP Channel Connect.`);
      // Assert exchanges, queues, etc. here if necessary!
    } catch (ex) {
      logger.error(`onChannelConnect ERROR: ${util.inspect(ex.message)}`);
      // If we can't complete our connection setup, we better throw because it's unlikely we'll
      // be able to properly consume messages!
      throw ex;
    }
  },
});

/**
 * Event Hub Producer Client
 */
const eventHubProducer = new EventHubProducerClient(
  config.eventHubConfig.eventHubConnectionString,
  config.eventHubConfig.eventHubName
);

/**
 * Logic Main Method
 * Let's create a main method to hold our logic...
 */
async function main() {
  // Output info
  logger.info(`EventHub Output: ${config.eventHubConfig.eventHubName}`);

  // Connects and sets up a subscription channelWrapper
  await amqpCacoon.getConsumerChannel();

  // Register a consumer to consume batches of messages
  await amqpCacoon.registerConsumerBatch(
    config.amqpConfig.consumeQueue,
    async (channelWrapper, msgBatch) => {
      try {
        logger.info(
          `Received message batch with count ${msgBatch.messages.length}`
        );
        // Prepare an EventHub Batch
        let eventHubBatch = await eventHubProducer.createBatch();
        // Loop through the batch and handle each message as needed
        for (let msg of msgBatch.messages) {
          // The msg from RMQ has the properties:
          // - content - which has the message in a buffer. Use toString() to extract as a string.
          // - fields - which has standard RMQ properties and metadata. In our care, we're interested in routingKey.
          logger.debug(
            `Message from exchange='${msg.fields.exchange}' and routingKey='${msg.fields.routingKey}'.`
          );
          logger.trace(`Message: ${msg.content.toString()}`);
          // Add the record to the Event Hub Batch
          eventHubBatch.tryAdd({
            body: msg.content.toString(),
            properties: { routingKey: msg.fields.routingKey },
          });
        }
        // Send the EventHub Batch
        logger.info(
          `Sending batch to EventHub with ${eventHubBatch.count} records and ${eventHubBatch.sizeInBytes} bytes.`
        );
        await eventHubProducer.sendBatch(eventHubBatch);
        // Once processing is done, ACK them all if the config is set for that!
        if (config.amqpConfig.ackAfterConsume) {
          msgBatch.ackAll();
        } else {
          msgBatch.nackAll();
        }
      } catch (e) {
        // Some error happened in our handling of the message batch.
        // The bet practice is to NACK all the messages so that some other process retries them!
        msgBatch.nackAll();
      }
    },
    {
      batching: {
        maxSizeBytes: 1000, // A total of 1,000 Bytes will force consume
        maxTimeMs: 5000, // 5000ms = 5s elapsed will for a consume
      },
    }
  );
}

/**
 * Let's do this!
 */
logger.info(
  `Registering a consumer for your AMQP host "${config.amqpConfig.host}"`
);

main()
  .then(() => {
    // Ok, we should have a consumer ready! And it should be firing as messages arrive at the consumed queue!
  })
  .catch((e) => {
    // Uh Oh... something went wrong
    console.error(`Something bad happened: ${e.message}`);
  });
