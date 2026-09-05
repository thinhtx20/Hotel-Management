import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface Response<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    // Route đánh dấu @SkipTransform() (vd: SSE stream) phải giữ nguyên dữ liệu gốc
    const skipTransform =
      Reflect.getMetadata(SKIP_TRANSFORM_KEY, context.getHandler()) ||
      Reflect.getMetadata(SKIP_TRANSFORM_KEY, context.getClass());
    if (skipTransform) {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        let message = 'Thành công';
        if (data && typeof data === 'object' && !Array.isArray(data) && 'message' in data) {
          if (typeof (data as any).message === 'string') {
            message = (data as any).message;
          }
        }

        return {
          statusCode,
          success: true,
          message,
          data: data !== undefined ? data : null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
