import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  UploadedFileDto,
  UploadMultipleFilesDto,
  UploadCategory,
} from './dto/upload-image-response.dto';
import './multer-file.type';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private isCloudinaryReady = false;
  private readonly uploadDir: string;
  private readonly serverBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {
    const cloudName =
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME') ||
      process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      this.configService.get<string>('CLOUDINARY_API_KEY') ||
      process.env.CLOUDINARY_API_KEY ||
      '197971826939544';
    const apiSecret =
      this.configService.get<string>('CLOUDINARY_API_SECRET') ||
      process.env.CLOUDINARY_API_SECRET ||
      'FbV7MLXIEH1CwMHyMFGj5WrvpM8';

    const port = this.configService.get<number>('PORT') || 3000;
    this.serverBaseUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('SERVER_URL') ||
      `http://localhost:${port}`;

    this.uploadDir = path.join(process.cwd(), 'uploads');

    if (cloudName && cloudName.trim() !== '' && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        secure: true,
      });
      this.isCloudinaryReady = true;
      this.logger.log(
        `☁️ [Cloudinary Storage] Đã khởi tạo Cloudinary thành công với Cloud Name: "${cloudName}"`,
      );
    } else {
      // Đảm bảo thư mục uploads tồn tại trên server để lưu cục bộ
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      this.logger.warn(
        `⚠️ [Chưa có CLOUDINARY_CLOUD_NAME] Hệ thống tạm thời kích hoạt chế độ lưu trữ cục bộ tại: "${this.uploadDir}". Ảnh phục vụ qua: ${this.serverBaseUrl}/uploads/...`,
      );
    }
  }

  /**
   * Helper phân định loại ảnh dựa theo folder hoặc category truyền vào
   */
  private resolveCategory(folder: string, explicitCategory?: UploadCategory): UploadCategory {
    if (explicitCategory) return explicitCategory;
    const lower = folder.toLowerCase();
    if (lower.includes('avatar')) return UploadCategory.AVATAR;
    if (lower.includes('room')) return UploadCategory.ROOM;
    if (lower.includes('service')) return UploadCategory.SERVICE;
    return UploadCategory.GENERAL;
  }

  /**
   * Helper stream buffer lên Cloudinary
   */
  private uploadToCloudinary(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `hotel_management/${folder}`,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary không trả về kết quả'));
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  /**
   * Tải 1 ảnh lên (Cloudinary hoặc Local fallback), kèm phân loại ảnh rõ ràng
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'general',
    category?: UploadCategory,
  ): Promise<UploadedFileDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Tệp tải lên không hợp lệ hoặc rỗng');
    }

    const cleanFolder = folder.replace(/^[\/\\]+|[\/\\]+$/g, '').trim() || 'general';
    const detectedType = this.resolveCategory(cleanFolder, category);

    // 1. NẾU CLOUDINARY ĐÃ CẤU HÌNH: TẢI THẲNG LÊN CLOUDINARY
    if (this.isCloudinaryReady) {
      try {
        const result = await this.uploadToCloudinary(file.buffer, cleanFolder);
        return {
          url: result.secure_url,
          path: result.public_id,
          type: detectedType,
          folder: cleanFolder,
          size: result.bytes || file.size,
          mimetype: file.mimetype,
          originalName: file.originalname,
        };
      } catch (err: any) {
        this.logger.error(`Lỗi Cloudinary upload: ${err.message}`, err.stack);
        this.logger.warn(`Chuyển hướng lưu tệp tạm thời xuống ổ cứng cục bộ...`);
      }
    }

    // 2. NẾU CHƯA CÓ CLOUDINARY HOẶC GẶP SỰ CỐ MẠNG: LƯU CỤC BỘ TẠI SERVER
    try {
      let ext = path.extname(file.originalname).toLowerCase();
      if (!ext) {
        if (file.mimetype === 'image/jpeg') ext = '.jpg';
        else if (file.mimetype === 'image/png') ext = '.png';
        else if (file.mimetype === 'image/webp') ext = '.webp';
        else ext = '.jpg';
      }

      const uniqueFileName = `${Date.now()}-${randomUUID()}${ext}`;
      const targetFolder = path.join(this.uploadDir, cleanFolder);
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
      }

      const localFilePath = path.join(targetFolder, uniqueFileName);
      await fs.promises.writeFile(localFilePath, file.buffer);

      const publicUrl = `${this.serverBaseUrl}/uploads/${cleanFolder}/${uniqueFileName}`;

      return {
        url: publicUrl,
        path: `${cleanFolder}/${uniqueFileName}`,
        type: detectedType,
        folder: cleanFolder,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi lưu tệp cục bộ: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Không thể lưu tệp ảnh trên máy chủ: ${err.message}`);
    }
  }

  /**
   * Chuyên biệt: Tải ảnh đại diện người dùng (Avatar)
   * Có tuỳ chọn tự động cập nhật vào trường `avatar` của bảng User
   */
  async uploadAvatar(
    file: Express.Multer.File,
    userId?: string,
    updateProfile = true,
  ): Promise<UploadedFileDto> {
    const result = await this.uploadImage(file, 'avatars', UploadCategory.AVATAR);

    if (userId && updateProfile) {
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { avatar: result.url },
            select: { id: true, fullName: true, avatar: true },
          });
          result.user = {
            id: updatedUser.id,
            fullName: updatedUser.fullName,
            avatar: updatedUser.avatar || result.url,
          };
          this.logger.log(`👤 Đã tự động cập nhật avatar cho người dùng ${user.fullName} (${userId})`);
        }
      } catch (err: any) {
        this.logger.warn(`Không thể tự động cập nhật avatar vào database cho user ${userId}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Helper xóa cache danh sách phòng trong Redis khi có ảnh mới
   */
  private async clearRoomsCache() {
    if (this.redis) {
      try {
        await this.redis.delByPattern('cache:rooms:*');
      } catch (err: any) {
        this.logger.warn(`Không thể xóa cache phòng trên Redis: ${err.message}`);
      }
    }
  }

  /**
   * Chuyên biệt: Tải 1 ảnh phòng
   * Hỗ trợ gán vào Room (roomId) hoặc RoomType (roomTypeId), trả về đầy đủ ảnh của phòng
   */
  async uploadRoomImage(
    file: Express.Multer.File,
    roomTypeId?: string,
    roomId?: string,
  ): Promise<UploadedFileDto> {
    const result = await this.uploadImage(file, 'rooms', UploadCategory.ROOM);

    // 1. Trường hợp truyền ID của phòng cụ thể (Room ID)
    if (roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true },
      });
      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
      }

      const existingImages = room.roomType?.images || [];
      const updatedImages = [...existingImages, result.url];

      const updatedRoomType = await this.prisma.roomType.update({
        where: { id: room.roomTypeId },
        data: { images: updatedImages },
        select: { id: true, name: true, code: true, images: true, basePrice: true },
      });

      result.images = updatedImages;
      result.image = updatedImages[0] || result.url;
      result.roomType = updatedRoomType;
      result.room = {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        image: updatedImages[0] || result.url,
        imageUrl: updatedImages[0] || result.url,
        images: updatedImages,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
        roomType: updatedRoomType,
      };

      await this.clearRoomsCache();
      this.logger.log(`🏨 Đã thêm 1 ảnh mới cho phòng ${room.roomNumber} (${roomId}) - Loại: "${room.roomType.name}"`);
      return result;
    }

    // 2. Trường hợp truyền ID của loại phòng (RoomType ID)
    if (roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({
        where: { id: roomTypeId },
      });
      if (!roomType) {
        throw new NotFoundException(`Không tìm thấy loại phòng với ID: ${roomTypeId}`);
      }

      const existingImages = roomType.images || [];
      const updatedImages = [...existingImages, result.url];

      const updated = await this.prisma.roomType.update({
        where: { id: roomTypeId },
        data: { images: updatedImages },
        select: { id: true, name: true, code: true, images: true, basePrice: true },
      });

      result.images = updatedImages;
      result.image = updatedImages[0] || result.url;
      result.roomType = updated;

      await this.clearRoomsCache();
      this.logger.log(`🏨 Đã thêm 1 ảnh mới vào loại phòng "${roomType.name}" (${roomTypeId})`);
    }

    return result;
  }

  /**
   * Chuyên biệt: Tải nhiều ảnh phòng cùng lúc (Album phòng)
   * Hỗ trợ tự động thêm danh sách ảnh vào Room hoặc RoomType và trả về mảng ảnh đầy đủ
   */
  async uploadRoomImages(
    files: Express.Multer.File[],
    roomTypeId?: string,
    roomId?: string,
  ): Promise<UploadMultipleFilesDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Danh sách tệp tải lên không được để trống');
    }

    const uploadPromises = files.map((file) =>
      this.uploadImage(file, 'rooms', UploadCategory.ROOM),
    );
    const results = await Promise.all(uploadPromises);
    const urls = results.map((r) => r.url);

    const response: UploadMultipleFilesDto = {
      type: UploadCategory.ROOM,
      folder: 'rooms',
      files: results,
      urls,
      images: urls,
      image: urls[0] || '',
    };

    // 1. Trường hợp truyền ID của phòng cụ thể (Room ID)
    if (roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true },
      });
      if (!room) {
        throw new NotFoundException(`Không tìm thấy phòng với ID: ${roomId}`);
      }

      const existingImages = room.roomType?.images || [];
      const updatedImages = [...existingImages, ...urls];

      const updatedRoomType = await this.prisma.roomType.update({
        where: { id: room.roomTypeId },
        data: { images: updatedImages },
        select: { id: true, name: true, code: true, images: true, basePrice: true },
      });

      response.images = updatedImages;
      response.image = updatedImages[0] || urls[0];
      response.roomType = updatedRoomType;
      response.room = {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        image: updatedImages[0] || urls[0],
        imageUrl: updatedImages[0] || urls[0],
        images: updatedImages,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
        roomType: updatedRoomType,
      };

      await this.clearRoomsCache();
      this.logger.log(`🏨 Đã thêm ${urls.length} ảnh vào phòng ${room.roomNumber} (${roomId}) - Loại: "${room.roomType.name}"`);
      return response;
    }

    // 2. Trường hợp truyền ID của loại phòng (RoomType ID)
    if (roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({
        where: { id: roomTypeId },
      });
      if (!roomType) {
        throw new NotFoundException(`Không tìm thấy loại phòng với ID: ${roomTypeId}`);
      }

      const existingImages = roomType.images || [];
      const updatedImages = [...existingImages, ...urls];

      const updated = await this.prisma.roomType.update({
        where: { id: roomTypeId },
        data: { images: updatedImages },
        select: { id: true, name: true, code: true, images: true, basePrice: true },
      });

      response.images = updatedImages;
      response.image = updatedImages[0] || urls[0];
      response.roomType = updated;

      await this.clearRoomsCache();
      this.logger.log(`🏨 Đã thêm ${urls.length} ảnh vào loại phòng "${roomType.name}" (${roomTypeId})`);
    }

    return response;
  }

  /**
   * Tải nhiều ảnh đa năng
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder = 'rooms',
    category?: UploadCategory,
  ): Promise<UploadMultipleFilesDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Danh sách tệp tải lên không được để trống');
    }

    const cleanFolder = folder.replace(/^[\/\\]+|[\/\\]+$/g, '').trim() || 'general';
    const detectedType = this.resolveCategory(cleanFolder, category);

    const uploadPromises = files.map((file) => this.uploadImage(file, cleanFolder, detectedType));
    const results = await Promise.all(uploadPromises);

    return {
      type: detectedType,
      folder: cleanFolder,
      files: results,
      urls: results.map((r) => r.url),
    };
  }

  /**
   * Xóa một ảnh
   */
  async deleteImage(pathOrUrl: string): Promise<{ success: boolean; message: string }> {
    if (!pathOrUrl) {
      throw new BadRequestException('Đường dẫn ảnh cần xóa không được để trống');
    }

    // 1. Nếu là Cloudinary: Xóa qua destroy API
    if (this.isCloudinaryReady) {
      try {
        let publicId = pathOrUrl;
        if (publicId.includes('res.cloudinary.com')) {
          // Trích xuất public_id từ Cloudinary URL
          const parts = publicId.split('/upload/');
          if (parts.length > 1) {
            const pathAfterUpload = parts[1].replace(/^v\d+\//, ''); // Bỏ version v12345/
            publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.')) || pathAfterUpload;
          }
        }
        await cloudinary.uploader.destroy(publicId);
      } catch (err: any) {
        this.logger.warn(`Không thể xóa trên Cloudinary: ${err.message}`);
      }
    }

    // 2. Nếu là Local: Xóa tệp trên ổ cứng
    try {
      let localPath = pathOrUrl;
      const localMarker = `/uploads/`;
      if (localPath.includes(localMarker)) {
        localPath = localPath.substring(localPath.indexOf(localMarker) + localMarker.length);
      }
      const localFile = path.join(this.uploadDir, localPath);
      if (fs.existsSync(localFile)) {
        await fs.promises.unlink(localFile);
      }
    } catch (err: any) {
      this.logger.warn(`Không thể xóa file cục bộ: ${err.message}`);
    }

    return {
      success: true,
      message: `Đã xử lý yêu cầu xóa ảnh`,
    };
  }
}
