import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Đánh dấu route không đi qua TransformInterceptor (bọc envelope statusCode/success/data).
 * Dùng cho các luồng dữ liệu thô như SSE (text/event-stream) hoặc tải file.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
