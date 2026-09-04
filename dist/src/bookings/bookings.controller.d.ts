import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { ApproveBookingDto, RejectBookingDto } from './dto/approve-booking.dto';
import { BookingStatus, Role } from '@prisma/client';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    create(createBookingDto: CreateBookingDto, userId: string, userRole: Role): Promise<any>;
    findAll(userId: string, userRole: Role, status?: BookingStatus, customerId?: string, roomId?: string): Promise<any[]>;
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
    reject(id: string, dto: RejectBookingDto, receptionistId: string): Promise<{
        message: string;
        booking: any;
    }>;
    rejectPost(id: string, dto: RejectBookingDto, receptionistId: string): Promise<{
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
    checkOut(id: string, checkOutDto: CheckOutDto, cashierId: string): Promise<{
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
    cancel(id: string, userId: string, userRole: Role): Promise<{
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
    cancelPatch(id: string, userId: string, userRole: Role): Promise<{
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
