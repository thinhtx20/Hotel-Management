export declare class CreateBookingDto {
    customerId?: string;
    roomId: string;
    checkInDate: Date;
    checkOutDate: Date;
    guestCount?: number;
    depositAmount?: number;
    specialRequests?: string;
}
