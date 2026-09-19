import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { Role } from '@prisma/client';

@ApiTags('Notifications (Thông báo & Push notification)')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Lấy danh sách thông báo của người dùng hiện tại' })
  @Get()
  async getMyNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    const success = await this.notificationsService.markAllAsRead(userId);
    return { success, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notifId: string,
  ) {
    const success = await this.notificationsService.markAsRead(userId, notifId);
    return { success };
  }

  @ApiOperation({ summary: 'Bắn thông báo thử nghiệm tới tài khoản hiện tại' })
  @Post('test')
  async sendTestNotification(
    @CurrentUser('id') userId: string,
    @Body() body: { title?: string; body?: string; category?: string },
  ) {
    return this.notificationsService.sendTestNotification(
      userId,
      body?.title,
      body?.body,
      body?.category,
    );
  }

  @ApiOperation({ summary: 'Gửi thông báo tới một người dùng cụ thể' })
  @Post('send')
  async sendToUser(
    @Body()
    body: {
      userId: string;
      title: string;
      body: string;
      category?: string;
      data?: Record<string, string>;
      actionRoute?: string;
      actionLabel?: string;
    },
  ) {
    const success = await this.notificationsService.sendToUser(body.userId, {
      title: body.title,
      body: body.body,
      category: body.category,
      data: body.data,
      actionRoute: body.actionRoute,
      actionLabel: body.actionLabel,
    });
    return { success, message: success ? 'Đã gửi thông báo' : 'Gửi thất bại' };
  }

  @ApiOperation({ summary: 'Broadcast thông báo tới toàn bộ người dùng hoặc theo vai trò' })
  @Post('broadcast')
  async broadcast(
    @Body()
    body: {
      title: string;
      body: string;
      category?: string;
      role?: Role;
    },
  ) {
    return this.notificationsService.broadcast(
      {
        title: body.title,
        body: body.body,
        category: body.category,
      },
      body.role,
    );
  }
}
