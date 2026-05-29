import { EventEnvelope } from '../envelope/envelope';

export class JsonEventCodec {
  static encode<T>(envelope: EventEnvelope<T>): string {
    return JSON.stringify(envelope);
  }

  static decode<T = any>(rawJson: string): EventEnvelope<T> {
    const parsed = JSON.parse(rawJson);
    if (!parsed.id || !parsed.source || !parsed.type || !parsed.time) {
      throw new Error('Invalid CloudEvent structure');
    }
    return parsed as EventEnvelope<T>;
  }
}
