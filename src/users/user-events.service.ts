import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, defer } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type UserEventType = 'user.created' | 'user.updated' | 'user.deactivated';

/** Thông tin tài khoản gửi kèm sự kiện (không bao giờ chứa mật khẩu) */
export interface UserEventPayload {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatar?: string | null;
  role: Role;
  isActive?: boolean;
  createdAt?: Date | string;
}

export interface UserEvent {
  type: UserEventType;
  /** 'app' = phát ngay trong tiến trình, 'db-watcher' = phát hiện qua vòng quét CSDL */
  source: 'app' | 'db-watcher';
  user: UserEventPayload;
  emittedAt: string;
}

const USER_EVENT_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

/** Số id tài khoản ghi nhớ để chống phát trùng giữa luồng app và vòng quét CSDL */
const MAX_REMEMBERED_IDS = 500;

/**
 * Kênh sự kiện tài khoản dùng cho SSE (`GET /api/v1/users/stream`).
 *
 * Có 2 nguồn phát:
 * 1. Trong tiến trình: mọi nơi tạo / sửa / khóa tài khoản gọi trực tiếp `emit*` → đẩy tức thì.
 * 2. Vòng quét CSDL: chỉ chạy khi đang có client lắng nghe, bắt các tài khoản mới sinh ra
 *    ngoài tiến trình này (deploy nhiều instance, seed, thao tác thẳng vào CSDL).
 */
@Injectable()
export class UserEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(UserEventsService.name);
  private readonly events$ = new Subject<UserEvent>();

  /** Đặt USER_EVENTS_POLL_MS=0 để tắt hẳn vòng quét CSDL */
  private readonly pollIntervalMs = Math.max(
    0,
    Number(process.env.USER_EVENTS_POLL_MS ?? 15000) || 0,
  );

  private readonly emittedUserIds = new Set<string>();
  private watcher: NodeJS.Timeout | null = null;
  private listeners = 0;
  private isPolling = false;
  private watermark = new Date();

  constructor(private readonly prisma: PrismaService) {}

  /** Có tài khoản mới (đăng ký công khai hoặc admin cấp tài khoản nhân viên) */
  emitCreated(user: UserEventPayload, source: UserEvent['source'] = 'app') {
    if (this.emittedUserIds.has(user.id)) return; // đã phát bởi nguồn còn lại
    this.rememberUserId(user.id);
    this.publish('user.created', user, source);
  }

  /** Tài khoản được cập nhật thông tin / đổi vai trò */
  emitUpdated(user: UserEventPayload) {
    this.publish('user.updated', user, 'app');
  }

  /** Tài khoản bị vô hiệu hóa (isActive = false) */
  emitDeactivated(user: UserEventPayload) {
    this.publish('user.deactivated', user, 'app');
  }

  /**
   * Luồng sự kiện cho SSE. Vòng quét CSDL tự bật khi có client đầu tiên
   * và tự tắt khi client cuối cùng ngắt kết nối.
   */
  stream(): Observable<UserEvent> {
    return defer(() => {
      this.retainWatcher();
      return this.events$.asObservable();
    }).pipe(finalize(() => this.releaseWatcher()));
  }

  onModuleDestroy() {
    this.stopWatcher();
    this.events$.complete();
  }

  private publish(type: UserEventType, user: UserEventPayload, source: UserEvent['source']) {
    this.events$.next({
      type,
      source,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
        isActive: user.isActive ?? true,
        createdAt: user.createdAt,
      },
      emittedAt: new Date().toISOString(),
    });
  }

  private rememberUserId(id: string) {
    this.emittedUserIds.add(id);
    if (this.emittedUserIds.size > MAX_REMEMBERED_IDS) {
      // Set giữ thứ tự chèn → xóa id cũ nhất
      const oldest = this.emittedUserIds.values().next().value;
      if (oldest) this.emittedUserIds.delete(oldest);
    }
  }

  private retainWatcher() {
    this.listeners++;
    if (this.listeners === 1) this.startWatcher();
  }

  private releaseWatcher() {
    this.listeners = Math.max(0, this.listeners - 1);
    if (this.listeners === 0) this.stopWatcher();
  }

  private startWatcher() {
    if (this.watcher || this.pollIntervalMs <= 0) return;
    this.watermark = new Date();
    this.watcher = setInterval(() => {
      void this.pollNewUsers();
    }, this.pollIntervalMs);
    this.watcher.unref?.();
    this.logger.log(
      `📡 Bật theo dõi tài khoản mới trong CSDL (mỗi ${this.pollIntervalMs}ms) cho luồng SSE`,
    );
  }

  private stopWatcher() {
    if (!this.watcher) return;
    clearInterval(this.watcher);
    this.watcher = null;
    this.logger.log('📴 Không còn client lắng nghe, tắt theo dõi tài khoản mới');
  }

  private async pollNewUsers() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const users = await this.prisma.user.findMany({
        where: { createdAt: { gt: this.watermark } },
        select: USER_EVENT_SELECT,
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const user of users) {
        if (user.createdAt > this.watermark) {
          this.watermark = user.createdAt;
        }
        this.emitCreated(user, 'db-watcher');
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Không quét được tài khoản mới: ${err.message}`);
    } finally {
      this.isPolling = false;
    }
  }
}
