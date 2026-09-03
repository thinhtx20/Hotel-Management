import { PaymentMethod, PaymentStatus } from '@prisma/client';
export declare class RecordPaymentDto {
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus?: PaymentStatus;
    notes?: string;
}
