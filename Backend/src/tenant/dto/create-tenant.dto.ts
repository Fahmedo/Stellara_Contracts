import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiOveragePolicy, TenantPlan } from '@prisma/client';

export class TenantSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxProjects?: number;

  @IsOptional()
  @IsBoolean()
  allowPublicProjects?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  apiCallsPerMonthLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageGbLimit?: number;

  @IsOptional()
  @IsEnum(ApiOveragePolicy)
  apiOveragePolicy?: ApiOveragePolicy;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(64)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'adminWalletAddress must be a valid Stellar public key',
  })
  adminWalletAddress: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingsDto)
  settings?: TenantSettingsDto;
}
