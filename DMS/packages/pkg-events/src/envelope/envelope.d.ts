export interface EventEnvelope<T = any> {
    id: string;
    source: string;
    specversion: string;
    type: string;
    datacontenttype: string;
    subject: string;
    time: string;
    data: T;
    correlationId?: string;
    tenantId?: string;
}
export declare class CloudEventBuilder {
    static build<T>({ source, type, subject, data, correlationId, tenantId, }: {
        source: string;
        type: string;
        subject: string;
        data: T;
        correlationId?: string;
        tenantId?: string;
    }): EventEnvelope<T>;
}
//# sourceMappingURL=envelope.d.ts.map