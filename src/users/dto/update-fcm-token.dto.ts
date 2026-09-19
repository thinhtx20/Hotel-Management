import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({
    description: 'Firebase Cloud Messaging Device Token c?a thi?t b? ngu?i dùng',
    example: 'fZ0yZ...xyz',
  })
  @IsNotEmpty({ message: 'fcmToken không du?c d? tr?ng' })
  @IsString({ message: 'fcmToken ph?i là chu?i ký t?' })
  fcmToken: string;
}
