import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';
import {
  UploadedFileDto,
  UploadMultipleFilesDto,
  UploadCategory,
} from './dto/upload-image-response.dto';
import './multer-file.type';

const imageFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/i)) {
    return callback(
      new BadRequestException(
        'Định dạng tệp không hợp lệ. Chỉ chấp nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP, GIF!',
      ),
      false,
    );
  }
  callback(null, true);
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Upload (Tải lên & Lưu trữ Ảnh: Avatar & Phòng)')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // =========================================================================
  // 1. TẢI LÊN ẢNH AVATAR (NGƯỜI DÙNG / KHÁCH HÀNG)
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @ApiOperation({
    summary: '👤 Tải lên ảnh Avatar đại diện người dùng',
    description:
      'Gửi multipart/form-data với field "file". Lưu tự động vào thư mục "avatars". Nếu updateProfile=true (mặc định), hệ thống tự động cập nhật URL ảnh đại diện vào tài khoản đang đăng nhập.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'updateProfile',
    required: false,
    type: Boolean,
    description: 'Tự động cập nhật URL ảnh đại diện vào hồ sơ tài khoản đang đăng nhập (mặc định: true)',
    example: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp hình ảnh Avatar (Tối đa 5MB: JPG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tải lên ảnh Avatar thành công',
    exampleData: {
      url: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/avatars/1725432000-avatar.webp',
      path: 'hotel_management/avatars/1725432000-avatar',
      type: 'avatar',
      folder: 'avatars',
      size: 154000,
      mimetype: 'image/webp',
      originalName: 'avatar.webp',
      user: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        fullName: 'Lê Thu Hà',
        avatar: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/avatars/1725432000-avatar.webp',
      },
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Tệp không hợp lệ hoặc vượt quá dung lượng cho phép (5MB)',
    error: 'Bad Request',
    path: '/api/v1/upload/avatar',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId?: string,
    @Query('updateProfile') updateProfile?: string,
  ): Promise<UploadedFileDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh Avatar để tải lên (field: "file")');
    }
    const shouldUpdate = updateProfile === undefined || updateProfile === 'true' || updateProfile === '1';
    return this.uploadService.uploadAvatar(file, userId, shouldUpdate);
  }

  // =========================================================================
  // 2. TẢI LÊN 1 ẢNH PHÒNG (ROOM IMAGE)
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('room')
  @ApiOperation({
    summary: '🏨 Tải lên 1 ảnh của phòng / loại phòng (Folder rooms)',
    description:
      'Gửi multipart/form-data với field "file". Lưu tự động vào thư mục "rooms". Nếu truyền query param "roomTypeId", hệ thống sẽ tự động thêm URL ảnh vào mảng "images" của loại phòng đó.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'roomTypeId',
    required: false,
    type: String,
    description: 'ID của loại phòng (RoomType) để tự động thêm ảnh vào database',
    example: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp hình ảnh phòng (Tối đa 5MB: JPG, PNG, WEBP)',
        },
      },
    },
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tải lên ảnh phòng thành công',
    exampleData: {
      url: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1725432000-deluxe.webp',
      path: 'hotel_management/rooms/1725432000-deluxe',
      type: 'room',
      folder: 'rooms',
      size: 420000,
      mimetype: 'image/webp',
      originalName: 'deluxe.webp',
      roomType: {
        id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
        name: 'Phòng Deluxe Hướng Biển',
        code: 'DELUXE_OCEAN',
        images: [
          'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1725432000-deluxe.webp',
        ],
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadRoomImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('roomTypeId') roomTypeId?: string,
  ): Promise<UploadedFileDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh phòng để tải lên (field: "file")');
    }
    return this.uploadService.uploadRoomImage(file, roomTypeId);
  }

  // =========================================================================
  // 3. TẢI LÊN NHIỀU ẢNH PHÒNG / ALBUM PHÒNG (ROOM IMAGES)
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('rooms')
  @ApiOperation({
    summary: '🏨 Tải lên album nhiều ảnh phòng (Tối đa 10 ảnh, Folder rooms)',
    description:
      'Gửi multipart/form-data với field "files" (mảng ảnh). Tự động lưu vào thư mục "rooms". Nếu truyền param "roomTypeId", hệ thống sẽ tự động nối danh sách URLs này vào "images" của loại phòng tương ứng.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'roomTypeId',
    required: false,
    type: String,
    description: 'ID của loại phòng (RoomType) để tự động lưu album ảnh',
    example: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Danh sách tối đa 10 tệp hình ảnh phòng (Mỗi tệp tối đa 5MB)',
        },
      },
    },
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tải album ảnh phòng thành công',
    exampleData: {
      type: 'room',
      folder: 'rooms',
      files: [
        {
          url: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1.webp',
          path: 'hotel_management/rooms/1',
          type: 'room',
          folder: 'rooms',
          size: 450120,
          mimetype: 'image/webp',
          originalName: 'room-1.webp',
        },
      ],
      urls: [
        'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1.webp',
      ],
      roomType: {
        id: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
        name: 'Phòng Deluxe Hướng Biển',
        code: 'DELUXE_OCEAN',
        images: [
          'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/rooms/1.webp',
        ],
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadRoomImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('roomTypeId') roomTypeId?: string,
  ): Promise<UploadMultipleFilesDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp ảnh phòng để tải lên (field: "files")');
    }
    return this.uploadService.uploadRoomImages(files, roomTypeId);
  }

  // =========================================================================
  // 4. TẢI LÊN 1 ẢNH ĐA NĂNG (GENERAL / TÙY CHỌN THƯ MỤC)
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('image')
  @ApiOperation({
    summary: '📸 Tải lên 1 ảnh đa năng (Hỗ trợ chọn loại: avatar, room, service, general)',
    description:
      'Gửi multipart/form-data với field "file". Chỉ định "category" hoặc "folder" để hệ thống tự động phân loại đúng mục đích.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'category',
    required: false,
    enum: UploadCategory,
    description: 'Loại ảnh: avatar (ảnh đại diện), room (ảnh phòng), service (ảnh dịch vụ), general (chung)',
    example: UploadCategory.AVATAR,
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: ['avatars', 'rooms', 'services', 'general'],
    description: 'Thư mục đích lưu trữ (mặc định theo category hoặc "general")',
    example: 'avatars',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp hình ảnh (Tối đa 5MB: JPG, PNG, WEBP, GIF)',
        },
      },
    },
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tải ảnh lên thành công',
    exampleData: {
      url: 'https://res.cloudinary.com/wsaxdisz/image/upload/v1725432000/hotel_management/avatars/1725432000-abc1234.webp',
      path: 'hotel_management/avatars/1725432000-abc1234',
      type: 'avatar',
      folder: 'avatars',
      size: 245600,
      mimetype: 'image/webp',
      originalName: 'avatar.webp',
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category?: UploadCategory,
    @Query('folder') folder?: string,
  ): Promise<UploadedFileDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh để tải lên (field: "file")');
    }
    const targetFolder = folder || (category ? `${category}s` : 'general');
    return this.uploadService.uploadImage(file, targetFolder, category);
  }

  // =========================================================================
  // 5. TẢI LÊN NHIỀU ẢNH ĐA NĂNG
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('images')
  @ApiOperation({
    summary: '📸 Tải lên nhiều ảnh đa năng (Tối đa 10 ảnh)',
    description:
      'Gửi multipart/form-data với field "files" (mảng). Dùng tải danh mục album ảnh, dịch vụ, tiện ích chung.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'category',
    required: false,
    enum: UploadCategory,
    description: 'Phân loại ảnh: room, service, general',
    example: UploadCategory.ROOM,
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: ['rooms', 'services', 'general'],
    description: 'Thư mục đích lưu trữ (mặc định: rooms)',
    example: 'rooms',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Danh sách tối đa 10 tệp hình ảnh (Mỗi tệp tối đa 5MB)',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('category') category?: UploadCategory,
    @Query('folder') folder?: string,
  ): Promise<UploadMultipleFilesDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp ảnh để tải lên (field: "files")');
    }
    const targetFolder = folder || (category ? `${category}s` : 'rooms');
    return this.uploadService.uploadMultipleImages(files, targetFolder, category);
  }

  // =========================================================================
  // 6. XÓA ẢNH
  // =========================================================================
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiOperation({
    summary: '🗑️ Xóa một ảnh khỏi lưu trữ',
    description: 'Truyền đường dẫn nội bộ (ví dụ: hotel_management/avatars/1725... hoặc uploads/avatars/...) hoặc Public URL đầy đủ.',
  })
  @ApiQuery({
    name: 'path',
    required: true,
    description: 'Đường dẫn tệp nội bộ hoặc Public URL cần xóa',
    example: 'hotel_management/avatars/1725432000-abc1234',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xóa ảnh thành công',
    exampleData: {
      success: true,
      message: 'Đã xử lý yêu cầu xóa ảnh',
    },
  })
  async deleteImage(@Query('path') path: string) {
    if (!path) {
      throw new BadRequestException('Query param "path" không được để trống');
    }
    return this.uploadService.deleteImage(path);
  }
}
