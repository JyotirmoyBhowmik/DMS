/**
 * Deep-clone the object, then recursively walk all keys.
 * If any key matches a redacted field name (case-insensitive), replace value with '[REDACTED]'.
 * If any string value matches a redact pattern, mask it.
 */
export declare function redact(obj: unknown, opts?: {
    fields?: string[];
    patterns?: RegExp[];
}): unknown;
export declare class PiiRedactor {
    static redact(message: string): string;
    static redactObject<T>(obj: T): T;
}
//# sourceMappingURL=redactor.d.ts.map