export interface CacheOptions {
    key: string;
    ttlSeconds?: number;
}
export interface ICacheClient {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    clear(): Promise<void>;
}
export declare class InMemoryCacheClient implements ICacheClient {
    private cache;
    private logger;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=cache-client.d.ts.map