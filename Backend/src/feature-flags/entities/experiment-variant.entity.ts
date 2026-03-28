import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Experiment } from './experiment.entity';

@Entity('experiment_variants')
export class ExperimentVariant {
  @ApiProperty({ description: 'Unique identifier for the variant' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Experiment ID' })
  @Column({ name: 'experiment_id' })
  experimentId: string;

  @ApiProperty({ description: 'Variant key (control, variant_a, variant_b, etc.)' })
  @Column({ name: 'variant_key' })
  variantKey: string;

  @ApiProperty({ description: 'Human-readable variant name' })
  @Column({ name: 'display_name' })
  displayName: string;

  @ApiProperty({ description: 'Variant description' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Traffic allocation for this variant (percentage)' })
  @Column({ name: 'traffic_allocation', type: 'decimal', precision: 5, scale: 2 })
  trafficAllocation: number;

  @ApiProperty({ description: 'Whether this is the control variant' })
  @Column({ name: 'is_control', default: false })
  isControl: boolean;

  @ApiProperty({ description: 'Variant configuration (JSON)' })
  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any>;

  @ApiProperty({ description: 'Participant count for this variant' })
  @Column({ name: 'participant_count', default: 0 })
  participantCount: number;

  @ApiProperty({ description: 'Conversion count for this variant' })
  @Column({ name: 'conversion_count', default: 0 })
  conversionCount: number;

  @ApiProperty({ description: 'Conversion rate' })
  @Column({ name: 'conversion_rate', type: 'decimal', precision: 5, scale: 4, default: 0 })
  conversionRate: number;

  @ApiProperty({ description: 'Statistical significance' })
  @Column({ name: 'statistical_significance', type: 'decimal', precision: 5, scale: 4, nullable: true })
  statisticalSignificance: number;

  @ApiProperty({ description: 'Confidence interval' })
  @Column({ name: 'confidence_interval', type: 'jsonb', nullable: true })
  confidenceInterval: {
    lower: number;
    upper: number;
  };

  @ManyToOne(() => Experiment, experiment => experiment.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'experiment_id' })
  experiment: Experiment;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
