import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
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
    getSummary(dateQuery?: string): Promise<{
        date: string;
        todayRevenue: number;
        totalInvoices: number;
        paidInvoices: number;
        unpaidInvoices: number;
        partialInvoices: number;
    }>;
}
