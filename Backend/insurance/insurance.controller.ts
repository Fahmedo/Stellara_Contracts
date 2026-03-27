import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { RiskType } from './enums/risk-type.enum';
import { PurchasePolicyDto, InsurancePolicyDto, ClaimAssessmentDto, ClaimPaymentDto, CreateReinsuranceDto, ReinsuranceContractDto } from './dto/insurance.dto';

@ApiTags('insurance')
@ApiBearerAuth('JWT-auth')
@Controller('api/insurance')
export class InsuranceController {
  constructor(
    private readonly insurance: InsuranceService,
    private readonly claims: ClaimService,
    private readonly reinsurance: ReinsuranceService,
  ) {}

  @Post('purchase')
  @ApiOperation({ 
    summary: 'Purchase insurance policy',
    description: 'Purchases a new insurance policy for the specified user, pool, and risk type'
  })
  @ApiBody({ type: PurchasePolicyDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Policy purchased successfully',
    type: InsurancePolicyDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters' 
  })
  async purchase(@Body() body: PurchasePolicyDto) {
    return this.insurance.purchasePolicy(body.userId, body.poolId, body.riskType, body.coverageAmount);
  }

  @Post('claims/:claimId/assess')
  @ApiOperation({ 
    summary: 'Assess insurance claim',
    description: 'Assesses and evaluates an insurance claim for approval or denial'
  })
  @ApiParam({
    name: 'claimId',
    description: 'Unique claim identifier',
    example: 'claim_abc123',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Claim assessed successfully',
    type: ClaimAssessmentDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Claim not found' 
  })
  async assessClaim(@Param('claimId') claimId: string) {
    return this.claims.assessClaim(claimId);
  }

  @Post('claims/:claimId/pay')
  @ApiOperation({ 
    summary: 'Pay insurance claim',
    description: 'Processes payment for an approved insurance claim'
  })
  @ApiParam({
    name: 'claimId',
    description: 'Unique claim identifier',
    example: 'claim_abc123',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Claim paid successfully',
    type: ClaimPaymentDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Claim not found' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Claim not approved or already paid' 
  })
  async payClaim(@Param('claimId') claimId: string) {
    return this.claims.payClaim(claimId);
  }

  @Post('reinsurance')
  @ApiOperation({ 
    summary: 'Create reinsurance contract',
    description: 'Creates a new reinsurance contract for an insurance pool'
  })
  @ApiBody({ type: CreateReinsuranceDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Reinsurance contract created successfully',
    type: ReinsuranceContractDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters' 
  })
  async createReinsurance(@Body() body: CreateReinsuranceDto) {
    return this.reinsurance.createContract(body.poolId, body.coverageLimit, body.premiumRate);
  }
}
