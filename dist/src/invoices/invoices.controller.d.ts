import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RefundDto } from './dto/refund.dto';
import { PaymentStatus, Role } from '@prisma/client';
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
        todayRevenue?: undefined;
        totalInvoices?: undefined;
        paidInvoices?: undefined;
        unpaidInvoices?: undefined;
        partialInvoices?: undefined;
    } | {
        date: string;
        todayRevenue: number;
        totalInvoices: number;
        paidInvoices: number;
        unpaidInvoices: number;
        partialInvoices: number;
        staffId?: undefined;
        staffName?: undefined;
        invoicesIssued?: undefined;
        amountCollected?: undefined;
        byMethod?: undefined;
        unpaidLeftBehind?: undefined;
    }>;
    findMine(userId: string, status?: PaymentStatus): Promise<any[]>;
    create(dto: CreateInvoiceDto, cashierId: string): Promise<any>;
    findAll(status?: PaymentStatus): Promise<any[]>;
    findOne(id: string, userId: string, userRole: Role): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
    refund(id: string, dto: RefundDto, staffId: string): Promise<any>;
}
