export declare class PiiRedactor {
    private static readonly EMAIL_REGEX;
    private static readonly PHONE_REGEX;
    private static readonly CARD_REGEX;
    static redact(message: string): string;
    static redactObject<T>(obj: T): T;
}
//# sourceMappingURL=redactor.d.ts.map