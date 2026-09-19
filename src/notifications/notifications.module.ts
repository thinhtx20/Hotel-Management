import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CheckinReminderService } from './checkin-reminder.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, CheckinReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
