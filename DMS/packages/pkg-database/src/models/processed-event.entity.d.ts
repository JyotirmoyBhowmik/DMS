/**
 * Processed-event entity for idempotent event consumers.
 *
 * Before processing an inbound event, the consumer checks this table.
 * If an entry exists for the (eventId, consumerGroup) pair, the event
 * has already been handled and can be skipped (exactly-once semantics).
 */
export interface ProcessedEvent {
    /** The unique event ID (from the CloudEvent envelope). */
    eventId: string;
    /** Timestamp of when this event was processed. */
    processedAt: Date;
    /** Identifies the consumer group (e.g. 'order-service', 'billing-service'). */
    consumerGroup: string;
}
export declare class ProcessedEventModel implements ProcessedEvent {
    eventId: string;
    processedAt: Date;
    consumerGroup: string;
}
//# sourceMappingURL=processed-event.entity.d.ts.map