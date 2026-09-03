import { Injectable } from '@nestjs/common';

export interface HotelServiceItem {
  id: string;
  code: string;
  name: string;
  category: 'FOOD_BEVERAGE' | 'WELLNESS' | 'TRANSPORT' | 'CONVENIENCE' | 'ROOM_SERVICE';
  description: string;
  unitPrice: number;
  unit: string;
  icon: string;
  isAvailable: boolean;
}

@Injectable()
export class ServicesService {
  private readonly servicesList: HotelServiceItem[] = [
    {
      id: 'svc-001',
      code: 'LAUNDRY',
      name: 'Giặt là cao cấp',
      category: 'CONVENIENCE',
      description: 'Giặt ủi quần áo lấy trong ngày, đóng gói cẩn thận',
      unitPrice: 50000,
      unit: 'món',
      icon: 'local_laundry_service',
      isAvailable: true,
    },
    {
      id: 'svc-002',
      code: 'MINIBAR',
      name: 'Minibar trọn gói',
      category: 'FOOD_BEVERAGE',
      description: 'Bao gồm snack cao cấp, nước ngọt, bia và nước khoáng hảo hạng',
      unitPrice: 150000,
      unit: 'combo',
      icon: 'kitchen',
      isAvailable: true,
    },
    {
      id: 'svc-003',
      code: 'BREAKFAST',
      name: 'Ăn sáng buffet tại phòng',
      category: 'FOOD_BEVERAGE',
      description: 'Phục vụ bữa sáng tiêu chuẩn 5 sao tận phòng ngủ theo yêu cầu',
      unitPrice: 200000,
      unit: 'suất',
      icon: 'restaurant',
      isAvailable: true,
    },
    {
      id: 'svc-004',
      code: 'AIRPORT_TRANSFER',
      name: 'Đưa đón sân bay',
      category: 'TRANSPORT',
      description: 'Xe Sedona / Mercedes đời mới đưa đón 2 chiều sân bay tiện lợi',
      unitPrice: 350000,
      unit: 'lượt',
      icon: 'airport_shuttle',
      isAvailable: true,
    },
    {
      id: 'svc-005',
      code: 'SPA_MASSAGE',
      name: 'Spa & Massage trị liệu',
      category: 'WELLNESS',
      description: 'Gói massage tinh dầu thảo dược thư giãn toàn thân 60 phút',
      unitPrice: 500000,
      unit: 'buổi',
      icon: 'spa',
      isAvailable: true,
    },
    {
      id: 'svc-006',
      code: 'MOTORBIKE_RENTAL',
      name: 'Thuê xe máy tay ga',
      category: 'TRANSPORT',
      description: 'Xe tay ga đời mới, kèm 2 mũ bảo hiểm đạt chuẩn an toàn',
      unitPrice: 150000,
      unit: 'ngày',
      icon: 'two_wheeler',
      isAvailable: true,
    },
    {
      id: 'svc-007',
      code: 'AFTERNOON_TEA',
      name: 'Trà chiều hoàng gia',
      category: 'ROOM_SERVICE',
      description: 'Set bánh ngọt Pháp và trà Earl Grey thượng hạng cho 2 người',
      unitPrice: 180000,
      unit: 'set',
      icon: 'emoji_food_beverage',
      isAvailable: true,
    },
  ];

  findAll() {
    return this.servicesList;
  }

  findByCode(code: string) {
    return this.servicesList.find(
      (s) => s.code.toLowerCase() === code.toLowerCase(),
    );
  }
}
