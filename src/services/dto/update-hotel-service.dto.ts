import { PartialType } from '@nestjs/swagger';
import { CreateHotelServiceDto } from './create-hotel-service.dto';

export class UpdateHotelServiceDto extends PartialType(CreateHotelServiceDto) {}
