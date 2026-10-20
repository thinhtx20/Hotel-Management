import * as dotenv from 'dotenv';
dotenv.config();

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Thiếu biến môi trường JWT_SECRET');
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('Thiếu biến môi trường JWT_REFRESH_SECRET');
  }
  return secret;
}
