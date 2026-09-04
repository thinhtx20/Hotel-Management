import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { BookingStatus, Role } from '@prisma/client';
export declare class BookingsService {
    private prisma;
    private redis;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService);
    create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role): Promise<any>;
    private toBookingResponse;
    findAll(status?: BookingStatus, customerId?: string, roomId?: string): Promise<any[]>;
    private assertOwnership;
    findOne(id: string, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    approve(id: string, dto?: ApproveBookingDto, currentUserId?: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    reject(id: string, dto?: RejectBookingDto, currentUserId?: string): Promise<{
        message: string;
        booking: any;
    }>;
    checkIn(id: string): Promise<{
        room: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    checkOut(id: string, dto: CheckOutDto, cashierId: string): Promise<{
        message: string;
        invoiceId: string;
        booking: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.BookingStatus;
            bookingCode: string;
            checkInDate: Date;
            checkOutDate: Date;
            actualCheckIn: Date | null;
            actualCheckOut: Date | null;
            guestCount: number;
            totalAmount: number;
            depositAmount: number;
            specialRequests: string | null;
            customerId: string;
            roomId: string;
        };
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
    cancel(id: string, currentUserId?: string, currentUserRole?: Role): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    addServiceOrder(id: string, dto: AddServiceOrderDto): Promise<{
        id: string;
        createdAt: Date;
        bookingId: string;
        serviceName: string;
        unitPrice: number;
        quantity: number;
        totalPrice: number;
    }>;
}
