import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config();
if (!process.env.JWT_SECRET) {
  try {
    dotenv.config({ path: resolve(process.cwd(), '.env') });
  } catch {
    // Bỏ qua nếu không tìm thấy tệp .env
  }
}

const DEFAULT_JWT_SECRET = 'super-secret-hotel-jwt-key-2026-change-in-production';
const DEFAULT_JWT_REFRESH_SECRET = 'super-secret-hotel-refresh-jwt-key-2026';

let warnedSecret = false;
let warnedRefresh = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (!warnedSecret) {
      console.warn('[Auth] CẢNH BÁO: Chưa cấu hình biến môi trường JWT_SECRET, đang sử dụng khóa bí mật mặc định.');
      warnedSecret = true;
    }
    return DEFAULT_JWT_SECRET;
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (!warnedRefresh) {
      console.warn('[Auth] CẢNH BÁO: Chưa cấu hình biến môi trường JWT_REFRESH_SECRET, đang sử dụng khóa bí mật mặc định.');
      warnedRefresh = true;
    }
    return process.env.JWT_SECRET || DEFAULT_JWT_REFRESH_SECRET;
  }
  return secret;
}

