import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum StorageTier {
  HOT = 'HOT',           // Online, immediate access
  WARM = 'WARM',         // Near-line, minutes delay
  COLD = 'COLD',         // Offline, hours delay
  DEEP_COLD = 'DEEP_COLD', // Air-gapped, 24h+ delay
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  POLICY_CHECK = 'POLICY_CHECK',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  TIME_LOCKED = 'TIME_LOCKED',
  APPROVED = 'APPROVED',
  EXECUTED = 'EXECUTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum InsuranceCoverageType {
  THEFT = 'THEFT',
  HACK = 'HACK',
  INSIDER_FRAUD = 'INSIDER_FRAUD',
  OPERATIONAL_ERROR = 'OPERATIONAL_ERROR',
  NATURAL_DISASTER = 'NATURAL_DISASTER',
}

export class CreateWithdrawalPolicyDto {
  @ApiProperty({ description: 'Policy name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Maximum single withdrawal amount in USD' })
  @IsNumber()
  @Min(0)
  maxSingleWithdrawal: number;

  @ApiProperty({ description: 'Maximum daily withdrawal amount in USD' })
  @IsNumber()
  @Min(0)
  maxDailyWithdrawal: number;

  @ApiProperty({ description: 'Time delay in seconds before execution' })
  @IsNumber()
  @Min(0)
  timeLockSeconds: number;

  @ApiProperty({ description: 'Whitelisted destination addresses' })
  @IsArray()
  @IsString({ each: true })
  whitelistedAddresses: string[];

  @ApiProperty({ description: 'Required approvals count' })
  @IsNumber()
  @Min(1)
  requiredApprovals: number;

  @ApiProperty({ description: 'Total approvers count' })
  @IsNumber()
  @Min(1)
  totalApprovers: number;
}

export class InitiateWithdrawalDto {
  @ApiProperty({ description: 'Asset to withdraw (e.g., XLM, USDC)' })
  @IsString()
  asset: string;

  @ApiProperty({ description: 'Amount to withdraw' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Destination address' })
  @IsString()
  destinationAddress: string;

  @ApiProperty({ description: 'Policy ID to apply' })
  @IsString()
  policyId: string;

  @ApiProperty({ description: 'Initiator user ID' })
  @IsString()
  initiatedBy: string;

  @ApiProperty({ description: 'Reason for withdrawal' })
  @IsString()
  reason: string;
}

export class ApproveWithdrawalDto {
  @ApiProperty({ description: 'Withdrawal request ID' })
  @IsString()
  withdrawalId: string;

  @ApiProperty({ description: 'Approver user ID' })
  @IsString()
  approverId: string;

  @ApiProperty({ description: 'Approval signature' })
  @IsString()
  signature: string;
}

export class AllocateColdStorageDto {
  @ApiProperty({ description: 'Asset to allocate' })
  @IsString()
  asset: string;

  @ApiProperty({ description: 'Amount to move to cold storage' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Target storage tier' })
  @IsEnum(StorageTier)
  targetTier: StorageTier;

  @ApiProperty({ description: 'Reason for allocation' })
  @IsString()
  reason: string;
}

export class DesignateBeneficiaryDto {
  @ApiProperty({ description: 'Account holder user ID' })
  @IsString()
  accountHolderId: string;

  @ApiProperty({ description: 'Beneficiary name' })
  @IsString()
  beneficiaryName: string;

  @ApiProperty({ description: 'Beneficiary wallet address' })
  @IsString()
  beneficiaryAddress: string;

  @ApiProperty({ description: 'Allocation percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPercentage: number;

  @ApiProperty({ description: 'Legal document reference' })
  @IsOptional()
  @IsString()
  legalDocumentRef?: string;
}

export class ProofOfReservesDto {
  @ApiProperty({ description: 'Asset to prove reserves for' })
  @IsString()
  asset: string;

  @ApiProperty({ description: 'Include cold storage balances' })
  @IsOptional()
  @IsBoolean()
  includeColdStorage?: boolean;
}
