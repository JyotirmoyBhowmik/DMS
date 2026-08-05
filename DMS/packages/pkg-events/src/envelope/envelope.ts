import { randomUUID } from 'node:crypto';

/**
 * Standard event envelope for all domain events in the DMS system.
 * Follows event-sourcing best practices with correlation/causation tracking.
 */
export interface EventEnvelope<T = unknown> {
  /** Unique event identifier (UUIDv7-style: timestamp-ordered) */
  eventId: string;
  /** Dot-delimited event type, e.g. 'order.placed' */
  type: string;
  /** Schema version, e.g. 'v1', 'v2' */
  version: string;
  /** ISO-8601 UTC timestamp when the event occurred */
  occurredAt: string;
  /** Tenant identifier for multi-tenancy isolation */
  tenantId: string;
  /** Correlation ID for tracing a request across services */
  correlationId: string;
  /** ID of the event that caused this event (event chain) */
  causationId?: string;
  /** Service/module that produced the event */
  producer: string;
  /** Key used for partitioning (e.g. Kafka partition key) */
  partitionKey: string;
  /** The domain event payload */
  payload: T;
}

/**
 * Context required for correlating events across a distributed transaction.
 */
export interface CorrelationContext {
  tenantId: string;
  correlationId: string;
  causationId?: string;
  producer: string;
  partitionKey: string;
}

/**
 * Generate a UUIDv7-style identifier.
 * Embeds a millisecond timestamp in the high bits for natural temporal ordering,
 * with random bits in the remaining positions.
 */
function uuidv7(): string {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');

  // Generate 16 random bytes and use them for the random portion
  const uuid = randomUUID();
  const parts = uuid.split('-');

  // Replace the first 12 hex chars (time_low + time_mid) with our timestamp
  // Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
  const timeLow = timeHex.slice(0, 8);
  const timeMid = timeHex.slice(8, 12);
  const timeHiAndVersion = '7' + (parts[2]?.slice(1) ?? '000');
  const clockSeq = parts[3] ?? '0000';
  const node = parts[4] ?? '000000000000';

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
}

/**
 * Create a fully-populated EventEnvelope for a domain event.
 */
export function makeEnvelope<T>(
  type: string,
  version: string,
  payload: T,
  ctx: CorrelationContext
): EventEnvelope<T> {
  return {
    eventId: uuidv7(),
    type,
    version,
    occurredAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    producer: ctx.producer,
    partitionKey: ctx.partitionKey,
    payload,
  };
}
