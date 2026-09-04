import { BookingStatus } from '@prisma/client';
export declare class CreateBookingDto {
    customerId?: string;
    roomId: string;
    checkInDate: Date;
    checkOutDate: Date;
    guestCount?: number;
    depositAmount?: number;
    status?: BookingStatus;
    specialRequests?: string;
}
