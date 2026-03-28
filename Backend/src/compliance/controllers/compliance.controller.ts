import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { 
  CreateKycVerificationDto, 
  UpdateKycVerificationDto, 
  CreateSanctionsCheckDto,
  CreateRiskAssessmentDto,
  ComplianceReportDto
} from '../dto/compliance.dto';
import { KycService } from '../services/kyc.service';
import { SanctionsService } from '../services/sanctions.service';
import { RiskScoringService } from '../services/risk-scoring.service';
import { ComplianceService } from '../services/compliance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComplianceController {
  constructor(
    private readonly kycService: KycService,
    private readonly sanctionsService: SanctionsService,
    private readonly riskScoringService: RiskScoringService,
    private readonly complianceService: ComplianceService,
  ) {}

  // KYC Verification Endpoints
  @Post('kyc/verify')
  @ApiOperation({ summary: 'Submit KYC verification' })
  @ApiResponse({ status: 201, description: 'KYC verification submitted successfully' })
  async createKycVerification(@Body() createKycDto: CreateKycVerificationDto) {
    return this.kycService.createKycVerification(createKycDto);
  }

  @Get('kyc/:id')
  @ApiOperation({ summary: 'Get KYC verification by ID' })
  async getKycVerification(@Param('id') id: string) {
    return this.kycService.getKycVerification(id);
  }

  @Get('kyc/user/:userId')
  @ApiOperation({ summary: 'Get user KYC verifications' })
  async getUserKycVerifications(@Param('userId') userId: string) {
    return this.kycService.getUserKycVerifications(userId);
  }

  @Put('kyc/:id')
  @ApiOperation({ summary: 'Update KYC verification status' })
  async updateKycVerification(
    @Param('id') id: string,
    @Body() updateKycDto: UpdateKycVerificationDto
  ) {
    return this.kycService.updateKycVerification(id, updateKycDto);
  }

  @Get('kyc/:userId/trading-limits')
  @ApiOperation({ summary: 'Get user trading limits based on KYC tier' })
  async getTradingLimits(@Param('userId') userId: string) {
    return this.kycService.getTradingLimits(userId);
  }

  @Post('kyc/webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process KYC provider webhook' })
  async processKycWebhook(
    @Param('provider') provider: string,
    @Body() payload: any
  ) {
    return this.kycService.processWebhook(provider, payload);
  }

  // Sanctions Screening Endpoints
  @Post('sanctions/check')
  @ApiOperation({ summary: 'Create sanctions check' })
  async createSanctionsCheck(@Body() createSanctionsDto: CreateSanctionsCheckDto) {
    return this.sanctionsService.createSanctionsCheck(createSanctionsDto);
  }

  @Get('sanctions/:id')
  @ApiOperation({ summary: 'Get sanctions check by ID' })
  async getSanctionsCheck(@Param('id') id: string) {
    return this.sanctionsService.getSanctionsCheck(id);
  }

  @Get('sanctions/user/:userId')
  @ApiOperation({ summary: 'Get user sanctions checks' })
  async getUserSanctionsChecks(@Param('userId') userId: string) {
    return this.sanctionsService.getUserSanctionsChecks(userId);
  }

  @Put('sanctions/:id/review')
  @ApiOperation({ summary: 'Review sanctions check' })
  async reviewSanctionsCheck(
    @Param('id') id: string,
    @Body() reviewData: { reviewedBy: string; reviewNotes: string; status: string }
  ) {
    return this.sanctionsService.reviewSanctionsCheck(id, reviewData);
  }

  // Risk Assessment Endpoints
  @Post('risk/assess')
  @ApiOperation({ summary: 'Create risk assessment' })
  async createRiskAssessment(@Body() createRiskDto: CreateRiskAssessmentDto) {
    return this.riskScoringService.createRiskAssessment(createRiskDto);
  }

  @Get('risk/:id')
  @ApiOperation({ summary: 'Get risk assessment by ID' })
  async getRiskAssessment(@Param('id') id: string) {
    return this.riskScoringService.getRiskAssessment(id);
  }

  @Get('risk/user/:userId')
  @ApiOperation({ summary: 'Get user risk assessments' })
  async getUserRiskAssessments(@Param('userId') userId: string) {
    return this.riskScoringService.getUserRiskAssessments(userId);
  }

  @Get('risk/user/:userId/latest')
  @ApiOperation({ summary: 'Get latest risk assessment for user' })
  async getLatestRiskAssessment(@Param('userId') userId: string) {
    return this.riskScoringService.getLatestRiskAssessment(userId);
  }

  @Put('risk/:id/override')
  @ApiOperation({ summary: 'Override risk assessment' })
  async overrideRiskAssessment(
    @Param('id') id: string,
    @Body() overrideData: { overrideReason: string; overrideBy: string; newRiskLevel?: string }
  ) {
    return this.riskScoringService.overrideRiskAssessment(id, overrideData);
  }

  // Compliance Reports Endpoints
  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate compliance report' })
  async generateComplianceReport(@Body() reportDto: ComplianceReportDto) {
    return this.complianceService.generateComplianceReport(reportDto);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get compliance report by ID' })
  async getComplianceReport(@Param('id') id: string) {
    return this.complianceService.getComplianceReport(id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get compliance reports with filters' })
  async getComplianceReports(
    @Query('reportType') reportType?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.complianceService.getComplianceReports({
      reportType,
      status,
      startDate,
      endDate,
    });
  }

  @Put('reports/:id/submit')
  @ApiOperation({ summary: 'Submit compliance report' })
  async submitReport(@Param('id') id: string) {
    return this.complianceService.submitReport(id);
  }

  @Put('reports/:id/archive')
  @ApiOperation({ summary: 'Archive compliance report' })
  async archiveReport(@Param('id') id: string) {
    return this.complianceService.archiveReport(id);
  }

  // Dashboard Endpoints
  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get compliance dashboard summary' })
  async getDashboardSummary() {
    // Mock dashboard data
    return {
      kyc: {
        totalVerifications: 1250,
        pendingVerifications: 25,
        approvalRate: 94.4,
        averageProcessingTime: '2.3 hours',
      },
      sanctions: {
        totalChecks: 1180,
        matches: 12,
        underReview: 5,
        clearanceRate: 98.9,
      },
      risk: {
        averageRiskScore: 0.25,
        highRiskUsers: 45,
        criticalRiskUsers: 8,
        recentAssessments: 156,
      },
      reports: {
        generatedThisMonth: 12,
        submittedThisMonth: 8,
        pendingReview: 4,
      },
    };
  }
}
