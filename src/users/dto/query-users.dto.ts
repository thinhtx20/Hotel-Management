import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: Role,
    description: 'Lọc theo vai trò (ADMIN, RECEPTIONIST, CUSTOMER)',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'role phải là một trong: ADMIN, RECEPTIONIST, CUSTOMER' })
  role?: Role;
}
