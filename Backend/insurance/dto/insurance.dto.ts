import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsNotEmpty, Min } from 'class-validator';
import { RiskType } from '../../enums/risk-type.enum';

export class PurchasePolicyDto {
  @ApiProperty({
    description: 'User ID purchasing the policy',
    example: 'cm3x1234567890',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Insurance pool ID',
    example: 'pool_abc123',
  })
  @IsString()
  @IsNotEmpty()
  poolId: string;

  @ApiProperty({
    description: 'Type of risk being insured',
    enum: RiskType,
    example: RiskType.SMART_CONTRACT_FAILURE,
  })
  @IsEnum(RiskType)
  riskType: RiskType;

  @ApiProperty({
    description: 'Coverage amount in the base currency',
    example: 10000,
  })
  @IsNumber()
  @Min(1)
  coverageAmount: number;
}

export class InsurancePolicyDto {
  @ApiProperty({
    description: 'Policy unique identifier',
    example: 'policy_xyz789',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who owns the policy',
    example: 'cm3x1234567890',
  })
  userId: string;

  @ApiProperty({
    description: 'Insurance pool ID',
    example: 'pool_abc123',
  })
  poolId: string;

  @ApiProperty({
    description: 'Type of risk insured',
    enum: RiskType,
    example: RiskType.SMART_CONTRACT_FAILURE,
  })
  riskType: RiskType;

  @ApiProperty({
    description: 'Coverage amount',
    example: 10000,
  })
  coverageAmount: number;

  @ApiProperty({
    description: 'Policy premium',
    example: 150.50,
  })
  premium: number;

  @ApiProperty({
    description: 'Policy start date',
    example: '2024-01-15T10:30:00.000Z',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Policy end date',
    example: '2025-01-15T10:30:00.000Z',
  })
  endDate: Date;

  @ApiProperty({
    description: 'Policy status',
    example: 'ACTIVE',
  })
  status: string;
}

export class ClaimAssessmentDto {
  @ApiProperty({
    description: 'Claim unique identifier',
    example: 'claim_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Assessment result',
    example: 'APPROVED',
  })
  status: string;

  @ApiProperty({
    description: 'Assessment notes',
    example: 'Claim verified and approved for payout',
  })
  notes: string;

  @ApiProperty({
    description: 'Approved payout amount',
    example: 8500,
  })
  approvedAmount: number;
}

export class ClaimPaymentDto {
  @ApiProperty({
    description: 'Claim unique identifier',
    example: 'claim_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'PAID',
  })
  status: string;

  @ApiProperty({
    description: 'Payment transaction hash',
    example: 'tx_hash_123456789',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 8500,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  paidAt: Date;
}

export class CreateReinsuranceDto {
  @ApiProperty({
    description: 'Insurance pool ID to reinsure',
    example: 'pool_abc123',
  })
  @IsString()
  @IsNotEmpty()
  poolId: string;

  @ApiProperty({
    description: 'Coverage limit for reinsurance',
    example: 1000000,
  })
  @IsNumber()
  @Min(1)
  coverageLimit: number;

  @ApiProperty({
    description: 'Premium rate (percentage)',
    example: 2.5,
  })
  @IsNumber()
  @Min(0)
  premiumRate: number;
}

export class ReinsuranceContractDto {
  @ApiProperty({
    description: 'Reinsurance contract ID',
    example: 'reins_xyz789',
  })
  id: string;

  @ApiProperty({
    description: 'Insurance pool ID',
    example: 'pool_abc123',
  })
  poolId: string;

  @ApiProperty({
    description: 'Coverage limit',
    example: 1000000,
  })
  coverageLimit: number;

  @ApiProperty({
    description: 'Premium rate',
    example: 2.5,
  })
  premiumRate: number;

  @ApiProperty({
    description: 'Contract creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Contract status',
    example: 'ACTIVE',
  })
  status: string;
}
