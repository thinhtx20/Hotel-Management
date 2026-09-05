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
import { RoomEventsService } from '../rooms/room-events.service';
import { InvoicesService } from '../invoices/invoices.service';
export declare class BookingsService {
    private prisma;
    private redis;
    private esService;
    private roomEvents;
    private invoices;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, esService: ElasticsearchService, roomEvents: RoomEventsService, invoices: InvoicesService);
    private reindexRoom;
    private syncRoomStatus;
    create(dto: CreateBookingDto, currentUserId: string, currentUserRole: Role): Promise<any>;
    private toBookingResponse;
    findAll(query?: QueryBookingsDto, viewerRole?: Role): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
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
    private buildSettlement;
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
    checkOut(id: string, dto: CheckOutDto, cashierId: string): Promise<{
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
                    note: string | null;
                    serviceName: string;
                    quantity: number;
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
                amount: number;
                reference: string | null;
                note: string | null;
                invoiceId: string;
                method: import(".prisma/client").$Enums.PaymentMethod;
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
    cancel(id: string, dto?: CancelBookingDto, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    addServiceOrder(id: string, dto: AddServiceOrderDto): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        bookingId: string;
        unitPrice: number;
        note: string | null;
        serviceName: string;
        quantity: number;
        totalPrice: number;
        requestedById: string | null;
    }>;
    changeRoom(id: string, dto: ChangeRoomDto): Promise<{
        message: string;
        booking: any;
    }>;
    requestServiceOrder(id: string, dto: RequestServiceDto, customerId: string): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        bookingId: string;
        unitPrice: number;
        note: string | null;
        serviceName: string;
        quantity: number;
        totalPrice: number;
        requestedById: string | null;
    }>;
    updateServiceOrderStatus(bookingId: string, orderId: string, dto: UpdateServiceOrderStatusDto): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        bookingId: string;
        unitPrice: number;
        note: string | null;
        serviceName: string;
        quantity: number;
        totalPrice: number;
        requestedById: string | null;
    }>;
}
