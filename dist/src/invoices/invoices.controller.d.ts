import { InvoicesService } from './invoices.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PaymentStatus } from '@prisma/client';
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
    create(dto: CreateInvoiceDto, cashierId: string): Promise<any>;
    findAll(status?: PaymentStatus): Promise<any[]>;
    findOne(id: string): Promise<any>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<any>;
}
