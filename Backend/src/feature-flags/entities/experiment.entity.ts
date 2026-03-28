import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ExperimentVariant } from './experiment-variant.entity';

@Entity('experiments')
export class Experiment {
  @ApiProperty({ description: 'Unique identifier for the experiment' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Experiment key (unique identifier)' })
  @Column({ unique: true })
  key: string;

  @ApiProperty({ description: 'Human-readable experiment name' })
  @Column({ name: 'display_name' })
  displayName: string;

  @ApiProperty({ description: 'Experiment description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Experiment status' })
  @Column({
    type: 'enum',
    enum: ['draft', 'running', 'paused', 'completed', 'archived'],
    default: 'draft'
  })
  status: string;

  @ApiProperty({ description: 'Traffic allocation percentage' })
  @Column({ name: 'traffic_allocation', type: 'decimal', precision: 5, scale: 2, default: 100 })
  trafficAllocation: number;

  @ApiProperty({ description: 'Target user segments (JSON array)' })
  @Column({ name: 'target_segments', type: 'jsonb', nullable: true })
  targetSegments: string[];

  @ApiProperty({ description: 'Experiment configuration' })
  @Column({ type: 'jsonb', nullable: true })
  configuration: {
    startDate?: Date;
    endDate?: Date;
    sampleSize?: number;
    confidenceLevel?: number;
    statisticalSignificance?: number;
    primaryMetric?: string;
    secondaryMetrics?: string[];
  };

  @ApiProperty({ description: 'Hypothesis being tested' })
  @Column({ type: 'text', nullable: true })
  hypothesis: string;

  @ApiProperty({ description: 'Success criteria' })
  @Column({ name: 'success_criteria', type: 'jsonb', nullable: true })
  successCriteria: Record<string, any>;

  @ApiProperty({ description: 'Owner/team responsible' })
  @Column({ name: 'owner', nullable: true })
  owner: string;

  @ApiProperty({ description: 'Tags for categorization' })
  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @ApiProperty({ description: 'Environment (dev, staging, prod)' })
  @Column({ default: 'development' })
  environment: string;

  @ApiProperty({ description: 'Total participants count' })
  @Column({ name: 'participant_count', default: 0 })
  participantCount: number;

  @ApiProperty({ description: 'Conversion count' })
  @Column({ name: 'conversion_count', default: 0 })
  conversionCount: number;

  @OneToMany(() => ExperimentVariant, variant => variant.experiment)
  variants: ExperimentVariant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
