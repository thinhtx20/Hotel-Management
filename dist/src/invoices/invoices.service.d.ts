import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RefundDto } from './dto/refund.dto';
import { PaymentStatus, Role } from '@prisma/client';
export declare class InvoicesService {
    private prisma;
    constructor(prisma: PrismaService);
    private toInvoiceResponse;
    findAll(status?: PaymentStatus): Promise<any[]>;
    findMyInvoices(customerId: string, status?: PaymentStatus): Promise<any[]>;
    findOne(id: string, currentUserId?: string, currentUserRole?: Role): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
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
    refund(id: string, dto: RefundDto, staffId: string): Promise<any>;
}
