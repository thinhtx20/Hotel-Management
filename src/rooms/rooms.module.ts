import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomEventsService } from './room-events.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomEventsService],
  exports: [RoomsService, RoomEventsService],
})
export class RoomsModule {}

