import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  StorageTier,
  WithdrawalStatus,
  CreateWithdrawalPolicyDto,
  InitiateWithdrawalDto,
  ApproveWithdrawalDto,
  AllocateColdStorageDto,
} from '../dto/custody.dto';

export interface WithdrawalPolicy {
  id: string;
  name: string;
  maxSingleWithdrawal: number;
  maxDailyWithdrawal: number;
  timeLockSeconds: number;
  whitelistedAddresses: string[];
  requiredApprovals: number;
  totalApprovers: number;
  createdAt: Date;
  isActive: boolean;
}

export interface WithdrawalRequest {
  id: string;
  asset: string;
  amount: number;
  destinationAddress: string;
  policyId: string;
  initiatedBy: string;
  reason: string;
  status: WithdrawalStatus;
  approvals: { approverId: string; signature: string; approvedAt: Date }[];
  createdAt: Date;
  executeAfter?: Date;
  executedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export interface StorageAllocation {
  id: string;
  asset: string;
  amount: number;
  tier: StorageTier;
  vaultId: string;
  allocatedAt: Date;
  lastAuditedAt?: Date;
}

@Injectable()
export class CustodyService {
  private readonly logger = new Logger(CustodyService.name);

  // In-memory stores (production: use Prisma/DB)
  private policies = new Map<string, WithdrawalPolicy>();
  private withdrawals = new Map<string, WithdrawalRequest>();
  private storageAllocations = new Map<string, StorageAllocation>();
  private dailyWithdrawalTotals = new Map<string, number>(); // asset:date -> total

  /**
   * Create a withdrawal policy with time delays, whitelists, and approval thresholds
   */
  createWithdrawalPolicy(dto: CreateWithdrawalPolicyDto): WithdrawalPolicy {
    if (dto.requiredApprovals > dto.totalApprovers) {
      throw new BadRequestException('requiredApprovals cannot exceed totalApprovers');
    }

    const policy: WithdrawalPolicy = {
      id: `policy_${randomBytes(8).toString('hex')}`,
      name: dto.name,
      maxSingleWithdrawal: dto.maxSingleWithdrawal,
      maxDailyWithdrawal: dto.maxDailyWithdrawal,
      timeLockSeconds: dto.timeLockSeconds,
      whitelistedAddresses: dto.whitelistedAddresses,
      requiredApprovals: dto.requiredApprovals,
      totalApprovers: dto.totalApprovers,
      createdAt: new Date(),
      isActive: true,
    };

    this.policies.set(policy.id, policy);
    this.logger.log(`Withdrawal policy created: ${policy.id} (${policy.name})`);
    return policy;
  }

  /**
   * Initiate a withdrawal request — validates against policy before queuing
   */
  initiateWithdrawal(dto: InitiateWithdrawalDto): WithdrawalRequest {
    const policy = this.policies.get(dto.policyId);
    if (!policy || !policy.isActive) {
      throw new NotFoundException(`Policy ${dto.policyId} not found or inactive`);
    }

    // Whitelist check
    if (
      policy.whitelistedAddresses.length > 0 &&
      !policy.whitelistedAddresses.includes(dto.destinationAddress)
    ) {
      throw new BadRequestException(
        `Destination ${dto.destinationAddress} is not whitelisted`,
      );
    }

    // Single withdrawal limit
    if (dto.amount > policy.maxSingleWithdrawal) {
      throw new BadRequestException(
        `Amount ${dto.amount} exceeds single withdrawal limit ${policy.maxSingleWithdrawal}`,
      );
    }

    // Daily limit check
    const dailyKey = `${dto.asset}:${new Date().toISOString().slice(0, 10)}`;
    const dailyTotal = (this.dailyWithdrawalTotals.get(dailyKey) ?? 0) + dto.amount;
    if (dailyTotal > policy.maxDailyWithdrawal) {
      throw new BadRequestException(
        `Daily withdrawal limit ${policy.maxDailyWithdrawal} would be exceeded`,
      );
    }

    const executeAfter =
      policy.timeLockSeconds > 0
        ? new Date(Date.now() + policy.timeLockSeconds * 1000)
        : undefined;

    const request: WithdrawalRequest = {
      id: `wd_${randomBytes(8).toString('hex')}`,
      asset: dto.asset,
      amount: dto.amount,
      destinationAddress: dto.destinationAddress,
      policyId: dto.policyId,
      initiatedBy: dto.initiatedBy,
      reason: dto.reason,
      status: WithdrawalStatus.AWAITING_APPROVAL,
      approvals: [],
      createdAt: new Date(),
      executeAfter,
    };

    this.withdrawals.set(request.id, request);
    this.logger.log(
      `Withdrawal initiated: ${request.id}, amount: ${dto.amount} ${dto.asset}`,
    );
    return request;
  }

  /**
   * Approve a withdrawal — executes once M-of-N approvals are collected and timelock passes
   */
  approveWithdrawal(dto: ApproveWithdrawalDto): WithdrawalRequest {
    const request = this.withdrawals.get(dto.withdrawalId);
    if (!request) {
      throw new NotFoundException(`Withdrawal ${dto.withdrawalId} not found`);
    }

    if (
      request.status !== WithdrawalStatus.AWAITING_APPROVAL &&
      request.status !== WithdrawalStatus.TIME_LOCKED
    ) {
      throw new BadRequestException(`Withdrawal is not pending approval`);
    }

    // Prevent duplicate approvals
    if (request.approvals.some(a => a.approverId === dto.approverId)) {
      throw new BadRequestException(`Approver ${dto.approverId} already approved`);
    }

    request.approvals.push({
      approverId: dto.approverId,
      signature: dto.signature,
      approvedAt: new Date(),
    });

    const policy = this.policies.get(request.policyId)!;

    if (request.approvals.length >= policy.requiredApprovals) {
      if (request.executeAfter && request.executeAfter > new Date()) {
        request.status = WithdrawalStatus.TIME_LOCKED;
        this.logger.log(
          `Withdrawal ${request.id} approved, time-locked until ${request.executeAfter}`,
        );
      } else {
        this.executeWithdrawal(request);
      }
    }

    return request;
  }

  /**
   * Execute a time-locked withdrawal after the delay has passed
   */
  executeTimeLocked(withdrawalId: string): WithdrawalRequest {
    const request = this.withdrawals.get(withdrawalId);
    if (!request) throw new NotFoundException(`Withdrawal ${withdrawalId} not found`);

    if (request.status !== WithdrawalStatus.TIME_LOCKED) {
      throw new BadRequestException(`Withdrawal is not in TIME_LOCKED state`);
    }

    if (request.executeAfter && request.executeAfter > new Date()) {
      throw new BadRequestException(
        `Timelock has not expired. Execute after: ${request.executeAfter}`,
      );
    }

    return this.executeWithdrawal(request);
  }

  /**
   * Allocate funds to cold storage tiers (95% target in COLD/DEEP_COLD)
   */
  allocateColdStorage(dto: AllocateColdStorageDto): StorageAllocation {
    const allocation: StorageAllocation = {
      id: `vault_${randomBytes(8).toString('hex')}`,
      asset: dto.asset,
      amount: dto.amount,
      tier: dto.targetTier,
      vaultId: this.assignVaultId(dto.targetTier),
      allocatedAt: new Date(),
    };

    this.storageAllocations.set(allocation.id, allocation);
    this.logger.log(
      `Allocated ${dto.amount} ${dto.asset} to ${dto.targetTier} storage (vault: ${allocation.vaultId})`,
    );
    return allocation;
  }

  /**
   * Real-time proof of reserves — cryptographic attestation of holdings
   */
  generateProofOfReserves(asset: string): {
    asset: string;
    totalReserves: number;
    breakdown: Record<StorageTier, number>;
    merkleRoot: string;
    timestamp: Date;
    attestation: string;
  } {
    const allocations = Array.from(this.storageAllocations.values()).filter(
      a => a.asset === asset,
    );

    const breakdown: Record<StorageTier, number> = {
      [StorageTier.HOT]: 0,
      [StorageTier.WARM]: 0,
      [StorageTier.COLD]: 0,
      [StorageTier.DEEP_COLD]: 0,
    };

    allocations.forEach(a => {
      breakdown[a.tier] += a.amount;
    });

    const totalReserves = Object.values(breakdown).reduce((s, v) => s + v, 0);

    // Build Merkle root over allocation IDs + amounts for tamper-evident proof
    const leaves = allocations.map(a =>
      createHash('sha256').update(`${a.id}:${a.amount}`).digest('hex'),
    );
    const merkleRoot = this.buildMerkleRoot(leaves);

    const attestation = createHash('sha256')
      .update(`${asset}:${totalReserves}:${merkleRoot}:${Date.now()}`)
      .digest('hex');

    this.logger.log(`Proof of reserves generated for ${asset}: total=${totalReserves}`);

    return {
      asset,
      totalReserves,
      breakdown,
      merkleRoot,
      timestamp: new Date(),
      attestation,
    };
  }

  /**
   * Get cold storage ratio — should be >= 95% for institutional compliance
   */
  getColdStorageRatio(asset: string): {
    coldRatio: number;
    hotRatio: number;
    meetsRequirement: boolean;
  } {
    const proof = this.generateProofOfReserves(asset);
    const cold = proof.breakdown[StorageTier.COLD] + proof.breakdown[StorageTier.DEEP_COLD];
    const coldRatio = proof.totalReserves > 0 ? cold / proof.totalReserves : 0;

    return {
      coldRatio,
      hotRatio: 1 - coldRatio,
      meetsRequirement: coldRatio >= 0.95,
    };
  }

  getWithdrawal(id: string): WithdrawalRequest {
    const w = this.withdrawals.get(id);
    if (!w) throw new NotFoundException(`Withdrawal ${id} not found`);
    return w;
  }

  getPolicy(id: string): WithdrawalPolicy {
    const p = this.policies.get(id);
    if (!p) throw new NotFoundException(`Policy ${id} not found`);
    return p;
  }

  listPolicies(): WithdrawalPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.isActive);
  }

  listStorageAllocations(asset?: string): StorageAllocation[] {
    const all = Array.from(this.storageAllocations.values());
    return asset ? all.filter(a => a.asset === asset) : all;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private executeWithdrawal(request: WithdrawalRequest): WithdrawalRequest {
    // Update daily total
    const dailyKey = `${request.asset}:${new Date().toISOString().slice(0, 10)}`;
    const prev = this.dailyWithdrawalTotals.get(dailyKey) ?? 0;
    this.dailyWithdrawalTotals.set(dailyKey, prev + request.amount);

    request.status = WithdrawalStatus.EXECUTED;
    request.executedAt = new Date();

    this.logger.log(
      `Withdrawal executed: ${request.id}, ${request.amount} ${request.asset} -> ${request.destinationAddress}`,
    );
    return request;
  }

  private assignVaultId(tier: StorageTier): string {
    const prefix: Record<StorageTier, string> = {
      [StorageTier.HOT]: 'hot_vault',
      [StorageTier.WARM]: 'warm_vault',
      [StorageTier.COLD]: 'cold_vault',
      [StorageTier.DEEP_COLD]: 'deep_cold_vault',
    };
    return `${prefix[tier]}_${randomBytes(4).toString('hex')}`;
  }

  private buildMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) return createHash('sha256').update('empty').digest('hex');
    if (leaves.length === 1) return leaves[0];

    let level = [...leaves];
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] ?? left;
        next.push(createHash('sha256').update(left + right).digest('hex'));
      }
      level = next;
    }
    return level[0];
  }
}
