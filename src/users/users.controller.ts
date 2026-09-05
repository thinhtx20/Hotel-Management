import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Sse,
  Header,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserEventsService } from './user-events.service';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';

const SAMPLE_USER = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  email: 'reception@hotel.com',
  fullName: 'Lê Thu Hà (Lễ Tân)',
  phone: '0903334455',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  role: 'RECEPTIONIST',
  isActive: true,
  createdAt: '2026-09-03T07:00:00.000Z',
};

@ApiTags('Users (Quản lý người dùng & Nhân sự)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userEvents: UserEventsService,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin tài khoản hiện tại (Mục 03 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật hồ sơ thành công',
    exampleData: SAMPLE_USER,
  })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMeDto,
  ) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin tạo tài khoản nhân viên (Lễ tân / Thu ngân / Admin)',
    description:
      'Đường chính thức để cấp tài khoản nội bộ, thay cho việc mượn POST /auth/register ' +
      '(đăng ký công khai luôn ép vai trò CUSTOMER).',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Tạo tài khoản nhân viên thành công',
    exampleData: SAMPLE_USER,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Email này đã được đăng ký trong hệ thống',
    error: 'Conflict',
    path: '/api/v1/users',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Lấy danh sách người dùng & phân trang (Admin & Receptionist)',
    description:
      'Response luôn có dạng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'không truyền page/limit thì trả về toàn bộ kết quả trong data.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Lấy danh sách người dùng thành công',
    exampleData: {
      data: [SAMPLE_USER],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    },
  })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Sse('stream')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @SkipTransform()
  @Header('X-Accel-Buffering', 'no')
  @ApiOperation({
    summary: 'Luồng realtime danh sách tài khoản (SSE) — tự báo khi có người đăng ký mới',
    description:
      'Trả về `text/event-stream`. Client mở kết nối một lần và nhận sự kiện ngay khi có tài khoản mới, ' +
      'thay vì phải F5 hoặc gọi lại `GET /users`.\n\n' +
      '**Tên sự kiện:** `ready` (mở luồng thành công), `ping` (giữ kết nối mỗi 20 giây), ' +
      '`user.created` (tài khoản mới), `user.updated` (đổi thông tin / vai trò), `user.deactivated` (khóa tài khoản).\n\n' +
      '**Xác thực:** `EventSource` của trình duyệt không gửi được header `Authorization`, ' +
      'nên endpoint này chấp nhận token qua query: `GET /api/v1/users/stream?token=<accessToken>`.\n\n' +
      '**Ví dụ (FE):**\n' +
      '```js\n' +
      "const es = new EventSource(`${API}/users/stream?token=${accessToken}`);\n" +
      "es.addEventListener('user.created', (e) => {\n" +
      '  const { user } = JSON.parse(e.data);\n' +
      '  setUsers((prev) => [user, ...prev.filter((u) => u.id !== user.id)]);\n' +
      '});\n' +
      '```',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Access token dành cho EventSource (không gửi được header Authorization)',
  })
  stream(): Observable<MessageEvent> {
    const ready$ = of<MessageEvent>({
      type: 'ready',
      retry: 5000,
      data: {
        message: 'Đã kết nối luồng cập nhật tài khoản',
        at: new Date().toISOString(),
      },
    });

    // Giữ kết nối sống qua proxy / load balancer (Render, Nginx thường ngắt sau ~30-60 giây rảnh)
    const ping$ = interval(20000).pipe(
      map<number, MessageEvent>(() => ({
        type: 'ping',
        data: { at: new Date().toISOString() },
      })),
    );

    const changes$ = this.userEvents.stream().pipe(
      map<any, MessageEvent>((event) => ({
        type: event.type,
        data: event,
      })),
    );

    return merge(ready$, changes$, ping$);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Chi tiết người dùng theo ID' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem thông tin chi tiết người dùng thành công',
    exampleData: SAMPLE_USER,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'Không tìm thấy người dùng với ID tương ứng',
    error: 'Not Found',
    path: '/api/v1/users/:id',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin / vai trò người dùng (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật thông tin người dùng thành công',
    exampleData: SAMPLE_USER,
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Vô hiệu hóa tài khoản (Chỉ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Vô hiệu hóa tài khoản người dùng thành công',
    exampleData: { ...SAMPLE_USER, isActive: false },
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
