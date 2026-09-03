import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(role?: Role): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        _count: {
            bookings: number;
        };
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        createdAt: Date;
        bookings: ({
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
        })[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
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
    }>;
}
