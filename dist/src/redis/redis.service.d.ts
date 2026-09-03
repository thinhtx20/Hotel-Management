import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private client;
    private isConnected;
    private readonly RELEASE_LOCK_SCRIPT;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get isReady(): boolean;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    delByPattern(pattern: string): Promise<void>;
    acquireLock(resourceKey: string, ttlMs?: number): Promise<string | null>;
    releaseLock(resourceKey: string, lockToken: string): Promise<boolean>;
}
