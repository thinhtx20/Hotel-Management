import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

interface MemoryCacheEntry {
  value: any;
  expiresAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // Bộ nhớ đệm Memory Fallback khi Redis không khả dụng
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();
  // Bộ nhớ giữ khóa (Distributed Lock fallback) trong bộ nhớ
  private readonly memoryLocks = new Map<string, { token: string; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Lua script an toàn để giải phóng distributed lock
  private readonly RELEASE_LOCK_SCRIPT = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;

  async onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    // Thiết lập dọn dẹp bộ nhớ đệm in-memory định kỳ mỗi 60 giây
    this.cleanupInterval = setInterval(() => this.purgeExpiredMemory(), 60000);

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) return null; // Ngừng retry nếu không có Redis server
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
    } catch (e: any) {
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

  get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  private purgeExpiredMemory() {
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

  /**
   * Lấy dữ liệu từ Cache (Redis hoặc In-Memory Fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isReady && this.client) {
      try {
        const data = await this.client.get(key);
        if (data) {
          try {
            return JSON.parse(data);
          } catch {
            return data as unknown as T;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi đọc Redis key ${key}: ${err.message}`);
      }
    }

    // Fallback sang Memory Cache
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        return entry.value as T;
      }
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Lưu dữ liệu vào Cache kèm thời gian hết hạn (TTL)
   */
  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Lưu Memory Cache trước
    this.memoryCache.set(key, { value, expiresAt });

    // Giới hạn bộ nhớ tránh tràn: nếu quá 5000 items, dọn dẹp các key hết hạn
    if (this.memoryCache.size > 5000) {
      this.purgeExpiredMemory();
    }

    if (this.isReady && this.client) {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.client.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi ghi Redis key ${key}: ${err.message}`);
      }
    }
  }

  /**
   * Xóa một key trong Cache
   */
  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.isReady && this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        this.logger.warn(`Lỗi khi xóa Redis key ${key}: ${err.message}`);
      }
    }
  }

  /**
   * Xóa danh sách key theo mẫu (pattern wildcard)
   */
  async delByPattern(pattern: string): Promise<void> {
    // Xóa trong Memory Cache
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
      } catch (err: any) {
        this.logger.warn(`Lỗi khi xóa Redis pattern ${pattern}: ${err.message}`);
      }
    }
  }

  /**
   * Helper thông minh: đọc cache nếu có, nếu chưa có thì gọi fetcher và cache lại
   */
  async remember<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  /**
   * ==========================================
   * DISTRIBUTED LOCK (CHỐNG DOUBLE BOOKING)
   * ==========================================
   */
  async acquireLock(resourceKey: string, ttlMs = 5000): Promise<string | null> {
    const lockToken = randomUUID();
    const now = Date.now();

    // Nếu có Redis, dùng SET NX PX chuẩn
    if (this.isReady && this.client) {
      try {
        const result = await this.client.set(resourceKey, lockToken, 'PX', ttlMs, 'NX');
        return result === 'OK' ? lockToken : null;
      } catch (err: any) {
        this.logger.warn(`Lỗi acquireLock Redis cho ${resourceKey}: ${err.message}`);
      }
    }

    // Fallback an toàn với Memory Lock
    const existing = this.memoryLocks.get(resourceKey);
    if (existing && existing.expiresAt > now) {
      return null; // Đang bị khóa
    }

    this.memoryLocks.set(resourceKey, { token: lockToken, expiresAt: now + ttlMs });
    return lockToken;
  }

  async releaseLock(resourceKey: string, lockToken: string): Promise<boolean> {
    // Memory Lock release
    const existing = this.memoryLocks.get(resourceKey);
    if (existing && existing.token === lockToken) {
      this.memoryLocks.delete(resourceKey);
    }

    if (this.isReady && this.client) {
      try {
        const result = await this.client.eval(
          this.RELEASE_LOCK_SCRIPT,
          1,
          resourceKey,
          lockToken,
        );
        return result === 1;
      } catch (err: any) {
        this.logger.warn(`Lỗi releaseLock Redis cho ${resourceKey}: ${err.message}`);
        return false;
      }
    }

    return true;
  }
}
