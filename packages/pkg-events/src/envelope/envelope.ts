import { randomUUID } from 'crypto';

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

export class CloudEventBuilder {
  static build<T>({
    source,
    type,
    subject,
    data,
    correlationId,
    tenantId,
  }: {
    source: string;
    type: string;
    subject: string;
    data: T;
    correlationId?: string;
    tenantId?: string;
  }): EventEnvelope<T> {
    return {
      id: randomUUID(),
      source,
      specversion: '1.0',
      type,
      datacontenttype: 'application/json',
      subject,
      time: new Date().toISOString(),
      data,
      correlationId,
      tenantId,
    };
  }
}
