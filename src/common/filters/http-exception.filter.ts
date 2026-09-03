import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let displayMessage = 'Đã có lỗi xảy ra trên hệ thống. Vui lòng thử lại sau.';
    let errorTitle = 'Internal Server Error';
    let errorsList: string[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        displayMessage = res;
        errorTitle = exception.name || 'Http Exception';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        errorTitle = resObj.error || exception.name || 'Http Exception';

        if (Array.isArray(resObj.message)) {
          // Lỗi từ ValidationPipe (mảng các rule bị vi phạm)
          errorsList = resObj.message;
          displayMessage = resObj.message.join('. ');
        } else if (typeof resObj.message === 'string') {
          displayMessage = resObj.message;
        } else {
          displayMessage = JSON.stringify(resObj.message || res);
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Bắt lỗi cơ sở dữ liệu Prisma để FE nhận được thông điệp thân thiện
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          errorTitle = 'Conflict';
          const target = (exception.meta?.target as string[])?.join(', ');
          displayMessage = target
            ? `Dữ liệu '${target}' đã tồn tại trong hệ thống, vui lòng kiểm tra lại.`
            : 'Dữ liệu bị trùng lặp trong hệ thống.';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          errorTitle = 'Not Found';
          displayMessage = 'Không tìm thấy bản ghi dữ liệu yêu cầu trong hệ thống.';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          errorTitle = 'Bad Request';
          displayMessage = 'Dữ liệu liên quan không hợp lệ hoặc đang được sử dụng ở bảng khác.';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          errorTitle = 'Database Error';
          displayMessage = `Lỗi thao tác cơ sở dữ liệu (${exception.code}).`;
          break;
        }
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorTitle = exception.name || 'Error';
      displayMessage = exception.message || 'Lỗi xử lý yêu cầu trên máy chủ.';
    }

    // Đảm bảo message luôn là string thân thiện, không rỗng để FE luôn hiển thị được trên SnackBar/Toast
    if (!displayMessage || typeof displayMessage !== 'string' || displayMessage.trim() === '') {
      displayMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    }

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${errorTitle} - Message: ${displayMessage}`,
    );

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
}
