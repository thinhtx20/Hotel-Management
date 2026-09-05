import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UserEventsService } from './user-events.service';
import { Role } from '@prisma/client';
export declare class UsersService {
    private prisma;
    private userEvents;
    constructor(prisma: PrismaService, userEvents: UserEventsService);
    create(dto: CreateUserDto): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
    findAll(queryOrRole?: QueryUsersDto | Role): Promise<import("../common/utils/pagination.util").PaginatedResult<{
        id: string;
        createdAt: Date;
        _count: {
            bookings: number;
        };
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>>;
    findOne(id: string): Promise<{
        id: string;
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
                roomNumber: string;
                floor: number;
                roomTypeId: string;
                status: import(".prisma/client").$Enums.RoomStatus;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.BookingStatus;
            createdAt: Date;
            updatedAt: Date;
            bookingCode: string;
            checkInDate: Date;
            checkOutDate: Date;
            actualCheckIn: Date | null;
            actualCheckOut: Date | null;
            guestCount: number;
            totalAmount: number;
            depositAmount: number;
            specialRequests: string | null;
            confirmedAt: Date | null;
            confirmationNote: string | null;
            cancellationReason: string | null;
            cancelledAt: Date | null;
            customerId: string;
            roomId: string;
            confirmedById: string | null;
            cancelledById: string | null;
        })[];
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string;
        updatedAt: Date;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
    updateMe(id: string, dto: {
        fullName?: string;
        phone?: string;
        avatar?: string;
    }): Promise<{
        avatarUrl: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        fullName: string;
        phone: string;
        avatar: string;
        role: import(".prisma/client").$Enums.Role;
        isActive: boolean;
    }>;
}
