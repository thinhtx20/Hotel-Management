import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UploadCategory {
  AVATAR = 'avatar',
  ROOM = 'room',
  SERVICE = 'service',
  GENERAL = 'general',
}

export class UploadedFileDto {
  @ApiProperty({
    description: 'Đường dẫn công khai (Public URL) để truy cập ảnh',
    example: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/avatars/1725432000-abc1234.webp',
  })
  url: string;

  @ApiProperty({
    description: 'Đường dẫn tệp nội bộ hoặc Cloudinary Public ID',
    example: 'hotel_management/avatars/1725432000-abc1234',
  })
  path: string;

  @ApiProperty({
    description: 'Phân loại loại ảnh: avatar (ảnh đại diện), room (ảnh phòng), service (ảnh dịch vụ), general (chung)',
    enum: UploadCategory,
    example: UploadCategory.AVATAR,
  })
  type: UploadCategory;

  @ApiProperty({
    description: 'Thư mục lưu trữ của ảnh',
    example: 'avatars',
  })
  folder: string;

  @ApiProperty({
    description: 'Dung lượng tệp (bytes)',
    example: 124500,
  })
  size: number;

  @ApiProperty({
    description: 'Loại MIME của tệp',
    example: 'image/jpeg',
  })
  mimetype: string;

  @ApiProperty({
    description: 'Tên tệp gốc được tải lên',
    example: 'my_avatar.jpg',
  })
  originalName: string;

  @ApiPropertyOptional({
    description: 'Thông tin tài khoản đã được tự động cập nhật avatar (nếu có)',
    example: {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      fullName: 'Lê Thu Hà',
      avatar: 'https://res.cloudinary.com/wsaxdisz/image/upload/...',
    },
  })
  user?: {
    id: string;
    fullName: string;
    avatar: string;
  };

  @ApiPropertyOptional({
    description: 'Thông tin loại phòng đã được tự động gán thêm ảnh (nếu có)',
    example: {
      id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
      name: 'Phòng Deluxe Hướng Biển',
      code: 'DELUXE_OCEAN',
      images: ['https://res.cloudinary.com/...'],
    },
  })
  roomType?: {
    id: string;
    name: string;
    code: string;
    images: string[];
  };
}

export class UploadMultipleFilesDto {
  @ApiProperty({
    description: 'Phân loại ảnh chung của album tải lên',
    enum: UploadCategory,
    example: UploadCategory.ROOM,
  })
  type: UploadCategory;

  @ApiProperty({
    description: 'Thư mục lưu trữ của album',
    example: 'rooms',
  })
  folder: string;

  @ApiProperty({
    description: 'Danh sách các tệp đã tải lên thành công',
    type: [UploadedFileDto],
  })
  files: UploadedFileDto[];

  @ApiProperty({
    description: 'Mảng danh sách các Public URL để gán trực tiếp vào RoomType.images',
    example: [
      'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1725432000-1.webp',
      'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1725432000-2.webp',
    ],
  })
  urls: string[];

  @ApiPropertyOptional({
    description: 'Thông tin loại phòng đã được tự động gán thêm danh sách ảnh (nếu có)',
    example: {
      id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
      name: 'Phòng Deluxe Hướng Biển',
      code: 'DELUXE_OCEAN',
      images: ['https://res.cloudinary.com/...'],
    },
  })
  roomType?: {
    id: string;
    name: string;
    code: string;
    images: string[];
  };
}
