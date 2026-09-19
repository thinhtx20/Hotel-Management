import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomTypesModule } from './room-types/room-types.module';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailModule } from './mail/mail.module';
import { ServicesModule } from './services/services.module';
import { UploadModule } from './upload/upload.module';
import { ShiftsModule } from './shifts/shifts.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    ElasticsearchModule,
    AuthModule,
    UsersModule,
    RoomTypesModule,
    RoomsModule,
    BookingsModule,
    InvoicesModule,
    AnalyticsModule,
    MailModule,
    ServicesModule,
    UploadModule,
    ShiftsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
