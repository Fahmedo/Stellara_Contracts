import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('compliance_reports')
export class ComplianceReport {
  @ApiProperty({ description: 'Unique identifier for the compliance report' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID for this report' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Report type' })
  @Column({
    type: 'enum',
    enum: ['kyc_summary', 'suspicious_activity', 'regulatory_filing', 'audit_report']
  })
  reportType: string;

  @ApiProperty({ description: 'Report status' })
  @Column({
    type: 'enum',
    enum: ['draft', 'submitted', 'reviewed', 'archived'],
    default: 'draft'
  })
  status: string;

  @ApiProperty({ description: 'Report content and findings' })
  @Column({ type: 'jsonb' })
  content: Record<string, any>;

  @ApiProperty({ description: 'Risk score associated with this report' })
  @Column({ name: 'risk_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  riskScore: number;

  @ApiProperty({ description: 'Compliance flags and warnings' })
  @Column({ type: 'jsonb', nullable: true })
  flags: string[];

  @ApiProperty({ description: 'Report period start date' })
  @Column({ name: 'period_start', nullable: true })
  periodStart: Date;

  @ApiProperty({ description: 'Report period end date' })
  @Column({ name: 'period_end', nullable: true })
  periodEnd: Date;

  @ApiProperty({ description: 'Submitted to regulatory authority' })
  @Column({ name: 'submitted_to_authority', default: false })
  submittedToAuthority: boolean;

  @ApiProperty({ description: 'Authority reference number' })
  @Column({ name: 'authority_reference', nullable: true })
  authorityReference: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
