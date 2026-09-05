import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { ConfirmPaymentDto, RejectPaymentDto } from './dto/review-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPaymentRequestsDto } from './dto/query-payment-requests.dto';
import { Role } from '@prisma/client';
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    getSummary(date?: string, staffId?: string, currentUserId?: string): Promise<{
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
    findMine(userId: string, query: QueryInvoicesDto): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    findPaymentRequests(query: QueryPaymentRequestsDto): Promise<import("../common/utils/pagination.util").PaginatedResult<{
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
    findAll(query: QueryInvoicesDto): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    findOne(id: string, userId: string, userRole: Role): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
    createPaymentRequest(id: string, dto: CreatePaymentRequestDto, userId: string, userRole: Role): Promise<{
        message: string;
        paymentId: string;
        amount: number;
        remainingAfterConfirm: number;
        invoice: any;
    }>;
    cancelPaymentRequest(id: string, paymentId: string, userId: string, userRole: Role): Promise<{
        message: string;
        invoice: any;
    }>;
    refund(id: string, dto: RefundDto, staffId: string): Promise<any>;
}
