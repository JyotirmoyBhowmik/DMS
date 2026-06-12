import net from 'node:net';
import amqp from 'amqplib';

export interface BrokerConfig {
  host?: string;
  port?: number;
  protocol?: 'amqp' | 'kafka';
  username?: string;
  password?: string;
  vhost?: string;
  topics?: string[];
  exchange?: string;
}

export class MessageBrokerClient {
  private config: BrokerConfig;
  // Using any to bypass conflicting and inconsistent type definitions in @types/amqplib
  private connection: any = null;
  private channel: any = null;
  private isConnected = false;
  private isClosing = false;
  private subscriptions: Map<
    string,
    {
      queue: string;
      exchange: string;
      routingKey: string;
      handler: (msg: unknown) => Promise<void>;
      options?: { maxRetries?: number };
    }
  > = new Map();

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  /**
   * Checks connection health using socket resolution
   */
  async checkConnection(): Promise<{ status: 'CONNECTED' | 'DISCONNECTED'; error?: string }> {
    const host = this.config.host || 'localhost';
    const port = this.config.port || 5672;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);

      socket.on('connect', () => {
        socket.destroy();
        resolve({ status: 'CONNECTED' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'DISCONNECTED', error: err.message });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'DISCONNECTED', error: 'Broker connection timeout' });
      });

      socket.connect(port, host);
    });
  }

  /**
   * Connects to RabbitMQ and creates a ConfirmChannel.
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.connection && this.channel) {
      return;
    }

    const host = this.config.host || 'localhost';
    const port = this.config.port || 5672;
    const username = this.config.username || 'guest';
    const password = this.config.password || 'guest';
    const vhost = this.config.vhost || '';
    const url = `amqp://${username}:${password}@${host}:${port}${vhost}`;

    try {
      this.isClosing = false;
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createConfirmChannel();
      this.isConnected = true;

      this.connection.on('close', () => {
        this.isConnected = false;
        this.connection = null;
        this.channel = null;
        if (!this.isClosing) {
          this.handleDisconnect();
        }
      });

      this.connection.on('error', () => {
        this.isConnected = false;
      });
    } catch (err) {
      this.isConnected = false;
      throw err;
    }
  }

  private handleDisconnect(): void {
    if (this.isConnected || this.isClosing) return;
    // Attempt reconnection in the background
    setTimeout(async () => {
      if (this.isClosing) return;
      try {
        await this.connect();
        // Re-establish subscriptions
        for (const sub of this.subscriptions.values()) {
          await this.setupSubscription(sub.exchange, sub.queue, sub.routingKey, sub.handler, sub.options);
        }
      } catch {
        this.handleDisconnect();
      }
    }, 5000);
  }

  /**
   * Closes connection and channel cleanly.
   */
  async close(): Promise<void> {
    this.isClosing = true;
    this.isConnected = false;
    this.subscriptions.clear();
    if (this.channel) {
      await this.channel.close().catch(() => {});
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close().catch(() => {});
      this.connection = null;
    }
  }

  /**
   * Publishes an event payload to a target exchange with a routing key (topic)
   */
  async publish(
    topic: string,
    message: unknown,
    options?: { exchangeName?: string }
  ): Promise<{ success: boolean; messageId: string }> {
    await this.connect();
    if (!this.channel) {
      throw new Error('Broker is not connected');
    }

    const exchange = options?.exchangeName || this.config.exchange || 'dms.events';
    const msgId = 'msg-' + Math.random().toString(36).substring(2, 15);

    // Ensure exchange is asserted
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    const payload = Buffer.from(JSON.stringify(message));

    return new Promise((resolve, reject) => {
      this.channel.publish(
        exchange,
        topic,
        payload,
        {
          persistent: true,
          messageId: msgId,
        },
        (err: any, _ok: any) => {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, messageId: msgId });
          }
        }
      );
    });
  }

  /**
   * Subscribes to a topic, asserting the necessary exchange and queue topologies.
   */
  async subscribe(
    topic: string,
    handler: (msg: unknown) => Promise<void>,
    options?: { queueName?: string; exchangeName?: string; dlqName?: string; maxRetries?: number }
  ): Promise<void> {
    await this.connect();
    if (!this.channel) {
      throw new Error('Broker is not connected');
    }

    const exchange = options?.exchangeName || this.config.exchange || 'dms.events';
    const queue = options?.queueName || `${exchange}.${topic}`;
    const dlq = options?.dlqName || `${queue}.dlq`;
    const maxRetries = options?.maxRetries ?? 5;

    // 1. Declare main exchange
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    // 2. Declare dead-letter exchange (DLX)
    const dlxExchange = `${exchange}.dlx`;
    await this.channel.assertExchange(dlxExchange, 'topic', { durable: true });

    // 3. Declare DLQ queue and bind it to DLX
    await this.channel.assertQueue(dlq, { durable: true });
    await this.channel.bindQueue(dlq, dlxExchange, topic);

    // 4. Declare main queue with DLX bindings
    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxExchange,
        'x-dead-letter-routing-key': topic,
      },
    });

    // 5. Bind main queue to main exchange
    await this.channel.bindQueue(queue, exchange, topic);

    // Store subscription details
    const subId = `${exchange}:${queue}:${topic}`;
    this.subscriptions.set(subId, {
      queue,
      exchange,
      routingKey: topic,
      handler,
      options: { maxRetries },
    });

    await this.setupSubscription(exchange, queue, topic, handler, { maxRetries });
  }

  private async setupSubscription(
    exchange: string,
    queue: string,
    topic: string,
    handler: (msg: unknown) => Promise<void>,
    options?: { maxRetries?: number }
  ): Promise<void> {
    if (!this.channel) return;

    const maxRetries = options?.maxRetries ?? 5;

    await this.channel.consume(queue, async (msg: any) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());

        // Extract attempt count
        const attempt = msg.properties.headers?.['x-delivery-attempt'] || 1;

        const inboundEvent = {
          ...content,
          deliveryAttempt: attempt,
        };

        // Invoke consumer handler
        await handler(inboundEvent);

        // Acknowledge upon successful processing
        if (this.channel) {
          this.channel.ack(msg);
        }
      } catch (err) {
        const attempt = msg.properties.headers?.['x-delivery-attempt'] || 1;

        if (attempt < maxRetries) {
          const nextAttempt = attempt + 1;
          const delayMs = 100 * Math.pow(2, attempt - 1); // backoff: 100ms, 200ms, 400ms...

          // Re-publish to the same queue with a delay and incremented delivery attempt
          setTimeout(async () => {
            try {
              if (this.channel && !this.isClosing) {
                await this.channel.publish(exchange, topic, msg.content, {
                  persistent: true,
                  headers: {
                    ...msg.properties.headers,
                    'x-delivery-attempt': nextAttempt,
                  },
                });
                this.channel.ack(msg);
              }
            } catch {
              // Requeue if publishing fails
              if (this.channel && !this.isClosing) {
                this.channel.nack(msg, false, true);
              }
            }
          }, delayMs);
        } else {
          // Route to DLQ after exhaustion
          const dlxExchange = `${exchange}.dlx`;
          try {
            if (this.channel && !this.isClosing) {
              await this.channel.publish(dlxExchange, topic, msg.content, {
                persistent: true,
                headers: {
                  ...msg.properties.headers,
                  'x-delivery-attempt': attempt,
                  'x-error': String(err instanceof Error ? err.message : err),
                },
              });
              this.channel.ack(msg);
            }
          } catch {
            // Requeue as a last resort if publish to DLX fails
            if (this.channel && !this.isClosing) {
              this.channel.nack(msg, false, true);
            }
          }
        }
      }
    });
  }
}
