import { Role } from '@prisma/client';
export declare class RegisterDto {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: Role;
}
