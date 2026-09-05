import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, defer } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RoomEventType =
  | 'room.status_changed'
  | 'room.created'
  | 'room.updated'
  | 'room.deleted';

export interface RoomEventPayload {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  previousStatus?: RoomStatus;
  roomTypeId: string;
  roomTypeName?: string;
  roomTypeCode?: string;
  pricePerNight?: number;
  notes?: string | null;
  updatedAt?: Date | string;
}

export interface RoomEvent {
  type: RoomEventType;
  /** 'app' = phát ngay trong tiến trình, 'db-watcher' = phát hiện qua vòng quét CSDL */
  source: 'app' | 'db-watcher';
  room: RoomEventPayload;
  emittedAt: string;
}

const ROOM_EVENT_SELECT = {
  id: true,
  roomNumber: true,
  floor: true,
  status: true,
  notes: true,
  roomTypeId: true,
  createdAt: true,
  updatedAt: true,
  roomType: {
    select: {
      name: true,
      code: true,
      basePrice: true,
    },
  },
} as const;

/** Số bản ghi ghi nhớ để chống phát trùng giữa luồng app và vòng quét CSDL */
const MAX_REMEMBERED_KEYS = 500;

/**
 * Kênh sự kiện phòng dùng cho SSE (`GET /api/v1/rooms/stream`).
 *
 * Có 2 nguồn phát:
 * 1. Trong tiến trình (app): Mọi thao tác đổi trạng thái phòng (Check-in, Check-out,
 *    Dọn dẹp, Bảo trì, Đồng bộ) gọi trực tiếp `emitStatusChanged` -> đẩy tức thì (< 5ms).
 * 2. Vòng quét CSDL (db-watcher): Tự động bật khi có client lắng nghe và tắt khi hết client.
 *    Quét các phòng có `updatedAt` mới để bắt kịp thay đổi từ bên ngoài (seed, direct SQL, instance khác).
 */
@Injectable()
export class RoomEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(RoomEventsService.name);
  private readonly events$ = new Subject<RoomEvent>();

  /** Đặt ROOM_EVENTS_POLL_MS=0 để tắt hẳn vòng quét CSDL */
  private readonly pollIntervalMs = Math.max(
    0,
    Number(process.env.ROOM_EVENTS_POLL_MS ?? 15000) || 0,
  );

  /** Map lưu trạng thái gần nhất của phòng để phát hiện chuyển đổi trạng thái */
  private readonly lastKnownStatuses = new Map<string, RoomStatus>();

  /** Set lưu khóa deduplication: `${roomId}:${status}` */
  private readonly emittedDedupeKeys = new Set<string>();

  private watcher: NodeJS.Timeout | null = null;
  private listeners = 0;
  private isPolling = false;
  private watermark = new Date();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phát sự kiện thay đổi trạng thái phòng (Trống -> Đang ở -> Dọn dẹp -> ...)
   */
  emitStatusChanged(
    room: RoomEventPayload,
    source: RoomEvent['source'] = 'app',
  ) {
    const dedupeKey = `${room.id}:${room.status}`;
    if (source === 'db-watcher' && this.emittedDedupeKeys.has(dedupeKey)) {
      return; // đã được phát bởi nguồn app trong tiến trình
    }

    this.rememberDedupeKey(dedupeKey);
    const prev = room.previousStatus ?? this.lastKnownStatuses.get(room.id);
    this.lastKnownStatuses.set(room.id, room.status);

    this.publish('room.status_changed', { ...room, previousStatus: prev }, source);
  }

  /**
   * Phát sự kiện tạo phòng mới
   */
  emitCreated(room: RoomEventPayload, source: RoomEvent['source'] = 'app') {
    const dedupeKey = `created:${room.id}`;
    if (this.emittedDedupeKeys.has(dedupeKey)) return;
    this.rememberDedupeKey(dedupeKey);
    this.lastKnownStatuses.set(room.id, room.status);

    this.publish('room.created', room, source);
  }

  /**
   * Phát sự kiện cập nhật thông tin phòng (tiện ích, giá, loại phòng, ...)
   */
  emitUpdated(room: RoomEventPayload) {
    this.lastKnownStatuses.set(room.id, room.status);
    this.publish('room.updated', room, 'app');
  }

  /**
   * Phát sự kiện xóa phòng
   */
  emitDeleted(roomId: string, roomNumber: string) {
    this.lastKnownStatuses.delete(roomId);
    this.publish(
      'room.deleted',
      {
        id: roomId,
        roomNumber,
        floor: 0,
        status: RoomStatus.AVAILABLE,
        roomTypeId: '',
      },
      'app',
    );
  }

  /**
   * Luồng sự kiện cho SSE. Vòng quét CSDL tự bật khi có client đầu tiên
   * và tự tắt khi client cuối cùng ngắt kết nối.
   */
  stream(): Observable<RoomEvent> {
    return defer(() => {
      this.retainWatcher();
      return this.events$.asObservable();
    }).pipe(finalize(() => this.releaseWatcher()));
  }

  onModuleDestroy() {
    this.stopWatcher();
    this.events$.complete();
  }

  private publish(
    type: RoomEventType,
    room: RoomEventPayload,
    source: RoomEvent['source'],
  ) {
    this.events$.next({
      type,
      source,
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        previousStatus: room.previousStatus,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomTypeName,
        roomTypeCode: room.roomTypeCode,
        pricePerNight: room.pricePerNight,
        notes: room.notes ?? null,
        updatedAt: room.updatedAt || new Date().toISOString(),
      },
      emittedAt: new Date().toISOString(),
    });
  }

  private rememberDedupeKey(key: string) {
    this.emittedDedupeKeys.add(key);
    if (this.emittedDedupeKeys.size > MAX_REMEMBERED_KEYS) {
      const oldest = this.emittedDedupeKeys.values().next().value;
      if (oldest) this.emittedDedupeKeys.delete(oldest);
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
      void this.pollRoomChanges();
    }, this.pollIntervalMs);
    this.watcher.unref?.();
    this.logger.log(
      `📡 Bật theo dõi trạng thái phòng trong CSDL (mỗi ${this.pollIntervalMs}ms) cho luồng SSE`,
    );
  }

  private stopWatcher() {
    if (!this.watcher) return;
    clearInterval(this.watcher);
    this.watcher = null;
    this.logger.log('📴 Không còn client lắng nghe, tắt theo dõi trạng thái phòng');
  }

  private async pollRoomChanges() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const changedRooms = await this.prisma.room.findMany({
        where: { updatedAt: { gt: this.watermark } },
        select: ROOM_EVENT_SELECT,
        orderBy: { updatedAt: 'asc' },
        take: 50,
      });

      for (const r of changedRooms) {
        if (r.updatedAt > this.watermark) {
          this.watermark = r.updatedAt;
        }

        const payload: RoomEventPayload = {
          id: r.id,
          roomNumber: r.roomNumber,
          floor: r.floor,
          status: r.status,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomType?.name,
          roomTypeCode: r.roomType?.code,
          pricePerNight: r.roomType?.basePrice,
          notes: r.notes,
          updatedAt: r.updatedAt,
        };

        const prev = this.lastKnownStatuses.get(r.id);
        if (prev && prev !== r.status) {
          this.emitStatusChanged(payload, 'db-watcher');
        } else if (!prev) {
          this.lastKnownStatuses.set(r.id, r.status);
        }
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Không quét được cập nhật phòng: ${err.message}`);
    } finally {
      this.isPolling = false;
    }
  }
}
