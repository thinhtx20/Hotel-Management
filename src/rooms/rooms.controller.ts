import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Header,
  MessageEvent,
  Sse,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Observable, interval, map, merge, of } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { RoomsService } from './rooms.service';
import { RoomEventsService } from './room-events.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto, UpdateRoomStatusDto } from './dto/update-room.dto';
import { QueryAvailableRoomsDto } from './dto/query-available-rooms.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { SearchRoomDto } from './dto/search-room.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role, RoomStatus } from '@prisma/client';

const SAMPLE_ROOM = {
  id: '3f6c8d20-41ab-4f27-96a8-208935cba48b',
  roomNumber: '101',
  floor: 1,
  status: 'AVAILABLE',
  roomTypeId: 'd9e03d76-e17f-4f05-896c-b3a167cf7564',
  roomTypeName: 'Phòng Deluxe Hướng Biển',
  roomTypeCode: 'DELUXE_OCEAN',
  description: 'Phòng cao cấp ngắm trọn bình minh trên biển',
  pricePerNight: 1200000,
  image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  images: [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  ],
  amenities: ['Wifi tốc độ cao', 'Ban công view biển', 'Bồn tắm nằm', 'Smart TV 55 inch'],
  capacityAdults: 2,
  capacityChildren: 1,
  sizeSqM: 38,
};

@ApiTags('Rooms (Quản lý Phòng & Tìm kiếm)')
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomEvents: RoomEventsService,
  ) {}

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CUSTOMER)
  @Post()
  @ApiOperation({
    summary: 'Tạo phòng mới (Admin tạo duyệt thẳng, vai trò khác tạo bản chờ duyệt PENDING_APPROVAL)',
    description:
      'ADMIN tạo phòng sẽ vào hoạt động ngay (AVAILABLE). RECEPTIONIST / CUSTOMER tạo ra bản ghi ở trạng thái ' +
      'PENDING_APPROVAL, phải được duyệt qua PATCH /rooms/:id/approve mới hiển thị đón khách.',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo phòng mới thành công',
    exampleData: SAMPLE_ROOM,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Số phòng 101 đã tồn tại',
    error: 'Conflict',
    path: '/api/v1/rooms',
  })
  create(@Body() createRoomDto: CreateRoomDto, @CurrentUser() user?: any) {
    if (user && user.role !== Role.ADMIN) {
      createRoomDto.status = RoomStatus.PENDING_APPROVAL;
    }
    return this.roomsService.create(createRoomDto);
  }

  // Luồng realtime SSE: client nhận sự kiện tức thời khi trạng thái phòng thay đổi
  @Public()
  @UseGuards(JwtAuthGuard)
  @Sse('stream')
  @SkipTransform()
  @Header('X-Accel-Buffering', 'no')
  @ApiOperation({
    summary: 'Luồng realtime trạng thái phòng (SSE) — tự cập nhật khi phòng đổi trạng thái',
    description:
      'Trả về `text/event-stream`. Client (Web Lễ tân / Mobile App) mở kết nối một lần và nhận sự kiện ngay khi ' +
      'phòng chuyển trạng thái (Trống -> Đang ở -> Dọn dẹp -> Bảo trì, v.v.) mà không cần F5 hoặc gọi lại `GET /rooms`.\n\n' +
      '**Tên sự kiện:** `ready` (kết nối thành công), `ping` (giữ kết nối mỗi 20s), ' +
      '`room.status_changed` (đổi trạng thái), `room.created` (phòng mới), `room.updated` (sửa thông tin), `room.deleted` (xóa phòng).\n\n' +
      '**Xác thực:** Chấp nhận token qua query: `GET /api/v1/rooms/stream?token=<accessToken>` hoặc header Bearer token.\n\n' +
      '**Phân quyền tự động:** Nhân viên (ADMIN / RECEPTIONIST) nhận đầy đủ sự kiện kể cả PENDING_APPROVAL và REJECTED. ' +
      'Khách hàng / khách vãng lai chỉ nhận các trạng thái phòng vận hành thông thường.\n\n' +
      '**Ví dụ (FE):**\n' +
      '```js\n' +
      "const es = new EventSource(`${API}/rooms/stream?token=${accessToken}`);\n" +
      "es.addEventListener('room.status_changed', (e) => {\n" +
      '  const { room } = JSON.parse(e.data);\n' +
      '  console.log(`Phòng ${room.roomNumber} đổi trạng thái thành ${room.status}`);\n' +
      '  updateRoomStatusInUI(room.id, room.status);\n' +
      '});\n' +
      '```',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Access token dành cho EventSource (không gửi được header Authorization)',
  })
  stream(@CurrentUser() user?: any): Observable<MessageEvent> {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;

    const ready$ = of<MessageEvent>({
      type: 'ready',
      retry: 5000,
      data: {
        message: 'Đã kết nối luồng cập nhật trạng thái phòng realtime',
        at: new Date().toISOString(),
      },
    });

    const ping$ = interval(20000).pipe(
      map<number, MessageEvent>(() => ({
        type: 'ping',
        data: { at: new Date().toISOString() },
      })),
    );

    const changes$ = this.roomEvents.stream().pipe(
      filter((event) => {
        if (isStaff) return true;
        // Khách hàng / khách vãng lai không nhận thông tin phòng chờ duyệt / bị từ chối
        const status = event.room?.status;
        return status !== RoomStatus.PENDING_APPROVAL && status !== RoomStatus.REJECTED;
      }),
      map<any, MessageEvent>((event) => ({
        type: event.type,
        data: event,
      })),
    );

    return merge(ready$, changes$, ping$);
  }

  // @Public() + JwtAuthGuard = xác thực tùy chọn: khách vãng lai không cần đăng nhập vẫn gọi được,
  // nhưng nếu có Bearer token thì req.user được nạp để nhận diện nhân viên.
  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm phòng Full-Text siêu tốc bằng Elasticsearch (Fuzzy match, tiện ích, khoảng giá)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Tìm kiếm danh sách phòng thành công',
    exampleData: [SAMPLE_ROOM],
  })
  search(@Query() searchDto: SearchRoomDto, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.search(searchDto, isStaff);
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('available')
  @ApiOperation({ summary: 'Tìm kiếm danh sách phòng trống theo khoảng thời gian đặt phòng (Redis Caching)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách phòng trống thành công',
    exampleData: [SAMPLE_ROOM],
  })
  findAvailable(@Query() query: QueryAvailableRoomsDto, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findAvailable(query, isStaff);
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tất cả phòng kèm bộ lọc trạng thái/tầng/hạng phòng & phân trang',
    description:
      'Khách vãng lai và khách hàng chỉ thấy phòng đang vận hành. Phòng ở trạng thái ' +
      'PENDING_APPROVAL / REJECTED chỉ hiện với ADMIN và RECEPTIONIST (gửi kèm Bearer token). ' +
      'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách tất cả phòng thành công',
    exampleData: {
      data: [SAMPLE_ROOM],
      meta: { total: 20, page: 1, limit: 20, totalPages: 1 },
    },
  })
  findAll(
    @Query() query: QueryRoomsDto,
    @CurrentUser() user?: any,
  ) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findAll(query, isStaff);
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết thông tin một phòng (Công khai cho khách vãng lai)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem chi tiết thông tin phòng thành công',
    exampleData: SAMPLE_ROOM,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy phòng với ID: 3f6c8d20-41ab-4f27-96a8-208935cba48b',
    error: 'Not Found',
    path: '/api/v1/rooms/3f6c8d20-41ab-4f27-96a8-208935cba48b',
  })
  findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const isStaff = user?.role === Role.ADMIN || user?.role === Role.RECEPTIONIST;
    return this.roomsService.findOne(id, isStaff);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Phê duyệt phòng mới vào hoạt động' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Phê duyệt phòng thành công',
    exampleData: { ...SAMPLE_ROOM, status: 'AVAILABLE' },
  })
  approve(@Param('id') id: string) {
    return this.roomsService.updateStatus(id, RoomStatus.AVAILABLE);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Từ chối duyệt phòng mới' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Từ chối duyệt phòng thành công',
    exampleData: { ...SAMPLE_ROOM, status: 'REJECTED' },
  })
  reject(@Param('id') id: string) {
    return this.roomsService.updateStatus(id, RoomStatus.REJECTED);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('sync-status')
  @ApiOperation({
    summary: 'Rà soát & đồng bộ trạng thái toàn bộ phòng theo lịch đặt phòng thực tế',
    description:
      'Chữa dữ liệu lệch giữa room.status và booking: phòng OCCUPIED nhưng không có đơn CHECKED_IN, ' +
      'hoặc phòng RESERVED nhưng đơn giữ chỗ đã bị hủy. Quy tắc suy diễn: có đơn CHECKED_IN -> OCCUPIED; ' +
      'có đơn CONFIRMED chưa tới ngày trả -> RESERVED; còn lại -> AVAILABLE. ' +
      'Phòng MAINTENANCE / PENDING_APPROVAL / REJECTED được giữ nguyên vì do người vận hành đặt tay.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Đồng bộ trạng thái phòng thành công',
    exampleData: {
      message: 'Đã đồng bộ lại trạng thái cho 5/20 phòng',
      totalRooms: 20,
      updatedCount: 5,
      changes: [
        { roomNumber: '103', from: 'OCCUPIED', to: 'AVAILABLE' },
        { roomNumber: '201', from: 'OCCUPIED', to: 'AVAILABLE' },
      ],
    },
  })
  syncStatus() {
    return this.roomsService.syncAllStatuses();
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật nhanh trạng thái phòng (Trống, Đang ở, Dọn dẹp, Bảo trì)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật trạng thái phòng thành công',
    exampleData: { ...SAMPLE_ROOM, status: 'CLEANING' },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateStatus(id, dto.status);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật thông tin phòng thành công',
    exampleData: SAMPLE_ROOM,
  })
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomsService.update(id, updateRoomDto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phòng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xóa phòng thành công',
    exampleData: { id: '3f6c8d20-41ab-4f27-96a8-208935cba48b', roomNumber: '101' },
  })
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
