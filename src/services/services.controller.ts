import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiSuccessResponse } from '../common/decorators/api-success-response.decorator';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh mục dịch vụ gia tăng của khách sạn (Công khai cho khách vãng lai)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Danh sách các dịch vụ khách sạn có sẵn',
    exampleData: [
      {
        id: 'svc-001',
        code: 'LAUNDRY',
        name: 'Giặt là cao cấp',
        category: 'CONVENIENCE',
        description: 'Giặt ủi quần áo lấy trong ngày',
        unitPrice: 50000,
        unit: 'món',
        icon: 'local_laundry_service',
        isAvailable: true,
      },
    ],
  })
  findAll() {
    return this.servicesService.findAll();
  }
}
