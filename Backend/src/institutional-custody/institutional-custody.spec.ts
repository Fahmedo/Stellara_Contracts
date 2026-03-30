import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustodyService } from './services/custody.service';
import { InsuranceFundService } from './services/insurance-fund.service';
import { BeneficiaryService } from './services/beneficiary.service';
import {
  StorageTier,
  WithdrawalStatus,
  InsuranceCoverageType,
} from './dto/custody.dto';

describe('InstitutionalCustody', () => {
  let custodyService: CustodyService;
  let insuranceService: InsuranceFundService;
  let beneficiaryService: BeneficiaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustodyService, InsuranceFundService, BeneficiaryService],
    }).compile();

    custodyService = module.get(CustodyService);
    insuranceService = module.get(InsuranceFundService);
    beneficiaryService = module.get(BeneficiaryService);
  });

  // ─── Withdrawal Policy Tests ─────────────────────────────────────────────

  describe('Withdrawal Policies', () => {
    it('should create a withdrawal policy with M-of-N approvals and timelock', () => {
      const policy = custodyService.createWithdrawalPolicy({
        name: 'Standard Institutional',
        maxSingleWithdrawal: 500_000,
        maxDailyWithdrawal: 2_000_000,
        timeLockSeconds: 3600,
        whitelistedAddresses: ['GABC123', 'GDEF456'],
        requiredApprovals: 2,
        totalApprovers: 3,
      });

      expect(policy.id).toBeDefined();
      expect(policy.requiredApprovals).toBe(2);
      expect(policy.totalApprovers).toBe(3);
      expect(policy.timeLockSeconds).toBe(3600);
      expect(policy.whitelistedAddresses).toHaveLength(2);
      expect(policy.isActive).toBe(true);
    });

    it('should reject policy where requiredApprovals > totalApprovers', () => {
      expect(() =>
        custodyService.createWithdrawalPolicy({
          name: 'Invalid',
          maxSingleWithdrawal: 100_000,
          maxDailyWithdrawal: 500_000,
          timeLockSeconds: 0,
          whitelistedAddresses: [],
          requiredApprovals: 4,
          totalApprovers: 3,
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── Withdrawal Flow Tests ───────────────────────────────────────────────

  describe('Withdrawal Flow', () => {
    let policyId: string;

    beforeEach(() => {
      const policy = custodyService.createWithdrawalPolicy({
        name: 'Test Policy',
        maxSingleWithdrawal: 100_000,
        maxDailyWithdrawal: 300_000,
        timeLockSeconds: 0, // no timelock for most tests
        whitelistedAddresses: ['GDEST123'],
        requiredApprovals: 2,
        totalApprovers: 3,
      });
      policyId = policy.id;
    });

    it('should initiate a withdrawal and require M-of-N approvals', () => {
      const wd = custodyService.initiateWithdrawal({
        asset: 'XLM',
        amount: 50_000,
        destinationAddress: 'GDEST123',
        policyId,
        initiatedBy: 'user_1',
        reason: 'Client redemption',
      });

      expect(wd.id).toBeDefined();
      expect(wd.status).toBe(WithdrawalStatus.AWAITING_APPROVAL);
      expect(wd.approvals).toHaveLength(0);
    });

    it('should reject withdrawal to non-whitelisted address', () => {
      expect(() =>
        custodyService.initiateWithdrawal({
          asset: 'XLM',
          amount: 10_000,
          destinationAddress: 'GUNKNOWN',
          policyId,
          initiatedBy: 'user_1',
          reason: 'Test',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject withdrawal exceeding single limit', () => {
      expect(() =>
        custodyService.initiateWithdrawal({
          asset: 'XLM',
          amount: 200_000, // > 100_000 limit
          destinationAddress: 'GDEST123',
          policyId,
          initiatedBy: 'user_1',
          reason: 'Test',
        }),
      ).toThrow(BadRequestException);
    });

    it('should execute withdrawal after M-of-N approvals (no timelock)', () => {
      const wd = custodyService.initiateWithdrawal({
        asset: 'XLM',
        amount: 50_000,
        destinationAddress: 'GDEST123',
        policyId,
        initiatedBy: 'user_1',
        reason: 'Test',
      });

      custodyService.approveWithdrawal({ withdrawalId: wd.id, approverId: 'approver_1', signature: 'sig1' });
      const result = custodyService.approveWithdrawal({ withdrawalId: wd.id, approverId: 'approver_2', signature: 'sig2' });

      expect(result.status).toBe(WithdrawalStatus.EXECUTED);
      expect(result.executedAt).toBeDefined();
    });

    it('should time-lock withdrawal when policy has delay', () => {
      const timelockPolicy = custodyService.createWithdrawalPolicy({
        name: 'Timelock Policy',
        maxSingleWithdrawal: 100_000,
        maxDailyWithdrawal: 300_000,
        timeLockSeconds: 7200, // 2 hours
        whitelistedAddresses: ['GDEST123'],
        requiredApprovals: 1,
        totalApprovers: 2,
      });

      const wd = custodyService.initiateWithdrawal({
        asset: 'XLM',
        amount: 10_000,
        destinationAddress: 'GDEST123',
        policyId: timelockPolicy.id,
        initiatedBy: 'user_1',
        reason: 'Test',
      });

      const result = custodyService.approveWithdrawal({
        withdrawalId: wd.id,
        approverId: 'approver_1',
        signature: 'sig1',
      });

      expect(result.status).toBe(WithdrawalStatus.TIME_LOCKED);
      expect(result.executeAfter).toBeDefined();
    });

    it('should prevent duplicate approvals from same approver', () => {
      const wd = custodyService.initiateWithdrawal({
        asset: 'XLM',
        amount: 10_000,
        destinationAddress: 'GDEST123',
        policyId,
        initiatedBy: 'user_1',
        reason: 'Test',
      });

      custodyService.approveWithdrawal({ withdrawalId: wd.id, approverId: 'approver_1', signature: 'sig1' });

      expect(() =>
        custodyService.approveWithdrawal({ withdrawalId: wd.id, approverId: 'approver_1', signature: 'sig2' }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── Cold Storage Tests ──────────────────────────────────────────────────

  describe('Cold Storage', () => {
    it('should allocate funds to deep cold storage', () => {
      const allocation = custodyService.allocateColdStorage({
        asset: 'XLM',
        amount: 9_500_000,
        targetTier: StorageTier.DEEP_COLD,
        reason: 'Institutional reserve',
      });

      expect(allocation.id).toBeDefined();
      expect(allocation.tier).toBe(StorageTier.DEEP_COLD);
      expect(allocation.vaultId).toContain('deep_cold_vault');
    });

    it('should report >= 95% cold storage ratio when properly allocated', () => {
      custodyService.allocateColdStorage({ asset: 'XLM', amount: 9_500_000, targetTier: StorageTier.DEEP_COLD, reason: 'Reserve' });
      custodyService.allocateColdStorage({ asset: 'XLM', amount: 500_000, targetTier: StorageTier.HOT, reason: 'Liquidity' });

      const ratio = custodyService.getColdStorageRatio('XLM');

      expect(ratio.coldRatio).toBeCloseTo(0.95, 2);
      expect(ratio.meetsRequirement).toBe(true);
    });

    it('should flag non-compliant cold storage ratio', () => {
      custodyService.allocateColdStorage({ asset: 'USDC', amount: 5_000_000, targetTier: StorageTier.HOT, reason: 'Liquidity' });
      custodyService.allocateColdStorage({ asset: 'USDC', amount: 5_000_000, targetTier: StorageTier.COLD, reason: 'Reserve' });

      const ratio = custodyService.getColdStorageRatio('USDC');

      expect(ratio.coldRatio).toBeCloseTo(0.5, 2);
      expect(ratio.meetsRequirement).toBe(false);
    });
  });

  // ─── Proof of Reserves Tests ─────────────────────────────────────────────

  describe('Proof of Reserves', () => {
    it('should generate cryptographic proof of reserves with Merkle root', () => {
      custodyService.allocateColdStorage({ asset: 'XLM', amount: 1_000_000, targetTier: StorageTier.COLD, reason: 'Test' });
      custodyService.allocateColdStorage({ asset: 'XLM', amount: 500_000, targetTier: StorageTier.HOT, reason: 'Test' });

      const proof = custodyService.generateProofOfReserves('XLM');

      expect(proof.totalReserves).toBe(1_500_000);
      expect(proof.merkleRoot).toBeDefined();
      expect(proof.attestation).toBeDefined();
      expect(proof.timestamp).toBeInstanceOf(Date);
    });

    it('should return zero reserves for unknown asset', () => {
      const proof = custodyService.generateProofOfReserves('UNKNOWN');
      expect(proof.totalReserves).toBe(0);
    });
  });

  // ─── Insurance Fund Tests ────────────────────────────────────────────────

  describe('Insurance Fund', () => {
    it('should report $100M+ coverage', () => {
      const status = insuranceService.getFundStatus();
      expect(status.totalCoverage).toBeGreaterThanOrEqual(100_000_000);
    });

    it('should be SOC 2 Type II compliant', () => {
      const status = insuranceService.getFundStatus();
      expect(status.socCompliant).toBe(true);
    });

    it('should include NY BitLicense in regulatory licenses', () => {
      const status = insuranceService.getFundStatus();
      expect(status.regulatoryLicenses).toContain('NY_BITLICENSE');
    });

    it('should file and process an insurance claim', () => {
      const claim = insuranceService.fileClaim({
        coverageType: InsuranceCoverageType.HACK,
        claimedAmount: 1_000_000,
        description: 'Exchange hack incident',
      });

      expect(claim.id).toBeDefined();
      expect(claim.status).toBe('OPEN');

      const resolved = insuranceService.processClaim(claim.id, true);
      expect(resolved.status).toBe('PAID');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('should generate SOC 2 compliance attestation with hash', () => {
      const attestation = insuranceService.generateComplianceAttestation();
      expect(attestation.socCompliant).toBe(true);
      expect(attestation.hash).toHaveLength(64); // SHA-256 hex
      expect(attestation.coverageAmount).toBeGreaterThanOrEqual(100_000_000);
    });
  });

  // ─── Beneficiary / Estate Planning Tests ────────────────────────────────

  describe('Beneficiary Designation', () => {
    it('should designate a beneficiary with allocation percentage', () => {
      const d = beneficiaryService.designateBeneficiary({
        accountHolderId: 'user_1',
        beneficiaryName: 'Jane Doe',
        beneficiaryAddress: 'GBEN123',
        allocationPercentage: 60,
      });

      expect(d.id).toBeDefined();
      expect(d.allocationPercentage).toBe(60);
      expect(d.isActive).toBe(true);
    });

    it('should allow multiple beneficiaries up to 100%', () => {
      beneficiaryService.designateBeneficiary({ accountHolderId: 'user_2', beneficiaryName: 'A', beneficiaryAddress: 'GA', allocationPercentage: 50 });
      beneficiaryService.designateBeneficiary({ accountHolderId: 'user_2', beneficiaryName: 'B', beneficiaryAddress: 'GB', allocationPercentage: 50 });

      const summary = beneficiaryService.getAllocationSummary('user_2');
      expect(summary.totalAllocated).toBe(100);
      expect(summary.unallocated).toBe(0);
    });

    it('should reject allocation exceeding 100%', () => {
      beneficiaryService.designateBeneficiary({ accountHolderId: 'user_3', beneficiaryName: 'A', beneficiaryAddress: 'GA', allocationPercentage: 70 });

      expect(() =>
        beneficiaryService.designateBeneficiary({ accountHolderId: 'user_3', beneficiaryName: 'B', beneficiaryAddress: 'GB', allocationPercentage: 40 }),
      ).toThrow();
    });

    it('should revoke a beneficiary designation', () => {
      const d = beneficiaryService.designateBeneficiary({
        accountHolderId: 'user_4',
        beneficiaryName: 'C',
        beneficiaryAddress: 'GC',
        allocationPercentage: 100,
      });

      beneficiaryService.revokeBeneficiary('user_4', d.id);
      const list = beneficiaryService.getBeneficiaries('user_4');
      expect(list).toHaveLength(0);
    });
  });
});
