import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { FeatureFlag } from './feature-flag.entity';

@Entity('feature_flag_evaluations')
export class FeatureFlagEvaluation {
  @ApiProperty({ description: 'Unique identifier for the evaluation' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Feature flag ID' })
  @Column({ name: 'feature_flag_id' })
  featureFlagId: string;

  @ApiProperty({ description: 'User ID being evaluated' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Evaluation context (JSON)' })
  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @ApiProperty({ description: 'Evaluation result (true/false)' })
  @Column({ type: 'boolean' })
  result: boolean;

  @ApiProperty({ description: 'Evaluation reason' })
  @Column({ nullable: true })
  reason: string;

  @ApiProperty({ description: 'Variant assigned (for A/B tests)' })
  @Column({ name: 'variant', nullable: true })
  variant: string;

  @ApiProperty({ description: 'User agent' })
  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @ApiProperty({ description: 'IP address' })
  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @ApiProperty({ description: 'Request ID for tracing' })
  @Column({ name: 'request_id', nullable: true })
  requestId: string;

  @ManyToOne(() => FeatureFlag, featureFlag => featureFlag.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feature_flag_id' })
  featureFlag: FeatureFlag;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
