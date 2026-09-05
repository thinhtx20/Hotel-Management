import { BookingsService } from './bookings.service';
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
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    create(createBookingDto: CreateBookingDto, userId: string, userRole: Role): Promise<any>;
    findAll(userId: string, userRole: Role, query: QueryBookingsDto): Promise<{
        data: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(id: string, userId: string, userRole: Role): Promise<any>;
    approve(id: string, dto: ApproveBookingDto, receptionistId: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    approvePost(id: string, dto: ApproveBookingDto, receptionistId: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    confirm(id: string, dto: ConfirmBookingDto, receptionistId: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    confirmPost(id: string, dto: ConfirmBookingDto, receptionistId: string): Promise<{
        message: string;
        depositAmount: number;
        booking: any;
    }>;
    reject(id: string, dto: RejectBookingDto, receptionistId: string): Promise<{
        message: string;
        booking: any;
    }>;
    rejectPost(id: string, dto: RejectBookingDto, receptionistId: string): Promise<{
        message: string;
        booking: any;
    }>;
    checkIn(id: string): Promise<any>;
    checkOut(id: string, checkOutDto: CheckOutDto, cashierId: string): Promise<{
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
    cancel(id: string, dto: CancelBookingDto, userId: string, userRole: Role): Promise<any>;
    cancelPatch(id: string, dto: CancelBookingDto, userId: string, userRole: Role): Promise<any>;
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
    requestService(id: string, dto: RequestServiceDto, customerId: string): Promise<{
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
    updateServiceStatus(id: string, orderId: string, dto: UpdateServiceOrderStatusDto): Promise<{
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
