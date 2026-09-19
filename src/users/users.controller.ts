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
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '../common/decorators/api-success-response.decorator';
import { Role } from '@prisma/client';

const SAMPLE_USER = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  email: 'reception@hotel.com',
  fullName: 'LÃª Thu HÃ  (Lá»… TÃ¢n)',
  phone: '0903334455',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  role: 'RECEPTIONIST',
  isActive: true,
  createdAt: '2026-09-03T07:00:00.000Z',
};

@ApiTags('Users (Quáº£n lÃ½ ngÆ°á»i dÃ¹ng & NhÃ¢n sá»±)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userEvents: UserEventsService,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Cáº­p nháº­t thÃ´ng tin tÃ i khoáº£n hiá»‡n táº¡i (Má»¥c 03 - P1)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cáº­p nháº­t há»“ sÆ¡ thÃ nh cÃ´ng',
    exampleData: SAMPLE_USER,
  })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMeDto,
  ) {
    return this.usersService.updateMe(userId, dto);
  }

  @Patch('fcm-token')
  @ApiOperation({
    summary: 'Cập nhật FCM Token cho thiết bị người dùng',
    description: 'Lưu token thiết bị để nhận push notification thông báo trả phòng và dịch vụ',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cập nhật FCM token thành công',
    exampleData: { message: 'Cập nhật FCM token thành công', fcmToken: 'fZ0yZ...xyz' },
  })
  updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.usersService.updateFcmToken(userId, dto.fcmToken);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin táº¡o tÃ i khoáº£n nhÃ¢n viÃªn (Lá»… tÃ¢n / Thu ngÃ¢n / Admin)',
    description:
      'ÄÆ°á»ng chÃ­nh thá»©c Ä‘á»ƒ cáº¥p tÃ i khoáº£n ná»™i bá»™, thay cho viá»‡c mÆ°á»£n POST /auth/register ' +
      '(Ä‘Äƒng kÃ½ cÃ´ng khai luÃ´n Ã©p vai trÃ² CUSTOMER).',
  })
  @ApiSuccessResponse({
    status: 201,
    description: 'Táº¡o tÃ i khoáº£n nhÃ¢n viÃªn thÃ nh cÃ´ng',
    exampleData: SAMPLE_USER,
  })
  @ApiErrorResponse({
    status: 409,
    message: 'Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ trong há»‡ thá»‘ng',
    error: 'Conflict',
    path: '/api/v1/users',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({
    summary: 'Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng & phÃ¢n trang (Admin & Receptionist)',
    description:
      'Response luÃ´n cÃ³ dáº¡ng { data: [...], meta: { total, page, limit, totalPages } }; ' +
      'khÃ´ng truyá»n page/limit thÃ¬ tráº£ vá» toÃ n bá»™ káº¿t quáº£ trong data.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
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
    summary: 'Luá»“ng realtime danh sÃ¡ch tÃ i khoáº£n (SSE) â€” tá»± bÃ¡o khi cÃ³ ngÆ°á»i Ä‘Äƒng kÃ½ má»›i',
    description:
      'Tráº£ vá» `text/event-stream`. Client má»Ÿ káº¿t ná»‘i má»™t láº§n vÃ  nháº­n sá»± kiá»‡n ngay khi cÃ³ tÃ i khoáº£n má»›i, ' +
      'thay vÃ¬ pháº£i F5 hoáº·c gá»i láº¡i `GET /users`.\n\n' +
      '**TÃªn sá»± kiá»‡n:** `ready` (má»Ÿ luá»“ng thÃ nh cÃ´ng), `ping` (giá»¯ káº¿t ná»‘i má»—i 20 giÃ¢y), ' +
      '`user.created` (tÃ i khoáº£n má»›i), `user.updated` (Ä‘á»•i thÃ´ng tin / vai trÃ²), `user.deactivated` (khÃ³a tÃ i khoáº£n).\n\n' +
      '**XÃ¡c thá»±c:** `EventSource` cá»§a trÃ¬nh duyá»‡t khÃ´ng gá»­i Ä‘Æ°á»£c header `Authorization`, ' +
      'nÃªn endpoint nÃ y cháº¥p nháº­n token qua query: `GET /api/v1/users/stream?token=<accessToken>`.\n\n' +
      '**VÃ­ dá»¥ (FE):**\n' +
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
    description: 'Access token dÃ nh cho EventSource (khÃ´ng gá»­i Ä‘Æ°á»£c header Authorization)',
  })
  stream(): Observable<MessageEvent> {
    const ready$ = of<MessageEvent>({
      type: 'ready',
      retry: 5000,
      data: {
        message: 'ÄÃ£ káº¿t ná»‘i luá»“ng cáº­p nháº­t tÃ i khoáº£n',
        at: new Date().toISOString(),
      },
    });

    // Giá»¯ káº¿t ná»‘i sá»‘ng qua proxy / load balancer (Render, Nginx thÆ°á»ng ngáº¯t sau ~30-60 giÃ¢y ráº£nh)
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
  @ApiOperation({ summary: 'Chi tiáº¿t ngÆ°á»i dÃ¹ng theo ID' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Xem thÃ´ng tin chi tiáº¿t ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
    exampleData: SAMPLE_USER,
  })
  @ApiErrorResponse({
    status: 404,
    message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID tÆ°Æ¡ng á»©ng',
    error: 'Not Found',
    path: '/api/v1/users/:id',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cáº­p nháº­t thÃ´ng tin / vai trÃ² ngÆ°á»i dÃ¹ng (Chá»‰ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'Cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
    exampleData: SAMPLE_USER,
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/password')
  @Post(':id/password')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin Ä‘á»•i / Ä‘áº·t láº¡i máº­t kháº©u cho tÃ i khoáº£n ngÆ°á»i dÃ¹ng',
    description: 'Cho phÃ©p Quáº£n trá»‹ viÃªn Ä‘á»•i máº­t kháº©u cho cÃ¡c tÃ i khoáº£n khÃ¡c mÃ  khÃ´ng cáº§n biáº¿t máº­t kháº©u cÅ©.',
  })
  @ApiSuccessResponse({
    status: 200,
    description: 'Äá»•i máº­t kháº©u tÃ i khoáº£n thÃ nh cÃ´ng',
    exampleData: {
      success: true,
      message: 'ÄÃ£ Ä‘á»•i máº­t kháº©u cho tÃ i khoáº£n LÃª Thu HÃ  (Lá»… TÃ¢n) thÃ nh cÃ´ng',
    },
  })
  @ApiErrorResponse({
    status: 400,
    message: 'Máº­t kháº©u má»›i pháº£i cÃ³ Ã­t nháº¥t 6 kÃ½ tá»±',
    error: 'Bad Request',
    path: '/api/v1/users/:id/password',
  })
  @ApiErrorResponse({
    status: 404,
    message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng vá»›i ID tÆ°Æ¡ng á»©ng',
    error: 'Not Found',
    path: '/api/v1/users/:id/password',
  })
  adminChangePassword(
    @Param('id') id: string,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.usersService.adminChangePassword(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n (Chá»‰ Admin)' })
  @ApiSuccessResponse({
    status: 200,
    description: 'VÃ´ hiá»‡u hÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng thÃ nh cÃ´ng',
    exampleData: { ...SAMPLE_USER, isActive: false },
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
