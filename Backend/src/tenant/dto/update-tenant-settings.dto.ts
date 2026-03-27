import { IsOptional, IsInt, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { ApiOveragePolicy } from '@prisma/client';

export class UpdateTenantSettingsDto {
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
