import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('kyc_verifications')
export class KycVerification {
  @ApiProperty({ description: 'Unique identifier for the KYC verification' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID being verified' })
  @Column({ name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'KYC provider (onfido, jumio, etc.)' })
  @Column({ name: 'provider' })
  provider: string;

  @ApiProperty({ description: 'Verification status' })
  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'requires_review'],
    default: 'pending'
  })
  status: string;

  @ApiProperty({ description: 'Verification type' })
  @Column({
    type: 'enum',
    enum: ['identity', 'document', 'address', 'enhanced_due_diligence']
  })
  verificationType: string;

  @ApiProperty({ description: 'Provider verification ID' })
  @Column({ name: 'provider_verification_id', nullable: true })
  providerVerificationId: string;

  @ApiProperty({ description: 'Document URLs' })
  @Column({ type: 'jsonb', nullable: true })
  documents: string[];

  @ApiProperty({ description: 'Verification metadata' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Rejection reason if applicable' })
  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @ApiProperty({ description: 'KYC tier level' })
  @Column({ name: 'kyc_tier', default: 1 })
  kycTier: number;

  @ApiProperty({ description: 'Verification completion date' })
  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @ApiProperty({ description: 'Expiry date for verification' })
  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
