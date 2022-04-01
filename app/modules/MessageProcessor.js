/**
 * A public class to process our messages.
 *
 */
class MessageProcessor {
  /**
   * Construct our instance.
   *
   * @param config
   * @param amqpCacoon
   * @param eventHubProducer
   * @param logger
   */
  constructor(config, amqpCacoon, eventHubProducer, logger) {
    this.config = config;
    this.amqpCacoon = amqpCacoon;
    this.eventHubProducer = eventHubProducer;
    this.logger = logger;
    this.processorsPrivate = new MessageProcessorPrivate(
      this.config,
      this.amqpCacoon,
      this.eventHubProducer,
      this.logger
    );
  }

  /**
   * A consumer that works with Batches of RMQ messages.
   *
   * @return {Promise<void>}
   */
  async consumeBatch() {
    // Constants
    const maxSizeInBytes = parseInt(process.env.batchMaxSizeBytes) || 10000;
    const maxTimeMs = parseInt(process.env.batchMaxTimeMs) || 5000;

    // Output info
    this.logger.info(
      `consumeMode: batch; bytes=${maxSizeInBytes}; time in ms=${maxTimeMs}`
    );
    this.logger.info(
      `EventHub Output: ${this.config.eventHubConfig.eventHubName}`
    );

    // Connects and sets up a subscription channelWrapper
    await this.amqpCacoon.getConsumerChannel();

    // Register a consumer to consume batches of messages
    await this.amqpCacoon.registerConsumerBatch(
      this.config.amqpConfig.consumeQueue,
      this.processorsPrivate.consumerHandlerBatch.bind(this.processorsPrivate),
      {
        batching: {
          maxSizeBytes: maxSizeInBytes,
          maxTimeMs: maxTimeMs,
        },
      }
    );
  }

  /**
   * A consumer that works with single RMQ messages.
   *
   * @return {Promise<void>}
   */
  async consumeOneeach() {
    // Output info
    this.logger.info(`consumeMode: oneEach`);
    this.logger.info(
      `EventHub Output: ${this.config.eventHubConfig.eventHubName}`
    );

    // Connects and sets up a subscription channelWrapper
    await this.amqpCacoon.getConsumerChannel();

    // Register a consumer to consume batches of messages
    await this.amqpCacoon.registerConsumer(
      this.config.amqpConfig.consumeQueue,
      this.processorsPrivate.consumerHandler.bind(this.processorsPrivate)
    );
  }
}
module.exports = MessageProcessor;

/**
 * A class to hold private methods we don't want to export.
 */
class MessageProcessorPrivate {
  /**
   * Construct our instance.
   *
   * @param config
   * @param amqpCacoon
   * @param eventHubProducer
   * @param logger
   */
  constructor(config, amqpCacoon, eventHubProducer, logger) {
    this.config = config;
    this.amqpCacoon = amqpCacoon;
    this.eventHubProducer = eventHubProducer;
    this.logger = logger;
    // Setup an instance accumulator to keep track of how many messages
    // we have consumed.
    this.consumeCount = 0;
    // Store the limit from the config
    this.consumeLimit = parseInt(process.env.consumeLimit) || 0;
  }

  /**
   * Used as the callback for the AMQP Consume Batch event
   *
   * @param channelWrapper
   * @param msgBatch
   * @return {Promise<void>}
   */
  async consumerHandlerBatch(channelWrapper, msgBatch) {
    try {
      this.logger.info(
        `Received message batch with count ${msgBatch.messages.length}`
      );
      // Prepare an EventHub Batch
      let eventHubBatch = await this.eventHubProducer.createBatch();
      // Loop through the batch and handle each message as needed
      for (let msg of msgBatch.messages) {
        // The msg from RMQ has the properties:
        // - content - which has the message in a buffer. Use toString() to extract as a string.
        // - fields - which has standard RMQ properties and metadata. In our care, we're interested in routingKey.
        this.logger.debug(
          `Message from exchange='${msg.fields.exchange}' and routingKey='${msg.fields.routingKey}'.`
        );
        this.logger.trace(`Message: ${msg.content.toString()}`);
        // Add the message to the Event Hub Batch
        eventHubBatch.tryAdd({
          body: msg.content.toString(),
          properties: { routingKey: msg.fields.routingKey },
        });
      }
      // Send the EventHub Batch
      this.logger.info(
        `Sending batch to EventHub with ${eventHubBatch.count} records and ${eventHubBatch.sizeInBytes} bytes.`
      );
      await this.eventHubProducer.sendBatch(eventHubBatch);
      // Once processing is done, ACK them all if the config is set for that!
      if (this.config.amqpConfig.ackAfterConsume) {
        msgBatch.ackAll();
      } else {
        msgBatch.nackAll();
      }
    } catch (e) {
      // Some error happened in our handling of the message batch.
      // The bet practice is to NACK all the messages so that some other process retries them!
      msgBatch.nackAll();
    }
  }

  /**
   * Used as the callback for the AMQP Consume single message event
   *
   * @param channelWrapper
   * @param msg
   * @return {Promise<void>}
   */
  async consumerHandler(channelWrapper, msg) {
    try {
      this.consumeCount++;
      this.logger.info(`Received message.`);
      // Prepare an EventHub Batch
      let eventHubBatch = await this.eventHubProducer.createBatch();

      // The msg from RMQ has the properties:
      // - content - which has the message in a buffer. Use toString() to extract as a string.
      // - fields - which has standard RMQ properties and metadata. In our care, we're interested in routingKey.
      this.logger.debug(
        `Message from exchange='${msg.fields.exchange}' and routingKey='${msg.fields.routingKey}'.`
      );
      this.logger.trace(`Message: ${msg.content.toString()}`);
      // Add the message to the Event Hub Batch
      eventHubBatch.tryAdd({
        body: msg.content.toString(),
        properties: { routingKey: msg.fields.routingKey },
      });

      // Send the EventHub Batch
      this.logger.info(
        `Sending batch to EventHub with ${eventHubBatch.count} records and ${eventHubBatch.sizeInBytes} bytes.`
      );
      await this.eventHubProducer.sendBatch(eventHubBatch);

      // Once processing is done, ACK the message (or not)
      if (this.config.amqpConfig.ackAfterConsume) {
        channelWrapper.ack(msg);
      } else {
        channelWrapper.nack(msg);
      }

      if (this.consumeCount >= this.consumeLimit) {
        this.logger.info(
          `Environment consumeLimit reached. Consumer stopping after consuming ${this.consumeCount} messages.`
        );
        process.exit();
      }
    } catch (e) {
      // Some error happened in our handling of the message.
      // The bet practice is to NACK so that some other process retries the message!
      channelWrapper.nack(msg);
    }
  }
}
