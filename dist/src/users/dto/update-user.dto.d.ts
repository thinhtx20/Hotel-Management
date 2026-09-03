import { Role } from '@prisma/client';
export declare class UpdateUserDto {
    fullName?: string;
    phone?: string;
    avatar?: string;
    role?: Role;
    isActive?: boolean;
}
