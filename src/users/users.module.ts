import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserEventsService } from './user-events.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserEventsService],
  exports: [UsersService, UserEventsService],
})
export class UsersModule {}
