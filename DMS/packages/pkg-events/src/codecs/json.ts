import { EventEnvelope } from '../envelope/envelope.js';

export class JsonEventCodec {
  static encode<T>(envelope: EventEnvelope<T>): string {
    return JSON.stringify(envelope);
  }

  static decode<T = any>(rawJson: string): EventEnvelope<T> {
    const parsed = JSON.parse(rawJson);

    // Support both CloudEvent schema (id, source, time) and DMS EventEnvelope schema (eventId, producer, occurredAt)
    const eventId = parsed.eventId || parsed.id;
    const type = parsed.type;
    const version = parsed.version || parsed.specversion || 'v1';
    const occurredAt = parsed.occurredAt || parsed.time;
    const tenantId = parsed.tenantId || '';
    const correlationId = parsed.correlationId || '';
    const causationId = parsed.causationId;
    const producer = parsed.producer || parsed.source;
    const partitionKey = parsed.partitionKey || '';
    const payload = parsed.payload !== undefined ? parsed.payload : parsed.data;

    if (!eventId || !type || !occurredAt || !producer || payload === undefined) {
      throw new Error('Invalid EventEnvelope or CloudEvent structure');
    }

    return {
      eventId,
      type,
      version,
      occurredAt,
      tenantId,
      correlationId,
      causationId,
      producer,
      partitionKey,
      payload,
    };
  }
}
