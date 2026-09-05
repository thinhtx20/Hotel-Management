import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { RequestServiceDto } from './dto/request-service.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-service-order-status.dto';
import { Role } from '@prisma/client';
export declare class BookingsService {
    private prisma;
    private redis;
    private esService;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, esService: ElasticsearchService);
    private reindexRoom;
    private syncRoomStatus;
    create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role): Promise<any>;
    private toBookingResponse;
    findAll(query?: QueryBookingsDto, viewerRole?: Role): Promise<{
        data: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    private assertOwnership;
    findOne(id: string, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    approve(id: string, dto?: ApproveBookingDto & ConfirmBookingDto, currentUserId?: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    confirm(id: string, dto?: ConfirmBookingDto, currentUserId?: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    reject(id: string, dto?: RejectBookingDto, currentUserId?: string): Promise<{
        message: string;
        booking: any;
    }>;
    checkIn(id: string): Promise<any>;
    checkOut(id: string, dto: CheckOutDto, cashierId: string): Promise<{
        message: string;
        invoiceId: string;
        booking: any;
        invoice: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
    }>;
    cancel(id: string, dto?: CancelBookingDto, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    addServiceOrder(id: string, dto: AddServiceOrderDto): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        bookingId: string;
        unitPrice: number;
        serviceName: string;
        quantity: number;
        note: string | null;
        totalPrice: number;
        requestedById: string | null;
    }>;
    changeRoom(id: string, dto: ChangeRoomDto): Promise<{
        message: string;
        booking: any;
    }>;
    requestServiceOrder(id: string, dto: RequestServiceDto, customerId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        bookingId: string;
        unitPrice: number;
        serviceName: string;
        quantity: number;
        note: string | null;
        totalPrice: number;
        requestedById: string | null;
    }>;
    updateServiceOrderStatus(bookingId: string, orderId: string, dto: UpdateServiceOrderStatusDto): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        bookingId: string;
        unitPrice: number;
        serviceName: string;
        quantity: number;
        note: string | null;
        totalPrice: number;
        requestedById: string | null;
    }>;
}
