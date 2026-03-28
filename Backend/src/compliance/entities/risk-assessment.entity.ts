import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('risk_assessments')
export class RiskAssessment {
  @ApiProperty({ description: 'Unique identifier for the risk assessment' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID being assessed' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'KYC verification ID' })
  @Column({ name: 'kyc_verification_id', nullable: true })
  kycVerificationId: string;

  @ApiProperty({ description: 'Overall risk score' })
  @Column({ name: 'risk_score', type: 'decimal', precision: 3, scale: 2 })
  riskScore: number;

  @ApiProperty({ description: 'Risk level' })
  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical']
  })
  riskLevel: string;

  @ApiProperty({ description: 'Risk factors and weights' })
  @Column({ type: 'jsonb' })
  riskFactors: Record<string, number>;

  @ApiProperty({ description: 'Assessment model version' })
  @Column({ name: 'model_version', default: '1.0' })
  modelVersion: string;

  @ApiProperty({ description: 'Assessment confidence' })
  @Column({ name: 'confidence_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidenceScore: number;

  @ApiProperty({ description: 'Recommended actions' })
  @Column({ type: 'jsonb', nullable: true })
  recommendations: string[];

  @ApiProperty({ description: 'Assessment expiry date' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @ApiProperty({ description: 'Manual override applied' })
  @Column({ name: 'manual_override', default: false })
  manualOverride: boolean;

  @ApiProperty({ description: 'Override reason' })
  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string;

  @ApiProperty({ description: 'Override applied by' })
  @Column({ name: 'override_by', nullable: true })
  overrideBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
