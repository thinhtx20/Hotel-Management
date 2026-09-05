import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { ConfirmPaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPaymentRequestsDto } from './dto/query-payment-requests.dto';
import { PaymentEntryStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
export declare class InvoicesService {
    private prisma;
    constructor(prisma: PrismaService);
    recalculateInvoiceTotals(tx: Prisma.TransactionClient, invoiceId: string): Promise<{
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
    }>;
    private toInvoiceResponse;
    findAll(queryOrStatus?: QueryInvoicesDto | PaymentStatus): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    findMyInvoices(customerId: string, queryOrStatus?: QueryInvoicesDto | PaymentStatus): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    findOne(id: string, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
    createPaymentRequest(id: string, dto: CreatePaymentRequestDto, userId: string, userRole: Role): Promise<{
        message: string;
        paymentId: string;
        amount: number;
        remainingAfterConfirm: number;
        invoice: any;
    }>;
    cancelPaymentRequest(invoiceId: string, paymentId: string, userId: string, userRole: Role): Promise<{
        message: string;
        invoice: any;
    }>;
    findPaymentRequests(queryOrStatus?: QueryPaymentRequestsDto | PaymentEntryStatus): Promise<import("../common/utils/pagination.util").PaginatedResult<{
        id: string;
        invoiceId: string;
        invoiceCode: string;
        bookingCode: string;
        roomNumber: string;
        customerName: string;
        customerPhone: string;
        amount: number;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        status: import(".prisma/client").$Enums.PaymentEntryStatus;
        reference: string;
        note: string;
        requestedAt: Date;
        confirmedAt: Date;
        confirmedByName: string;
        rejectedReason: string;
        invoiceFinalAmount: number;
        invoicePaidAmount: number;
        invoiceRemainingAmount: number;
    }>>;
    confirmPayment(paymentId: string, dto: ConfirmPaymentDto, cashierId: string): Promise<{
        message: string;
        paymentId: string;
        amount: number;
        invoice: any;
    }>;
    rejectPayment(paymentId: string, dto: RejectPaymentDto, cashierId: string): Promise<{
        message: string;
        paymentId: string;
        reason: string;
        invoice: any;
    }>;
    create(dto: CreateInvoiceDto, cashierId: string): Promise<any>;
    getSummary(dateQuery?: string, staffIdQuery?: string, currentUserId?: string): Promise<{
        date: string;
        staffId: string;
        staffName: string;
        invoicesIssued: number;
        amountCollected: number;
        byMethod: {
            CASH: number;
            CREDIT_CARD: number;
            BANK_TRANSFER: number;
        };
        unpaidLeftBehind: number;
        pendingPaymentRequests: number;
        todayRevenue?: undefined;
        totalInvoices?: undefined;
        paidInvoices?: undefined;
        unpaidInvoices?: undefined;
        partialInvoices?: undefined;
        outstandingAmount?: undefined;
    } | {
        date: string;
        todayRevenue: number;
        totalInvoices: number;
        paidInvoices: number;
        unpaidInvoices: number;
        partialInvoices: number;
        pendingPaymentRequests: number;
        outstandingAmount: number;
        staffId?: undefined;
        staffName?: undefined;
        invoicesIssued?: undefined;
        amountCollected?: undefined;
        byMethod?: undefined;
        unpaidLeftBehind?: undefined;
    }>;
    refund(id: string, dto: RefundDto, staffId: string): Promise<any>;
}
