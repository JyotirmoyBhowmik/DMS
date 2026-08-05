import { test, describe } from 'node:test';
import assert from 'node:assert';
import { makeEnvelope, CorrelationContext } from './envelope/envelope.js';
import { JsonEventCodec } from './codecs/json.js';
import { ProtobufEventCodec } from './codecs/protobuf.js';
import { AvroEventCodec } from './codecs/avro.js';
import { OrderPlacedV1Schema, OrderPlacedV1Payload } from './schemas/order/order.placed.v1.js';
import { OrderPlacedV2Schema, OrderPlacedV2Payload } from './schemas/order/order.placed.v2.js';
import { VisitCompletedV1Schema } from './schemas/visit/visit.completed.v1.js';
import { DeliveryCompletedV1Schema } from './schemas/delivery/delivery.completed.v1.js';

describe('Event System Tests', () => {
  const ctx: CorrelationContext = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    correlationId: 'corr-12345',
    causationId: 'caus-98765',
    producer: 'test-service',
    partitionKey: 'part-key-1',
  };

  const dummyPayload: OrderPlacedV1Payload = {
    orderId: '00000000-0000-0000-0000-000000000002',
    outletId: '00000000-0000-0000-0000-000000000003',
    distributorId: '00000000-0000-0000-0000-000000000004',
    agentId: '00000000-0000-0000-0000-000000000005',
    orderDate: new Date().toISOString(),
    totalAmount: 15000, // INR 150.00
    currency: 'INR',
    items: [
      {
        skuId: '00000000-0000-0000-0000-000000000006',
        productName: 'Sunflower Oil 1L',
        quantity: 2,
        unitPrice: 7500,
        totalPrice: 15000,
        currency: 'INR',
      },
    ],
  };

  test('should create valid EventEnvelope with UUIDv7 format eventId', () => {
    const envelope = makeEnvelope('order.placed', 'v1', dummyPayload, ctx);

    assert.ok(envelope.eventId);
    assert.strictEqual(envelope.type, 'order.placed');
    assert.strictEqual(envelope.version, 'v1');
    assert.strictEqual(envelope.tenantId, ctx.tenantId);
    assert.strictEqual(envelope.correlationId, ctx.correlationId);
    assert.strictEqual(envelope.causationId, ctx.causationId);
    assert.strictEqual(envelope.producer, ctx.producer);
    assert.strictEqual(envelope.partitionKey, ctx.partitionKey);
    assert.deepStrictEqual(envelope.payload, dummyPayload);

    // Verify UUIDv7 version is 7
    const parts = envelope.eventId.split('-');
    assert.strictEqual(parts.length, 5);
    assert.strictEqual(parts[2]?.[0], '7'); // version is encoded in the 13th character (first char of 3rd group)
  });

  test('should sort UUIDv7 events temporally', async () => {
    const id1 = makeEnvelope('test', 'v1', {}, ctx).eventId;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = makeEnvelope('test', 'v1', {}, ctx).eventId;

    // Temporal order comparison
    assert.ok(id1 < id2);
  });

  test('JsonEventCodec roundtrip', () => {
    const envelope = makeEnvelope('order.placed', 'v1', dummyPayload, ctx);
    const jsonStr = JsonEventCodec.encode(envelope);
    const decoded = JsonEventCodec.decode<OrderPlacedV1Payload>(jsonStr);

    assert.deepStrictEqual(decoded, envelope);
  });

  test('JsonEventCodec CloudEvent mapping support', () => {
    const cloudevent = {
      id: 'ce-id-123',
      source: 'ce-source',
      specversion: '1.0',
      type: 'ce.type',
      time: new Date().toISOString(),
      data: { hello: 'world' },
      tenantId: 'ce-tenant',
      correlationId: 'ce-corr',
    };

    const decoded = JsonEventCodec.decode<any>(JSON.stringify(cloudevent));
    assert.strictEqual(decoded.eventId, 'ce-id-123');
    assert.strictEqual(decoded.producer, 'ce-source');
    assert.strictEqual(decoded.occurredAt, cloudevent.time);
    assert.strictEqual(decoded.type, 'ce.type');
    assert.deepStrictEqual(decoded.payload, { hello: 'world' });
    assert.strictEqual(decoded.tenantId, 'ce-tenant');
    assert.strictEqual(decoded.correlationId, 'ce-corr');
  });

  test('ProtobufEventCodec roundtrip', () => {
    const envelope = makeEnvelope('order.placed', 'v1', dummyPayload, ctx);
    const buffer = ProtobufEventCodec.encode(envelope);
    const decoded = ProtobufEventCodec.decode<OrderPlacedV1Payload>(buffer);

    assert.deepStrictEqual(decoded, envelope);
  });

  test('AvroEventCodec roundtrip with and without causationId', () => {
    // 1. With causationId
    const envelope = makeEnvelope('order.placed', 'v1', dummyPayload, ctx);
    const buffer = AvroEventCodec.encode(envelope);
    const decoded = AvroEventCodec.decode<OrderPlacedV1Payload>(buffer);
    assert.deepStrictEqual(decoded, envelope);

    // 2. Without causationId
    const ctxNoCausation = { ...ctx, causationId: undefined };
    const envelopeNoCausation = makeEnvelope('order.placed', 'v1', dummyPayload, ctxNoCausation);
    const bufferNoCausation = AvroEventCodec.encode(envelopeNoCausation);
    const decodedNoCausation = AvroEventCodec.decode<OrderPlacedV1Payload>(bufferNoCausation);
    assert.deepStrictEqual(decodedNoCausation, envelopeNoCausation);
  });

  test('OrderPlacedV1Schema schema validation success', () => {
    const result = OrderPlacedV1Schema.safeParse(dummyPayload);
    assert.strictEqual(result.success, true);
  });

  test('OrderPlacedV2Schema schema validation success', () => {
    const v2Payload: OrderPlacedV2Payload = {
      orderId: '00000000-0000-0000-0000-000000000002',
      outletId: '00000000-0000-0000-0000-000000000003',
      distributorId: '00000000-0000-0000-0000-000000000004',
      agentId: '00000000-0000-0000-0000-000000000005',
      orderDate: new Date().toISOString(),
      subtotal: 15000,
      totalDiscount: 1000,
      totalTax: 750,
      grandTotal: 14750,
      currency: 'INR',
      items: [
        {
          skuId: '00000000-0000-0000-0000-000000000006',
          productName: 'Sunflower Oil 1L',
          quantity: 2,
          unitPrice: 7500,
          discountAmount: 1000,
          taxAmount: 750,
          totalPrice: 14750,
          currency: 'INR',
        },
      ],
    };

    const result = OrderPlacedV2Schema.safeParse(v2Payload);
    assert.strictEqual(result.success, true);
  });

  test('VisitCompletedV1Schema schema validation success', () => {
    const visitPayload = {
      visitId: '00000000-0000-0000-0000-000000000010',
      agentId: '00000000-0000-0000-0000-000000000012',
      outletId: '00000000-0000-0000-0000-000000000011',
      checkInTime: new Date().toISOString(),
      checkOutTime: new Date().toISOString(),
      checkInLocation: {
        lat: 12.9716,
        lng: 77.5946,
      },
      checkOutLocation: {
        lat: 12.9717,
        lng: 77.5947,
      },
      distanceFromOutlet: 15.5,
      ordersPlaced: 1,
      visitOutcome: 'productive' as const,
    };

    const result = VisitCompletedV1Schema.safeParse(visitPayload);
    assert.strictEqual(result.success, true);
  });

  test('DeliveryCompletedV1Schema schema validation success', () => {
    const deliveryPayload = {
      deliveryId: '00000000-0000-0000-0000-000000000020',
      orderId: '00000000-0000-0000-0000-000000000021',
      outletId: '00000000-0000-0000-0000-000000000023',
      distributorId: '00000000-0000-0000-0000-000000000022',
      deliveredBy: '00000000-0000-0000-0000-000000000024',
      deliveredAt: new Date().toISOString(),
      receivedBy: 'Ram Singh',
      items: [
        {
          skuId: '00000000-0000-0000-0000-000000000025',
          orderedQuantity: 5,
          deliveredQuantity: 5,
          shortageQuantity: 0,
        }
      ],
    };

    const result = DeliveryCompletedV1Schema.safeParse(deliveryPayload);
    assert.strictEqual(result.success, true);
  });
});
