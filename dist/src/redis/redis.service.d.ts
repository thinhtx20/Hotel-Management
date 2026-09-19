import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private client;
    private isConnected;
    private readonly memoryCache;
    private readonly memoryLocks;
    private cleanupInterval;
    private readonly RELEASE_LOCK_SCRIPT;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get isReady(): boolean;
    private purgeExpiredMemory;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    delByPattern(pattern: string): Promise<void>;
    remember<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;
    acquireLock(resourceKey: string, ttlMs?: number): Promise<string | null>;
    releaseLock(resourceKey: string, lockToken: string): Promise<boolean>;
}
