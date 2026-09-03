import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    const errorMessage =
      typeof message === 'object' && message !== null
        ? (message as any).message || JSON.stringify(message)
        : message;

    this.logger.error(`[${request.method}] ${request.url} - Error: ${JSON.stringify(errorMessage)}`);

    response.status(status).json({
      statusCode: status,
      success: false,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
