import { EventEnvelope } from '../envelope/envelope';
export declare class JsonEventCodec {
    static encode<T>(envelope: EventEnvelope<T>): string;
    static decode<T = any>(rawJson: string): EventEnvelope<T>;
}
//# sourceMappingURL=json.d.ts.map