import { BookingStatus, PaymentMethod } from '@prisma/client';
export declare class UpdateBookingStatusDto {
    status: BookingStatus;
}
export declare class AddServiceOrderDto {
    serviceName: string;
    unitPrice: number;
    quantity?: number;
}
export declare class CheckOutDto {
    paymentMethod?: PaymentMethod;
    discount?: number;
    taxRate?: number;
}
