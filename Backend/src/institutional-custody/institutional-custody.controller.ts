import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CustodyService } from './services/custody.service';
import { InsuranceFundService } from './services/insurance-fund.service';
import { BeneficiaryService } from './services/beneficiary.service';
import {
  CreateWithdrawalPolicyDto,
  InitiateWithdrawalDto,
  ApproveWithdrawalDto,
  AllocateColdStorageDto,
  DesignateBeneficiaryDto,
  InsuranceCoverageType,
} from './dto/custody.dto';

@ApiTags('Institutional Custody')
@Controller('custody')
export class InstitutionalCustodyController {
  constructor(
    private readonly custodyService: CustodyService,
    private readonly insuranceService: InsuranceFundService,
    private readonly beneficiaryService: BeneficiaryService,
  ) {}

  // ─── Withdrawal Policies ────────────────────────────────────────────────────

  @Post('policies')
  @ApiOperation({ summary: 'Create withdrawal policy with time delays, whitelists, and M-of-N approvals' })
  @ApiResponse({ status: 201, description: 'Policy created' })
  createPolicy(@Body() dto: CreateWithdrawalPolicyDto) {
    return this.custodyService.createWithdrawalPolicy(dto);
  }

  @Get('policies')
  @ApiOperation({ summary: 'List all active withdrawal policies' })
  listPolicies() {
    return this.custodyService.listPolicies();
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get withdrawal policy by ID' })
  getPolicy(@Param('id') id: string) {
    return this.custodyService.getPolicy(id);
  }

  // ─── Withdrawals ────────────────────────────────────────────────────────────

  @Post('withdrawals')
  @ApiOperation({ summary: 'Initiate a withdrawal request (policy-validated)' })
  @ApiResponse({ status: 201, description: 'Withdrawal request created' })
  initiateWithdrawal(@Body() dto: InitiateWithdrawalDto) {
    return this.custodyService.initiateWithdrawal(dto);
  }

  @Post('withdrawals/approve')
  @ApiOperation({ summary: 'Approve a withdrawal (M-of-N multi-sig)' })
  @ApiResponse({ status: 200, description: 'Approval recorded' })
  approveWithdrawal(@Body() dto: ApproveWithdrawalDto) {
    return this.custodyService.approveWithdrawal(dto);
  }

  @Post('withdrawals/:id/execute')
  @ApiOperation({ summary: 'Execute a time-locked withdrawal after delay expires' })
  @ApiResponse({ status: 200, description: 'Withdrawal executed' })
  executeWithdrawal(@Param('id') id: string) {
    return this.custodyService.executeTimeLocked(id);
  }

  @Get('withdrawals/:id')
  @ApiOperation({ summary: 'Get withdrawal request status' })
  getWithdrawal(@Param('id') id: string) {
    return this.custodyService.getWithdrawal(id);
  }

  // ─── Cold Storage ───────────────────────────────────────────────────────────

  @Post('cold-storage/allocate')
  @ApiOperation({ summary: 'Allocate funds to cold storage tier (target: 95% in COLD/DEEP_COLD)' })
  @ApiResponse({ status: 201, description: 'Allocation created' })
  allocateColdStorage(@Body() dto: AllocateColdStorageDto) {
    return this.custodyService.allocateColdStorage(dto);
  }

  @Get('cold-storage/ratio/:asset')
  @ApiOperation({ summary: 'Get cold storage ratio for an asset (must be >= 95%)' })
  getColdStorageRatio(@Param('asset') asset: string) {
    return this.custodyService.getColdStorageRatio(asset);
  }

  @Get('cold-storage/allocations')
  @ApiOperation({ summary: 'List storage allocations' })
  listAllocations(@Query('asset') asset?: string) {
    return this.custodyService.listStorageAllocations(asset);
  }

  // ─── Proof of Reserves ──────────────────────────────────────────────────────

  @Get('proof-of-reserves/:asset')
  @ApiOperation({ summary: 'Generate real-time cryptographic proof of reserves' })
  @ApiResponse({ status: 200, description: 'Merkle-attested proof of reserves' })
  getProofOfReserves(@Param('asset') asset: string) {
    return this.custodyService.generateProofOfReserves(asset);
  }

  // ─── Insurance Fund ─────────────────────────────────────────────────────────

  @Get('insurance/status')
  @ApiOperation({ summary: 'Get insurance fund status ($100M+ coverage)' })
  getInsuranceStatus() {
    return this.insuranceService.getFundStatus();
  }

  @Get('insurance/compliance')
  @ApiOperation({ summary: 'Get SOC 2 Type II compliance attestation and regulatory licenses' })
  getComplianceAttestation() {
    return this.insuranceService.generateComplianceAttestation();
  }

  @Post('insurance/claims')
  @ApiOperation({ summary: 'File an insurance claim' })
  @ApiResponse({ status: 201, description: 'Claim filed' })
  fileClaim(
    @Body()
    body: {
      coverageType: InsuranceCoverageType;
      claimedAmount: number;
      description: string;
    },
  ) {
    return this.insuranceService.fileClaim(body);
  }

  @Post('insurance/claims/:id/process')
  @ApiOperation({ summary: 'Process (approve/reject) an insurance claim' })
  processClaim(@Param('id') id: string, @Body() body: { approved: boolean }) {
    return this.insuranceService.processClaim(id, body.approved);
  }

  @Get('insurance/claims')
  @ApiOperation({ summary: 'List all insurance claims' })
  listClaims() {
    return this.insuranceService.listClaims();
  }

  // ─── Beneficiary / Estate Planning ──────────────────────────────────────────

  @Post('beneficiaries')
  @ApiOperation({ summary: 'Designate a beneficiary for estate planning' })
  @ApiResponse({ status: 201, description: 'Beneficiary designated' })
  designateBeneficiary(@Body() dto: DesignateBeneficiaryDto) {
    return this.beneficiaryService.designateBeneficiary(dto);
  }

  @Get('beneficiaries/:accountHolderId')
  @ApiOperation({ summary: 'Get beneficiaries for an account holder' })
  getBeneficiaries(@Param('accountHolderId') accountHolderId: string) {
    return this.beneficiaryService.getBeneficiaries(accountHolderId);
  }

  @Get('beneficiaries/:accountHolderId/summary')
  @ApiOperation({ summary: 'Get allocation summary for estate planning' })
  getAllocationSummary(@Param('accountHolderId') accountHolderId: string) {
    return this.beneficiaryService.getAllocationSummary(accountHolderId);
  }

  @Post('beneficiaries/:accountHolderId/revoke/:designationId')
  @ApiOperation({ summary: 'Revoke a beneficiary designation' })
  revokeBeneficiary(
    @Param('accountHolderId') accountHolderId: string,
    @Param('designationId') designationId: string,
  ) {
    this.beneficiaryService.revokeBeneficiary(accountHolderId, designationId);
    return { message: 'Beneficiary revoked successfully' };
  }
}
