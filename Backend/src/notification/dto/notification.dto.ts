import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationSettingsDto {
  @ApiProperty({
    description: 'User ID',
    example: 'cm3x1234567890',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Email notifications enabled',
    example: true,
    default: true,
  })
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Push notifications enabled',
    example: true,
    default: true,
  })
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'SMS notifications enabled',
    example: false,
    default: false,
  })
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'WebSocket notifications enabled',
    example: true,
    default: true,
  })
  websocketEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on contributions',
    example: true,
    default: true,
  })
  notifyContributions?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on milestones',
    example: true,
    default: true,
  })
  notifyMilestones?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on deadlines',
    example: true,
    default: true,
  })
  notifyDeadlines?: boolean;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Email notifications enabled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Push notifications enabled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'SMS notifications enabled',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'WebSocket notifications enabled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  websocketEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on contributions',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyContributions?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on milestones',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyMilestones?: boolean;

  @ApiPropertyOptional({
    description: 'Notify on deadlines',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  notifyDeadlines?: boolean;
}

export class PushSubscriptionDto {
  @ApiProperty({
    description: 'Push notification subscription object',
    example: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: {
        p256dh: 'user_public_key',
        auth: 'auth_secret',
      },
    },
  })
  subscription: any;
}

export class SubscribeResponseDto {
  @ApiProperty({
    description: 'Subscription success status',
    example: true,
  })
  success: boolean;
}
