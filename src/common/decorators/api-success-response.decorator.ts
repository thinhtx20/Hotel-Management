import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export interface ApiSuccessResponseOptions<T = any> {
  status?: number;
  description?: string;
  message?: string;
  exampleData: T;
}

/**
 * Decorator Swagger hiển thị đầy đủ cấu trúc Response JSON mẫu thành công trên Swagger UI
 */
export function ApiSuccessResponse<T = any>(options: ApiSuccessResponseOptions<T>) {
  const status = options.status || 200;
  const message = options.message || 'Thành công';

  return applyDecorators(
    ApiResponse({
      status,
      description: options.description || 'Phản hồi thành công',
      schema: {
        example: {
          statusCode: status,
          success: true,
          message,
          data: options.exampleData,
          timestamp: '2026-09-03T07:00:00.000Z',
        },
      },
    }),
  );
}

export interface ApiErrorResponseOptions {
  status: number;
  description?: string;
  message: string;
  error?: string;
  errors?: string[];
  path?: string;
}

/**
 * Decorator Swagger hiển thị Response JSON mẫu khi gặp lỗi trên Swagger UI
 */
export function ApiErrorResponse(options: ApiErrorResponseOptions) {
  return applyDecorators(
    ApiResponse({
      status: options.status,
      description: options.description || 'Phản hồi lỗi',
      schema: {
        example: {
          statusCode: options.status,
          success: false,
          message: options.message,
          error: options.error || 'Bad Request',
          ...(options.errors ? { errors: options.errors } : {}),
          timestamp: '2026-09-03T07:00:00.000Z',
          path: options.path || '/api/v1/...',
        },
      },
    }),
  );
}
