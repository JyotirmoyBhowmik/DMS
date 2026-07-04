import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Pool } from 'pg';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { MigrationRunner } from '@dms/pkg-database';
import { MessageBrokerClient } from './broker/rabbitmq.js';
import { OutboxDispatcher } from './outbox/dispatcher.js';
import { OutboxRepository } from './outbox/outbox.repository.js';
import { IdempotentConsumer } from './consumers/idempotent_consumer.js';
import { makeEnvelope } from './envelope/envelope.js';

describe('Transactional Outbox & RabbitMQ Eventing E2E Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;
  let broker: MessageBrokerClient;
  let outboxRepo: OutboxRepository;
  let isDbAlive = false;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const correlationCtx = {
    tenantId,
    correlationId: 'corr-e2e-123',
    causationId: 'caus-e2e-456',
    producer: 'integration-test',
    partitionKey: 'partition-key-e2e',
  };

  before(async () => {
    // 1. Initialize DB Connection
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'user',
      password: process.env.PGPASSWORD || 'password',
      database: process.env.PGDATABASE || 'dms',
      connectionTimeoutMillis: 500
    });
    try {
      const client = await pool.connect();
      client.release();
      isDbAlive = true;
    } catch (err) {
      console.log('Skipping Transactional Outbox & RabbitMQ Eventing E2E Integration Tests because live database is not reachable.');
      return;
    }
    const driver = new PgDriver(pool);
    db = new PostgresDatabaseClient({}, driver);

    // 2. Run system migrations to ensure outbox_events and processed_events tables exist
    const systemMigrationsDir = existsSync(join(process.cwd(), 'db/migrations/system'))
      ? join(process.cwd(), 'db/migrations/system')
      : join(process.cwd(), '../../db/migrations/system');

    console.log(`[E2E] Running migrations from: ${systemMigrationsDir}`);
    // Clean start for migration testing by resetting public schema
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    const migrationRunner = new MigrationRunner(db, {
      migrationsDir: systemMigrationsDir,
    });
    await migrationRunner.migrate();

    // 3. Initialize Message Broker Client
    broker = new MessageBrokerClient({
      host: process.env.TEST_BROKER_HOST || 'localhost',
      port: Number(process.env.TEST_BROKER_PORT) || 5672,
      username: process.env.TEST_BROKER_USER || 'guest',
      password: process.env.TEST_BROKER_PASSWORD || 'guest',
      exchange: 'test.dms.events',
    });
    await broker.connect();

    // 4. Initialize Outbox Repository
    outboxRepo = new OutboxRepository();
  });

  after(async () => {
    if (broker && isDbAlive) {
      await broker.close();
    }
    if (db && isDbAlive) {
      await db.shutdown();
    }
  });

  // Clean tables before each test
  beforeEach(async () => {
    if (!isDbAlive) return;
    // Set tenant context for system queries
    await db.query(`SET app.tenant_id = '${tenantId}'`);
    await db.query('TRUNCATE TABLE outbox_events, processed_events RESTART IDENTITY CASCADE');
  });

  test('E2E: Atomic Write & At-Least-Once Delivery Flow', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const aggregateId = 'agg-atomic-1';
    const eventType = 'test.order.placed';
    const eventVersion = 'v1';
    const eventPayload = { orderId: 'ord-1001', amount: 15000 };

    const envelope = makeEnvelope(eventType, eventVersion, eventPayload, correlationCtx);

    // 1. Write state change + outbox event in the same transaction
    await db.transaction(async (conn) => {
      // Simulate state write (can be empty since it's verified in transaction)
      // Save outbox event
      await outboxRepo.save(conn, {
        eventId: envelope.eventId,
        tenantId: envelope.tenantId!,
        type: envelope.type,
        version: envelope.version,
        payload: envelope.payload,
      }, 'Order', aggregateId);
    }, tenantId);

    // Verify event is in the database and unpublished
    const initialRows = await db.query<any>(
      'SELECT * FROM outbox_events WHERE id = $1',
      [envelope.eventId],
      tenantId
    );
    assert.strictEqual(initialRows.rows.length, 1);
    assert.strictEqual(initialRows.rows[0].published_at, null);

    // 2. Set up Idempotent Consumer
    let receivedEvent: any = null;
    const consumer = new IdempotentConsumer(
      db,
      broker,
      async (evt) => {
        receivedEvent = evt;
      },
      {
        consumerGroup: 'test-atomic-consumer-group',
        exchangeName: 'test.dms.events',
      }
    );

    const fullTopic = `${eventType}.${eventVersion}`;
    consumer.subscribe(fullTopic);

    // Allow time for channel consume setup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Start Outbox Dispatcher to relay the event
    const dispatcher = new OutboxDispatcher(db, broker, {
      tableName: 'outbox_events',
      maxRetries: 3,
    });
    
    const dispatchResult = await dispatcher.dispatchPending();
    assert.strictEqual(dispatchResult.dispatched, 1);

    // 4. Wait for consumer to receive the event
    let attempts = 0;
    while (!receivedEvent && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      attempts++;
    }

    assert.ok(receivedEvent);
    assert.strictEqual(receivedEvent.eventId, envelope.eventId);
    assert.strictEqual(receivedEvent.tenantId, tenantId);
    assert.deepStrictEqual(receivedEvent.payload, eventPayload);

    // Verify outbox row is now marked as published
    const finalRows = await db.query<any>(
      'SELECT * FROM outbox_events WHERE id = $1',
      [envelope.eventId],
      tenantId
    );
    assert.ok(finalRows.rows[0].published_at !== null);
  });

  test('E2E: Atomic Write Transaction Rollback Prevents Outbox Dispatch', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const aggregateId = 'agg-rollback-1';
    const eventType = 'test.order.failed';
    const eventVersion = 'v1';
    const envelope = makeEnvelope(eventType, eventVersion, { data: 'test' }, correlationCtx);

    // Write inside a transaction that gets rolled back
    try {
      await db.transaction(async (conn) => {
        await outboxRepo.save(conn, {
          eventId: envelope.eventId,
          tenantId: envelope.tenantId!,
          type: envelope.type,
          version: envelope.version,
          payload: envelope.payload,
        }, 'Order', aggregateId);

        throw new Error('Simulation of application failure - rolling back transaction');
      }, tenantId);
    } catch (err) {
      assert.strictEqual((err as Error).message, 'Simulation of application failure - rolling back transaction');
    }

    // Verify event is NOT in the database
    const dbRows = await db.query<any>(
      'SELECT * FROM outbox_events WHERE id = $1',
      [envelope.eventId],
      tenantId
    );
    assert.strictEqual(dbRows.rows.length, 0);
  });

  test('E2E: Strict Ordering per Aggregate', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const aggregateId = 'agg-ordered-1';
    const eventType = 'test.order.seq';
    const eventVersion = 'v1';

    const envelope1 = makeEnvelope(eventType, eventVersion, { step: 1 }, correlationCtx);
    const envelope2 = makeEnvelope(eventType, eventVersion, { step: 2 }, correlationCtx);

    // Save in order
    await db.transaction(async (conn) => {
      await outboxRepo.save(conn, {
        eventId: envelope1.eventId,
        tenantId: envelope1.tenantId!,
        type: envelope1.type,
        version: envelope1.version,
        payload: envelope1.payload,
      }, 'Order', aggregateId);
    }, tenantId);

    // Introduce a tiny delay so created_at is distinct
    await new Promise((resolve) => setTimeout(resolve, 100));

    await db.transaction(async (conn) => {
      await outboxRepo.save(conn, {
        eventId: envelope2.eventId,
        tenantId: envelope2.tenantId!,
        type: envelope2.type,
        version: envelope2.version,
        payload: envelope2.payload,
      }, 'Order', aggregateId);
    }, tenantId);

    // Set up consumer that records sequence of arrivals
    const receivedSteps: number[] = [];
    const consumer = new IdempotentConsumer(
      db,
      broker,
      async (evt: any) => {
        receivedSteps.push(evt.payload.step);
      },
      {
        consumerGroup: 'test-order-consumer-group',
        exchangeName: 'test.dms.events',
      }
    );
    consumer.subscribe(`${eventType}.${eventVersion}`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Dispatch the first batch
    const dispatcher = new OutboxDispatcher(db, broker, {
      tableName: 'outbox_events',
      maxRetries: 3,
    });

    const dispatchResult1 = await dispatcher.dispatchPending();
    // Should dispatch the first event since it's the oldest and no older events are pending
    assert.strictEqual(dispatchResult1.dispatched, 1);

    // Verify first event is dispatched and second is still pending (because second's dispatch depends on the first completing)
    // Actually, dispatcher processes the locked batch sequentially. If the dispatcher fetched the whole batch, it would dispatch both.
    // But let's verify if they arrive in the correct order.
    const dispatchResult2 = await dispatcher.dispatchPending();
    assert.strictEqual(dispatchResult2.dispatched, 1);

    let attempts = 0;
    while (receivedSteps.length < 2 && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      attempts++;
    }

    assert.strictEqual(receivedSteps.length, 2);
    assert.deepStrictEqual(receivedSteps, [1, 2]); // Order preserved!
  });

  test('E2E: Idempotency & Safe Redelivery', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const eventId = 'e2e-dup-id-1';
    const eventType = 'test.event.dup';
    const eventPayload = { val: 42 };

    const event = {
      eventId,
      eventType,
      tenantId,
      payload: eventPayload,
      deliveryAttempt: 1,
    };

    let executionCount = 0;
    const consumer = new IdempotentConsumer(
      db,
      broker,
      async () => {
        executionCount++;
      },
      {
        consumerGroup: 'test-dup-consumer-group',
        exchangeName: 'test.dms.events',
      }
    );

    // 1. Process the event the first time
    const result1 = await consumer.handle(event);
    assert.strictEqual(result1.status, 'processed');
    assert.strictEqual(executionCount, 1);

    // 2. Process the exact same event again (redelivery)
    const result2 = await consumer.handle(event);
    assert.strictEqual(result2.status, 'duplicate');
    assert.strictEqual(executionCount, 1); // Handler NOT run again!
  });

  test('E2E: Poison Messages & DLQ Routing', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const eventId = 'e2e-poison-id-1';
    const eventType = 'test.event.poison';
    const eventPayload = { badData: true };

    const event = {
      eventId,
      eventType,
      tenantId,
      payload: eventPayload,
    };

    const consumer = new IdempotentConsumer(
      db,
      broker,
      async () => {
        throw new Error('Poison message simulation - handler failed');
      },
      {
        consumerGroup: 'test-poison-consumer-group',
        exchangeName: 'test.dms.events',
        maxRetries: 3,
      }
    );

    // Set up queue listener to wait for DLQ capture
    const dlqQueue = `test-poison-consumer-group.${eventType}.dlq`;
    const dlqMessages: any[] = [];

    // Subscribing to DLQ directly via broker client
    await broker.subscribe(eventType, async (msg: any) => {
      dlqMessages.push(msg);
    }, {
      queueName: dlqQueue,
      exchangeName: 'test.dms.events.dlx',
    });

    // Run handle attempts
    // Attempt 1: Fail and throw
    await assert.rejects(async () => {
      await consumer.handle({ ...event, deliveryAttempt: 1 });
    }, /Poison message/);

    // Attempt 2: Fail and throw
    await assert.rejects(async () => {
      await consumer.handle({ ...event, deliveryAttempt: 2 });
    }, /Poison message/);

    // Attempt 3: Exceed maxRetries (3), route to DLQ
    const result = await consumer.handle({ ...event, deliveryAttempt: 3 });
    assert.strictEqual(result.status, 'dlq');
    assert.ok(result.error?.includes('Poison message'));

    // Wait for the message to be routed in RabbitMQ and received by our DLQ listener
    let attempts = 0;
    while (dlqMessages.length === 0 && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      attempts++;
    }

    assert.strictEqual(dlqMessages.length, 1);
    assert.strictEqual(dlqMessages[0].eventId, eventId);
    assert.ok(dlqMessages[0].lastError.includes('Poison message'));
  });
});
