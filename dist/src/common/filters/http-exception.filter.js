"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    constructor() {
        this.logger = new common_1.Logger(AllExceptionsFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let displayMessage = 'Đã có lỗi xảy ra trên hệ thống. Vui lòng thử lại sau.';
        let errorTitle = 'Internal Server Error';
        let errorsList = undefined;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                displayMessage = res;
                errorTitle = exception.name || 'Http Exception';
            }
            else if (typeof res === 'object' && res !== null) {
                const resObj = res;
                errorTitle = resObj.error || exception.name || 'Http Exception';
                if (Array.isArray(resObj.message)) {
                    errorsList = resObj.message;
                    displayMessage = resObj.message.join('. ');
                }
                else if (typeof resObj.message === 'string') {
                    displayMessage = resObj.message;
                }
                else {
                    displayMessage = JSON.stringify(resObj.message || res);
                }
            }
        }
        else if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            switch (exception.code) {
                case 'P2002': {
                    status = common_1.HttpStatus.CONFLICT;
                    errorTitle = 'Conflict';
                    const target = exception.meta?.target?.join(', ');
                    displayMessage = target
                        ? `Dữ liệu '${target}' đã tồn tại trong hệ thống, vui lòng kiểm tra lại.`
                        : 'Dữ liệu bị trùng lặp trong hệ thống.';
                    break;
                }
                case 'P2025': {
                    status = common_1.HttpStatus.NOT_FOUND;
                    errorTitle = 'Not Found';
                    displayMessage = 'Không tìm thấy bản ghi dữ liệu yêu cầu trong hệ thống.';
                    break;
                }
                case 'P2003': {
                    status = common_1.HttpStatus.BAD_REQUEST;
                    errorTitle = 'Bad Request';
                    displayMessage = 'Dữ liệu liên quan không hợp lệ hoặc đang được sử dụng ở bảng khác.';
                    break;
                }
                case 'P2021':
                case 'P2022': {
                    status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                    errorTitle = 'Database Schema Error';
                    const missing = exception.meta?.column ||
                        exception.meta?.table ||
                        'không xác định';
                    displayMessage =
                        `Cơ sở dữ liệu chưa được cập nhật cấu trúc mới (thiếu "${missing}"). ` +
                            `Vui lòng chạy "npx prisma db push" hoặc khởi động lại máy chủ để tự đồng bộ.`;
                    break;
                }
                default: {
                    status = common_1.HttpStatus.BAD_REQUEST;
                    errorTitle = 'Database Error';
                    displayMessage = `Lỗi thao tác cơ sở dữ liệu (${exception.code}).`;
                    break;
                }
            }
        }
        else if (exception instanceof Error) {
            status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            errorTitle = exception.name || 'Error';
            displayMessage = exception.message || 'Lỗi xử lý yêu cầu trên máy chủ.';
        }
        if (!displayMessage || typeof displayMessage !== 'string' || displayMessage.trim() === '') {
            displayMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
        }
        this.logger.error(`[${request.method}] ${request.url} - Status: ${status} - Error: ${errorTitle} - Message: ${displayMessage}`);
        if (status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
            this.logger.error(exception.message, exception.stack);
        }
        response.status(status).json({
            statusCode: status,
            success: false,
            message: displayMessage,
            error: errorTitle,
            ...(errorsList && errorsList.length > 0 ? { errors: errorsList } : {}),
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=http-exception.filter.js.map