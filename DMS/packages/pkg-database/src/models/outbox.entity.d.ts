/**
 * Outbox entity for the Transactional Outbox pattern.
 *
 * Domain services write events to this table inside the same
 * database transaction as the aggregate mutation.  A separate
 * relay process polls `publishedAt IS NULL` rows and publishes
 * them to the message broker, then stamps `publishedAt`.
 */
export interface OutboxEntry {
    /** Primary key – UUID v4. */
    id: string;
    /** The aggregate type that produced this event (e.g. 'Order'). */
    aggregateType: string;
    /** The aggregate root ID that the event pertains to. */
    aggregateId: string;
    /** CloudEvents-style event type (e.g. 'order.placed.v1'). */
    eventType: string;
    /** JSON-serialised event payload. */
    payload: string;
    /** When the outbox row was created. */
    createdAt: Date;
    /** When the relay published this event.  NULL = not yet published. */
    publishedAt: Date | null;
}
export declare class OutboxEntryModel implements OutboxEntry {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: string;
    createdAt: Date;
    publishedAt: Date | null;
}
//# sourceMappingURL=outbox.entity.d.ts.map