import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryRoomsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: RoomStatus,
    description: 'Lọc theo trạng thái phòng (AVAILABLE, OCCUPIED, RESERVED, CLEANING, MAINTENANCE)',
  })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'status không hợp lệ' })
  status?: RoomStatus;

  @ApiPropertyOptional({
    example: 2,
    description: 'Lọc theo tầng (floor >= 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'floor phải là số nguyên' })
  @Min(1, { message: 'floor tối thiểu là 1' })
  floor?: number;

  @ApiPropertyOptional({
    example: 'type-uuid-dlx',
    description: 'Lọc theo hạng phòng (roomTypeId)',
  })
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
