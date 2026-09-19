"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const crypto_1 = require("crypto");
let RedisService = RedisService_1 = class RedisService {
    constructor() {
        this.logger = new common_1.Logger(RedisService_1.name);
        this.client = null;
        this.isConnected = false;
        this.memoryCache = new Map();
        this.memoryLocks = new Map();
        this.cleanupInterval = null;
        this.RELEASE_LOCK_SCRIPT = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
    }
    async onModuleInit() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = Number(process.env.REDIS_PORT) || 6379;
        const password = process.env.REDIS_PASSWORD || undefined;
        this.cleanupInterval = setInterval(() => this.purgeExpiredMemory(), 60000);
        try {
            this.client = new ioredis_1.default({
                host,
                port,
                password: password || undefined,
                maxRetriesPerRequest: 1,
                retryStrategy(times) {
                    if (times > 3)
                        return null;
                    return Math.min(times * 100, 1000);
                },
                lazyConnect: true,
            });
            this.client.on('connect', () => {
                this.isConnected = true;
                this.logger.log(`✅ Kết nối Redis thành công tại ${host}:${port}`);
            });
            this.client.on('error', (err) => {
                this.isConnected = false;
                this.logger.warn(`⚠️ Cảnh báo Redis: ${err.message}. Hệ thống chuyển sang In-Memory Cache.`);
            });
            await this.client.connect().catch((err) => {
                this.logger.warn(`⚠️ Chưa khởi động Redis server (${err.message}). Hệ thống sử dụng In-Memory Cache fallback.`);
            });
        }
        catch (e) {
            this.logger.warn(`⚠️ Không thể kết nối Redis: ${e.message}. Sử dụng In-Memory Cache.`);
        }
    }
    async onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.client) {
            await this.client.quit();
        }
    }
    get isReady() {
        return this.isConnected && this.client !== null;
    }
    purgeExpiredMemory() {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.expiresAt <= now) {
                this.memoryCache.delete(key);
            }
        }
        for (const [key, lock] of this.memoryLocks.entries()) {
            if (lock.expiresAt <= now) {
                this.memoryLocks.delete(key);
            }
        }
    }
    async get(key) {
        if (this.isReady && this.client) {
            try {
                const data = await this.client.get(key);
                if (data) {
                    try {
                        return JSON.parse(data);
                    }
                    catch {
                        return data;
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Lỗi khi đọc Redis key ${key}: ${err.message}`);
            }
        }
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (entry.expiresAt > Date.now()) {
                return entry.value;
            }
            this.memoryCache.delete(key);
        }
        return null;
    }
    async set(key, value, ttlSeconds = 60) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        this.memoryCache.set(key, { value, expiresAt });
        if (this.memoryCache.size > 5000) {
            this.purgeExpiredMemory();
        }
        if (this.isReady && this.client) {
            try {
                const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                if (ttlSeconds > 0) {
                    await this.client.set(key, serialized, 'EX', ttlSeconds);
                }
                else {
                    await this.client.set(key, serialized);
                }
            }
            catch (err) {
                this.logger.warn(`Lỗi khi ghi Redis key ${key}: ${err.message}`);
            }
        }
    }
    async del(key) {
        this.memoryCache.delete(key);
        if (this.isReady && this.client) {
            try {
                await this.client.del(key);
            }
            catch (err) {
                this.logger.warn(`Lỗi khi xóa Redis key ${key}: ${err.message}`);
            }
        }
    }
    async delByPattern(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
            }
        }
        if (this.isReady && this.client) {
            try {
                const keys = await this.client.keys(pattern);
                if (keys.length > 0) {
                    await this.client.del(...keys);
                }
            }
            catch (err) {
                this.logger.warn(`Lỗi khi xóa Redis pattern ${pattern}: ${err.message}`);
            }
        }
    }
    async remember(key, ttlSeconds, fetcher) {
        const cached = await this.get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) {
            await this.set(key, fresh, ttlSeconds);
        }
        return fresh;
    }
    async acquireLock(resourceKey, ttlMs = 5000) {
        const lockToken = (0, crypto_1.randomUUID)();
        const now = Date.now();
        if (this.isReady && this.client) {
            try {
                const result = await this.client.set(resourceKey, lockToken, 'PX', ttlMs, 'NX');
                return result === 'OK' ? lockToken : null;
            }
            catch (err) {
                this.logger.warn(`Lỗi acquireLock Redis cho ${resourceKey}: ${err.message}`);
            }
        }
        const existing = this.memoryLocks.get(resourceKey);
        if (existing && existing.expiresAt > now) {
            return null;
        }
        this.memoryLocks.set(resourceKey, { token: lockToken, expiresAt: now + ttlMs });
        return lockToken;
    }
    async releaseLock(resourceKey, lockToken) {
        const existing = this.memoryLocks.get(resourceKey);
        if (existing && existing.token === lockToken) {
            this.memoryLocks.delete(resourceKey);
        }
        if (this.isReady && this.client) {
            try {
                const result = await this.client.eval(this.RELEASE_LOCK_SCRIPT, 1, resourceKey, lockToken);
                return result === 1;
            }
            catch (err) {
                this.logger.warn(`Lỗi releaseLock Redis cho ${resourceKey}: ${err.message}`);
                return false;
            }
        }
        return true;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map