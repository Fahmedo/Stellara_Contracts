import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  NotificationSettingsDto,
  UpdateNotificationSettingsDto,
  PushSubscriptionDto,
  SubscribeResponseDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings/:userId')
  @ApiOperation({
    summary: 'Get notification settings',
    description: 'Retrieves notification preferences for a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User unique identifier',
    example: 'cm3x1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings retrieved',
    type: NotificationSettingsDto,
  })
  async getSettings(@Param('userId') userId: string): Promise<NotificationSettingsDto> {
    return this.prisma.notificationSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  @Put('settings/:userId')
  @ApiOperation({
    summary: 'Update notification settings',
    description: 'Updates notification preferences for a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User unique identifier',
    example: 'cm3x1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings updated',
    type: NotificationSettingsDto,
  })
  async updateSettings(
    @Param('userId') userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    return this.prisma.notificationSetting.upsert({
      where: { userId },
      update: settings,
      create: {
        userId,
        ...settings,
      },
    });
  }

  @Post('subscribe/:userId')
  @ApiOperation({
    summary: 'Subscribe to push notifications',
    description: 'Registers a push notification subscription for a user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User unique identifier',
    example: 'cm3x1234567890',
  })
  @ApiResponse({
    status: 201,
    description: 'Push subscription registered',
    type: SubscribeResponseDto,
  })
  async subscribeToPush(
    @Param('userId') userId: string,
    @Body() subscription: PushSubscriptionDto,
  ): Promise<SubscribeResponseDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushSubscription: subscription.subscription as Prisma.InputJsonValue },
    });
    return { success: true };
  }
}
