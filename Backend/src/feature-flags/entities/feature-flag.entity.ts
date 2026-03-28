import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { FeatureFlagEvaluation } from './feature-flag-evaluation.entity';

@Entity('feature_flags')
export class FeatureFlag {
  @ApiProperty({ description: 'Unique identifier for the feature flag' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Feature flag key (unique identifier)' })
  @Column({ unique: true })
  key: string;

  @ApiProperty({ description: 'Human-readable feature name' })
  @Column({ name: 'display_name' })
  displayName: string;

  @ApiProperty({ description: 'Feature description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Whether the feature is enabled' })
  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;

  @ApiProperty({ description: 'Rollout strategy' })
  @Column({
    type: 'enum',
    enum: ['boolean', 'percentage', 'user_segment', 'whitelist', 'gradual'],
    default: 'boolean'
  })
  rolloutStrategy: string;

  @ApiProperty({ description: 'Rollout percentage (for percentage strategy)' })
  @Column({ name: 'rollout_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  rolloutPercentage: number;

  @ApiProperty({ description: 'Target user segments (JSON array)' })
  @Column({ name: 'target_segments', type: 'jsonb', nullable: true })
  targetSegments: string[];

  @ApiProperty({ description: 'Whitelisted user IDs (JSON array)' })
  @Column({ name: 'whitelisted_users', type: 'jsonb', nullable: true })
  whitelistedUsers: string[];

  @ApiProperty({ description: 'Blacklisted user IDs (JSON array)' })
  @Column({ name: 'blacklisted_users', type: 'jsonb', nullable: true })
  blacklistedUsers: string[];

  @ApiProperty({ description: 'Gradual rollout configuration' })
  @Column({ name: 'gradual_config', type: 'jsonb', nullable: true })
  gradualConfig: {
    initialPercentage: number;
    finalPercentage: number;
    stepSize: number;
    stepIntervalHours: number;
    startDate: Date;
    endDate?: Date;
  };

  @ApiProperty({ description: 'Feature flag metadata' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Tags for categorization' })
  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Owner/team responsible' })
  @Column({ name: 'owner', nullable: true })
  owner: string;

  @ApiProperty({ description: 'Whether this is a kill switch' })
  @Column({ name: 'is_kill_switch', default: false })
  isKillSwitch: boolean;

  @ApiProperty({ description: 'Environment (dev, staging, prod)' })
  @Column({ default: 'development' })
  environment: string;

  @ApiProperty({ description: 'Evaluation count' })
  @Column({ name: 'evaluation_count', default: 0 })
  evaluationCount: number;

  @ApiProperty({ description: 'Last evaluated at' })
  @Column({ name: 'last_evaluated_at', nullable: true })
  lastEvaluatedAt: Date;

  @OneToMany(() => FeatureFlagEvaluation, evaluation => evaluation.featureFlag)
  evaluations: FeatureFlagEvaluation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
