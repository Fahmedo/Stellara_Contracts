import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAUSED', 'DISABLED'] as const;
const DELIVERY_STATUSES = ['PENDING', 'RETRYING', 'DELIVERED', 'FAILED'] as const;

export class CreateWebhookSubscriptionDto {
  @ApiProperty({ example: 'Project lifecycle events' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Sends project and contribution updates to CRM.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'https://example.com/webhooks/stellara' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ example: 'whsec_123456789' })
  @IsString()
  secret: string;

  @ApiProperty({
    type: [String],
    example: ['project.created', 'contribution.*'],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  eventFilters: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['project.id', 'project.title', 'contribution.amount'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  payloadFields?: string[];

  @ApiPropertyOptional({
    example: { 'X-Partner-Id': 'crm-1' },
  })
  @IsOptional()
  @IsObject()
  customHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    enum: SUBSCRIPTION_STATUSES,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: (typeof SUBSCRIPTION_STATUSES)[number];

  @ApiPropertyOptional({
    example: 'tenant_123',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class UpdateWebhookSubscriptionDto {
  @ApiPropertyOptional({ example: 'Project lifecycle events' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Sends project and contribution updates to CRM.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/webhooks/stellara' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ example: 'whsec_123456789' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['project.created', 'contribution.*'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  eventFilters?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['project.id', 'project.title', 'contribution.amount'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  payloadFields?: string[];

  @ApiPropertyOptional({
    example: { 'X-Partner-Id': 'crm-1' },
  })
  @IsOptional()
  @IsObject()
  customHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    enum: SUBSCRIPTION_STATUSES,
    example: 'PAUSED',
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: (typeof SUBSCRIPTION_STATUSES)[number];
}

export class PublishWebhookEventDto {
  @ApiProperty({ example: 'project.created' })
  @IsString()
  eventType: string;

  @ApiProperty({ example: { project: { id: 'p_123', title: 'Solar Farm' } } })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ example: { actorId: 'user_1' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'platform' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'tenant_123' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class DeliveryQueryDto {
  @ApiPropertyOptional({ enum: DELIVERY_STATUSES, example: 'FAILED' })
  @IsOptional()
  @IsIn(DELIVERY_STATUSES)
  status?: (typeof DELIVERY_STATUSES)[number];

  @ApiPropertyOptional({ example: 'subscription_id' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ example: 'tenant_123' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
