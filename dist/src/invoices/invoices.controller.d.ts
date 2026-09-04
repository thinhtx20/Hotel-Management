import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PaymentStatus, Role } from '@prisma/client';
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    getSummary(date?: string): Promise<{
        date: string;
        todayRevenue: number;
        totalInvoices: number;
        paidInvoices: number;
        unpaidInvoices: number;
        partialInvoices: number;
    }>;
    findMine(userId: string, status?: PaymentStatus): Promise<any[]>;
    create(dto: CreateInvoiceDto, cashierId: string): Promise<any>;
    findAll(status?: PaymentStatus): Promise<any[]>;
    findOne(id: string, userId: string, userRole: Role): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
}
