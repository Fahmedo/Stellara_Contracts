import { IsString, IsEnum, IsArray, IsOptional, IsNumber, IsBoolean, IsUUID, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeatureFlagDto {
  @ApiProperty({ description: 'Feature flag key (unique identifier)' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Human-readable feature name' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Feature description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Whether the feature is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({ description: 'Rollout strategy' })
  @IsOptional()
  @IsEnum(['boolean', 'percentage', 'user_segment', 'whitelist', 'gradual'])
  rolloutStrategy?: string;

  @ApiProperty({ description: 'Rollout percentage (for percentage strategy)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiProperty({ description: 'Target user segments' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSegments?: string[];

  @ApiProperty({ description: 'Whitelisted user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whitelistedUsers?: string[];

  @ApiProperty({ description: 'Blacklisted user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedUsers?: string[];

  @ApiProperty({ description: 'Gradual rollout configuration' })
  @IsOptional()
  gradualConfig?: {
    initialPercentage: number;
    finalPercentage: number;
    stepSize: number;
    stepIntervalHours: number;
    startDate: string;
    endDate?: string;
  };

  @ApiProperty({ description: 'Feature flag metadata' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Owner/team responsible' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ description: 'Whether this is a kill switch' })
  @IsOptional()
  @IsBoolean()
  isKillSwitch?: boolean;

  @ApiProperty({ description: 'Environment' })
  @IsOptional()
  @IsEnum(['development', 'staging', 'production'])
  environment?: string;
}

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Human-readable feature name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ description: 'Feature description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Whether the feature is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({ description: 'Rollout strategy' })
  @IsOptional()
  @IsEnum(['boolean', 'percentage', 'user_segment', 'whitelist', 'gradual'])
  rolloutStrategy?: string;

  @ApiProperty({ description: 'Rollout percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiProperty({ description: 'Target user segments' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSegments?: string[];

  @ApiProperty({ description: 'Whitelisted user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whitelistedUsers?: string[];

  @ApiProperty({ description: 'Blacklisted user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blacklistedUsers?: string[];

  @ApiProperty({ description: 'Gradual rollout configuration' })
  @IsOptional()
  gradualConfig?: {
    initialPercentage: number;
    finalPercentage: number;
    stepSize: number;
    stepIntervalHours: number;
    startDate: string;
    endDate?: string;
  };

  @ApiProperty({ description: 'Feature flag metadata' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Owner/team responsible' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ description: 'Whether this is a kill switch' })
  @IsOptional()
  @IsBoolean()
  isKillSwitch?: boolean;
}

export class EvaluateFeatureFlagDto {
  @ApiProperty({ description: 'Feature flag key' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Evaluation context' })
  @IsOptional()
  context?: Record<string, any>;

  @ApiProperty({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'Request ID for tracing' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class CreateExperimentDto {
  @ApiProperty({ description: 'Experiment key (unique identifier)' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Human-readable experiment name' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Experiment description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Traffic allocation percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficAllocation?: number;

  @ApiProperty({ description: 'Target user segments' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSegments?: string[];

  @ApiProperty({ description: 'Experiment configuration' })
  @IsOptional()
  configuration?: {
    startDate?: string;
    endDate?: string;
    sampleSize?: number;
    confidenceLevel?: number;
    statisticalSignificance?: number;
    primaryMetric?: string;
    secondaryMetrics?: string[];
  };

  @ApiProperty({ description: 'Hypothesis being tested' })
  @IsOptional()
  @IsString()
  hypothesis?: string;

  @ApiProperty({ description: 'Success criteria' })
  @IsOptional()
  successCriteria?: Record<string, any>;

  @ApiProperty({ description: 'Owner/team responsible' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Environment' })
  @IsOptional()
  @IsEnum(['development', 'staging', 'production'])
  environment?: string;

  @ApiProperty({ description: 'Experiment variants' })
  @IsArray()
  variants: CreateExperimentVariantDto[];
}

export class CreateExperimentVariantDto {
  @ApiProperty({ description: 'Variant key' })
  @IsString()
  variantKey: string;

  @ApiProperty({ description: 'Human-readable variant name' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Variant description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Traffic allocation for this variant (percentage)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficAllocation: number;

  @ApiProperty({ description: 'Whether this is the control variant' })
  @IsOptional()
  @IsBoolean()
  isControl?: boolean;

  @ApiProperty({ description: 'Variant configuration' })
  @IsOptional()
  configuration?: Record<string, any>;
}

export class EvaluateExperimentDto {
  @ApiProperty({ description: 'Experiment key' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Evaluation context' })
  @IsOptional()
  context?: Record<string, any>;

  @ApiProperty({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'Request ID for tracing' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class TrackConversionDto {
  @ApiProperty({ description: 'Experiment key' })
  @IsString()
  experimentKey: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Variant key' })
  @IsString()
  variantKey: string;

  @ApiProperty({ description: 'Conversion event type' })
  @IsString()
  eventType: string;

  @ApiProperty({ description: 'Conversion value' })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({ description: 'Conversion metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}
