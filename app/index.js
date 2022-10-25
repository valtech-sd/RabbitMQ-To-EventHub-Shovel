/**
 * Dependencies
 */
const fs = require('fs')
// Bring in Core Node Dependencies
const util = require('util');
// Bring in Package Dependencies
const { default: AmqpCacoon } = require('amqp-cacoon');
const { EventHubProducerClient } = require('@azure/event-hubs');
const dotenv = require('dotenv')
const logger = require('./modules/custom-logger');

// Use dotenv to pull from a local .env file in the root of the project
// Any variables in that file will be available as 'process.env.VAR_NAME'
//
// NOTE: THIS MUST BE VERY EARLY BEFORE OTHER LOCAL FILES LOAD SO THEY HAVE
//  ACCESS TO THE HYDRATED process.env.


if (process.argv[2] && fs.existsSync(  process.argv[2])) {
  logger.info("loading", process.argv[2]);
  dotenv.config({path: process.argv[2]})
}
else {
  //without an arg, this looks for .env next to this index.js file
  dotenv.config()
  if(process.env.logLevel){logger.info("loading .env")}
  else{ logger.error("couldn't load any env");process.exit(1)}
}

// Bring in other Application Specific dependencies

// Bring in our AMQP Broker configuration
const config = require('./conf/config');
// Bring in our MessageProcessor
const MessageProcessor = require('./modules/MessageProcessor');
// Constants
const amqpPrefetch = parseInt(process.env.amqpPrefetch) || false;

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
      // Set prefetch to something per .env or a default
      // This controls how many messages RMQ will release before requiring ACK
      if (amqpPrefetch) {
        logger.info(
          `AMQP Prefetch set to: ${amqpPrefetch} messages released before ACK/NACK.`
        );
        channel.prefetch(amqpPrefetch);
      }

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
 * Let's do this!
 */
logger.info(
  `Registering a consumer for your AMQP host "${config.amqpConfig.host}"`
);

// Point to the proper handler based on consumeMode
const consumeMode = process.env.consumeMode || 'batch';
const mp = new MessageProcessor(config, amqpCacoon, eventHubProducer, logger);
const handler =
  consumeMode === 'batch'
    ? mp.consumeBatch.bind(mp)
    : mp.consumeOneeach.bind(mp);

// Fire off the handler and process messages
handler()
  .then(() => {
    // Ok, we should have a consumer ready! And it should be firing as messages arrive at the consumed queue!
  })
  .catch((e) => {
    // Uh Oh... something went wrong
    logger.error(`Something bad happened: ${e.message}`);
  });
