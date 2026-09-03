import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AddServiceOrderDto, CheckOutDto } from './dto/update-booking-status.dto';
import { BookingStatus, Role } from '@prisma/client';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
    create(createBookingDto: CreateBookingDto, userId: string, userRole: Role): Promise<{
        room: {
            roomType: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                description: string | null;
                basePrice: number;
                capacityAdults: number;
                capacityChildren: number;
                sizeSqM: number | null;
                amenities: string[];
                images: string[];
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
        customer: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    findAll(userId: string, userRole: Role, status?: BookingStatus, customerId?: string, roomId?: string): Promise<({
        room: {
            roomType: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                description: string | null;
                basePrice: number;
                capacityAdults: number;
                capacityChildren: number;
                sizeSqM: number | null;
                amenities: string[];
                images: string[];
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
        customer: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
        };
        invoice: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            invoiceCode: string;
            roomAmount: number;
            servicesAmount: number;
            discount: number;
            tax: number;
            finalAmount: number;
            paidAmount: number;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            paidAt: Date | null;
            bookingId: string;
            issuedById: string | null;
        };
        serviceOrders: {
            id: string;
            createdAt: Date;
            bookingId: string;
            serviceName: string;
            unitPrice: number;
            quantity: number;
            totalPrice: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    })[]>;
    findOne(id: string): Promise<{
        room: {
            roomType: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                description: string | null;
                basePrice: number;
                capacityAdults: number;
                capacityChildren: number;
                sizeSqM: number | null;
                amenities: string[];
                images: string[];
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
        customer: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
        };
        invoice: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            invoiceCode: string;
            roomAmount: number;
            servicesAmount: number;
            discount: number;
            tax: number;
            finalAmount: number;
            paidAmount: number;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            paidAt: Date | null;
            bookingId: string;
            issuedById: string | null;
        };
        serviceOrders: {
            id: string;
            createdAt: Date;
            bookingId: string;
            serviceName: string;
            unitPrice: number;
            quantity: number;
            totalPrice: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    checkIn(id: string): Promise<{
        room: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    checkOut(id: string, checkOutDto: CheckOutDto, cashierId: string): Promise<{
        message: string;
        booking: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.BookingStatus;
            bookingCode: string;
            checkInDate: Date;
            checkOutDate: Date;
            actualCheckIn: Date | null;
            actualCheckOut: Date | null;
            guestCount: number;
            totalAmount: number;
            depositAmount: number;
            specialRequests: string | null;
            customerId: string;
            roomId: string;
        };
        invoice: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            roomNumber: string;
            floor: number;
            status: import(".prisma/client").$Enums.RoomStatus;
            notes: string | null;
            roomTypeId: string;
        };
    }>;
    cancel(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.BookingStatus;
        bookingCode: string;
        checkInDate: Date;
        checkOutDate: Date;
        actualCheckIn: Date | null;
        actualCheckOut: Date | null;
        guestCount: number;
        totalAmount: number;
        depositAmount: number;
        specialRequests: string | null;
        customerId: string;
        roomId: string;
    }>;
    addServiceOrder(id: string, dto: AddServiceOrderDto): Promise<{
        id: string;
        createdAt: Date;
        bookingId: string;
        serviceName: string;
        unitPrice: number;
        quantity: number;
        totalPrice: number;
    }>;
}
