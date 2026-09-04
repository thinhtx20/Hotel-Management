"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./prisma/prisma.module");
const redis_module_1 = require("./redis/redis.module");
const elasticsearch_module_1 = require("./elasticsearch/elasticsearch.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const room_types_module_1 = require("./room-types/room-types.module");
const rooms_module_1 = require("./rooms/rooms.module");
const bookings_module_1 = require("./bookings/bookings.module");
const invoices_module_1 = require("./invoices/invoices.module");
const analytics_module_1 = require("./analytics/analytics.module");
const mail_module_1 = require("./mail/mail.module");
const services_module_1 = require("./services/services.module");
const upload_module_1 = require("./upload/upload.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            elasticsearch_module_1.ElasticsearchModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            room_types_module_1.RoomTypesModule,
            rooms_module_1.RoomsModule,
            bookings_module_1.BookingsModule,
            invoices_module_1.InvoicesModule,
            analytics_module_1.AnalyticsModule,
            mail_module_1.MailModule,
            services_module_1.ServicesModule,
            upload_module_1.UploadModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map