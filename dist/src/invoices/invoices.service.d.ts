import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentStatus } from '@prisma/client';
export declare class InvoicesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(status?: PaymentStatus): Promise<({
        booking: {
            room: {
                roomNumber: string;
            };
            customer: {
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
        };
        issuedBy: {
            fullName: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
        booking: {
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
                password: string;
                fullName: string;
                phone: string | null;
                avatar: string | null;
                role: import(".prisma/client").$Enums.Role;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
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
        };
        issuedBy: {
            email: string;
            fullName: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
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
    }>;
    recordPayment(id: string, dto: RecordPaymentDto, cashierId: string): Promise<{
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
    }>;
}
