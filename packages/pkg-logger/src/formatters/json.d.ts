export declare class StructuredLogger {
    private serviceName;
    constructor(serviceName: string);
    private log;
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
}
//# sourceMappingURL=json.d.ts.map