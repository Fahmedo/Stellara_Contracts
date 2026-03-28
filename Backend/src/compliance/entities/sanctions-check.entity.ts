import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('sanctions_checks')
export class SanctionsCheck {
  @ApiProperty({ description: 'Unique identifier for the sanctions check' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID being checked' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Compliance report ID' })
  @Column({ name: 'compliance_report_id', nullable: true })
  complianceReportId: string;

  @ApiProperty({ description: 'Sanctions list source' })
  @Column({
    type: 'enum',
    enum: ['ofac', 'un', 'eu', 'hmt', 'custom']
  })
  listSource: string;

  @ApiProperty({ description: 'Check status' })
  @Column({
    type: 'enum',
    enum: ['pending', 'clear', 'match', 'partial_match', 'error'],
    default: 'pending'
  })
  status: string;

  @ApiProperty({ description: 'Match confidence score' })
  @Column({ name: 'match_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  matchScore: number;

  @ApiProperty({ description: 'Match details' })
  @Column({ type: 'jsonb', nullable: true })
  matchDetails: Record<string, any>;

  @ApiProperty({ description: 'PEP (Politically Exposed Person) status' })
  @Column({ name: 'is_pep', default: false })
  isPep: boolean;

  @ApiProperty({ description: 'Sanctions screening results' })
  @Column({ type: 'jsonb', nullable: true })
  screeningResults: Record<string, any>;

  @ApiProperty({ description: 'Manual review required' })
  @Column({ name: 'requires_review', default: false })
  requiresReview: boolean;

  @ApiProperty({ description: 'Review notes' })
  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @ApiProperty({ description: 'Reviewed by' })
  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @ApiProperty({ description: 'Review date' })
  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
