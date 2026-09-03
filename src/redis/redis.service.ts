import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

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
        this.logger.warn(`⚠️ Cảnh báo Redis: ${err.message}. Hệ thống sẽ tạm bỏ qua cache.`);
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(`⚠️ Chưa khởi động Redis server (${err.message}). Vui lòng chạy 'docker compose up -d redis'.`);
      });
    } catch (e: any) {
      this.logger.warn(`⚠️ Không thể kết nối Redis: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Lấy dữ liệu từ Cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err: any) {
      this.logger.warn(`Lỗi khi đọc Redis key ${key}: ${err.message}`);
      return null;
    }
  }

  /**
   * Lưu dữ liệu vào Cache kèm thời gian hết hạn (TTL)
   */
  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    if (!this.isReady || !this.client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi ghi Redis key ${key}: ${err.message}`);
    }
  }

  /**
   * Xóa một key trong Cache
   */
  async del(key: string): Promise<void> {
    if (!this.isReady || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Lỗi khi xóa Redis key ${key}: ${err.message}`);
    }
  }

  /**
   * Xóa danh sách key theo mẫu (pattern wildcard)
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isReady || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi xóa Redis pattern ${pattern}: ${err.message}`);
    }
  }

  /**
   * ==========================================
   * REDIS DISTRIBUTED LOCK (CHỐNG DOUBLE BOOKING)
   * ==========================================
   * Cố gắng chiếm Lock cho một tài nguyên (ví dụ: phòng khách sạn theo ngày)
   * @param resourceKey Key định danh tài nguyên cần khóa (vd: lock:room:101:2026-09-05)
   * @param ttlMs Thời gian giữ khóa tối đa tính bằng mili-giây (mặc định 5000ms)
   * @returns lockToken nếu chiếm khóa thành công, null nếu tài nguyên đang bị khóa bởi request khác
   */
  async acquireLock(resourceKey: string, ttlMs = 5000): Promise<string | null> {
    if (!this.isReady || !this.client) {
      // Fallback an toàn nếu chưa bật Redis
      return randomUUID();
    }
    try {
      const lockToken = randomUUID();
      // SET key token NX PX ttlMs
      const result = await this.client.set(resourceKey, lockToken, 'PX', ttlMs, 'NX');
      return result === 'OK' ? lockToken : null;
    } catch (err: any) {
      this.logger.warn(`Lỗi acquireLock cho ${resourceKey}: ${err.message}`);
      return randomUUID();
    }
  }

  /**
   * Giải phóng Distributed Lock bằng Lua Script an toàn
   * Đảm bảo chỉ người giữ token đúng mới có thể mở khóa
   */
  async releaseLock(resourceKey: string, lockToken: string): Promise<boolean> {
    if (!this.isReady || !this.client) return true;
    try {
      const result = await this.client.eval(
        this.RELEASE_LOCK_SCRIPT,
        1,
        resourceKey,
        lockToken,
      );
      return result === 1;
    } catch (err: any) {
      this.logger.warn(`Lỗi releaseLock cho ${resourceKey}: ${err.message}`);
      return false;
    }
  }
}
