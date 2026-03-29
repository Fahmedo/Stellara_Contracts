import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';

export const ENTITY_TYPES = [
  'user',
  'device',
  'email',
  'phone',
  'ip',
  'wallet',
  'ssnHash',
  'fingerprint',
  'household',
  'organization',
] as const;

export type IdentityEntityType = (typeof ENTITY_TYPES)[number];

export class IdentityEvidenceDto {
  @ApiPropertyOptional({ description: 'Canonical user ID in the platform graph' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Device identifier such as device fingerprint or client ID' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Email address or encrypted email value' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number or encrypted phone value' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'IP address observed during user interaction' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'Wallet address associated with the identity' })
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @ApiPropertyOptional({ description: 'SSN hash used for identity linking without raw PII' })
  @IsOptional()
  @IsString()
  ssnHash?: string;

  @ApiPropertyOptional({ description: 'Behavioral fingerprint identifier' })
  @IsOptional()
  @IsString()
  fingerprint?: string;

  @ApiPropertyOptional({ description: 'Household identifier for family-level resolution' })
  @IsOptional()
  @IsString()
  householdId?: string;

  @ApiPropertyOptional({ description: 'Organization identifier for corporate identity resolution' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Source system that submitted the evidence', example: 'auth-service' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class GraphEntityQueryDto {
  @ApiPropertyOptional({ description: 'Entity type to inspect', enum: ENTITY_TYPES, default: 'user' })
  @IsOptional()
  @IsIn(ENTITY_TYPES)
  entityType?: IdentityEntityType = 'user';

  @ApiPropertyOptional({ description: 'Graph traversal depth', example: 2 })
  @IsOptional()
  @IsNumber()
  depth?: number = 2;
}
