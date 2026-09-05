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
    findAll(userId: string, userRole: Role, query: QueryBookingsDto): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
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
    checkoutPreview(id: string): Promise<{
        pendingPaymentRequests: {
            id: string;
            amount: number;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            reference: string;
            note: string;
            requestedAt: Date;
        }[];
        pendingPaymentAmount: number;
        roomAmount: number;
        servicesAmount: number;
        discount: number;
        taxRate: number;
        tax: number;
        finalAmount: number;
        depositAmount: number;
        alreadyPaidAmount: number;
        amountDue: number;
        serviceItems: any;
        bookingId: any;
        bookingCode: any;
        status: any;
        roomNumber: any;
        customerName: any;
        customerPhone: any;
        checkInDate: any;
        checkOutDate: any;
        actualCheckIn: any;
        invoiceId: any;
        invoiceCode: any;
    }>;
    checkOut(id: string, checkOutDto: CheckOutDto, cashierId: string): Promise<{
        message: string;
        invoiceId: string;
        amountCollected: number;
        remainingAmount: number;
        settlement: {
            roomAmount: number;
            servicesAmount: number;
            discount: number;
            taxRate: number;
            tax: number;
            finalAmount: number;
            depositAmount: number;
            alreadyPaidAmount: number;
            amountDue: number;
            serviceItems: any;
        };
        booking: any;
        invoice: {
            booking: {
                room: {
                    roomNumber: string;
                };
                serviceOrders: {
                    id: string;
                    status: string;
                    createdAt: Date;
                    bookingId: string;
                    unitPrice: number;
                    serviceName: string;
                    quantity: number;
                    note: string | null;
                    totalPrice: number;
                    requestedById: string | null;
                }[];
                customer: {
                    id: string;
                    email: string;
                    fullName: string;
                    phone: string;
                };
            } & {
                id: string;
                status: import(".prisma/client").$Enums.BookingStatus;
                createdAt: Date;
                updatedAt: Date;
                bookingCode: string;
                checkInDate: Date;
                checkOutDate: Date;
                actualCheckIn: Date | null;
                actualCheckOut: Date | null;
                guestCount: number;
                totalAmount: number;
                depositAmount: number;
                specialRequests: string | null;
                confirmedAt: Date | null;
                confirmationNote: string | null;
                cancellationReason: string | null;
                cancelledAt: Date | null;
                customerId: string;
                roomId: string;
                confirmedById: string | null;
                cancelledById: string | null;
            };
            issuedBy: {
                email: string;
                fullName: string;
                role: import(".prisma/client").$Enums.Role;
            };
            payments: ({
                confirmedBy: {
                    id: string;
                    fullName: string;
                    role: import(".prisma/client").$Enums.Role;
                };
                createdBy: {
                    id: string;
                    fullName: string;
                    role: import(".prisma/client").$Enums.Role;
                };
            } & {
                id: string;
                status: import(".prisma/client").$Enums.PaymentEntryStatus;
                createdAt: Date;
                updatedAt: Date;
                confirmedAt: Date | null;
                confirmedById: string | null;
                type: import(".prisma/client").$Enums.PaymentEntryType;
                method: import(".prisma/client").$Enums.PaymentMethod;
                note: string | null;
                amount: number;
                reference: string | null;
                invoiceId: string;
                createdById: string | null;
                rejectedReason: string | null;
            })[];
        } & {
            id: string;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            invoiceCode: string;
            roomAmount: number;
            servicesAmount: number;
            discount: number;
            tax: number;
            finalAmount: number;
            paidAmount: number;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            paidAt: Date | null;
            bookingId: string;
            issuedById: string | null;
        };
    }>;
    cancel(id: string, dto: CancelBookingDto, userId: string, userRole: Role): Promise<any>;
    cancelPatch(id: string, dto: CancelBookingDto, userId: string, userRole: Role): Promise<any>;
    addServiceOrder(id: string, dto: AddServiceOrderDto): Promise<{
        id: string;
        status: string;
        createdAt: Date;
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
        status: string;
        createdAt: Date;
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
        status: string;
        createdAt: Date;
        bookingId: string;
        unitPrice: number;
        serviceName: string;
        quantity: number;
        note: string | null;
        totalPrice: number;
        requestedById: string | null;
    }>;
}
