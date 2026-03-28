import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceController } from './compliance.controller';
import { KycService } from '../services/kyc.service';
import { SanctionsService } from '../services/sanctions.service';
import { RiskScoringService } from '../services/risk-scoring.service';
import { ComplianceService } from '../services/compliance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('ComplianceController', () => {
  let controller: ComplianceController;
  let kycService: KycService;
  let sanctionsService: SanctionsService;
  let riskScoringService: RiskScoringService;
  let complianceService: ComplianceService;

  const mockKycService = {
    createKycVerification: jest.fn(),
    getKycVerification: jest.fn(),
    getUserKycVerifications: jest.fn(),
    updateKycVerification: jest.fn(),
    getTradingLimits: jest.fn(),
    processWebhook: jest.fn(),
  };

  const mockSanctionsService = {
    createSanctionsCheck: jest.fn(),
    getSanctionsCheck: jest.fn(),
    getUserSanctionsChecks: jest.fn(),
    reviewSanctionsCheck: jest.fn(),
  };

  const mockRiskScoringService = {
    createRiskAssessment: jest.fn(),
    getRiskAssessment: jest.fn(),
    getUserRiskAssessments: jest.fn(),
    getLatestRiskAssessment: jest.fn(),
    overrideRiskAssessment: jest.fn(),
  };

  const mockComplianceService = {
    generateComplianceReport: jest.fn(),
    getComplianceReport: jest.fn(),
    getComplianceReports: jest.fn(),
    submitReport: jest.fn(),
    archiveReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        { provide: KycService, useValue: mockKycService },
        { provide: SanctionsService, useValue: mockSanctionsService },
        { provide: RiskScoringService, useValue: mockRiskScoringService },
        { provide: ComplianceService, useValue: mockComplianceService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<ComplianceController>(ComplianceController);
    kycService = module.get<KycService>(KycService);
    sanctionsService = module.get<SanctionsService>(SanctionsService);
    riskScoringService = module.get<RiskScoringService>(RiskScoringService);
    complianceService = module.get<ComplianceService>(ComplianceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('KYC Verification', () => {
    it('should create KYC verification', async () => {
      const createKycDto = {
        userId: 'user-123',
        provider: 'onfido',
        verificationType: 'identity',
        documents: ['doc1.pdf'],
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          dateOfBirth: '1990-01-01',
          address: '123 Main St',
          city: 'New York',
          country: 'US',
          postalCode: '10001',
        },
      };

      const expectedResult = {
        id: 'kyc-123',
        ...createKycDto,
        status: 'pending',
        kycTier: 1,
        createdAt: new Date(),
      };

      mockKycService.createKycVerification.mockResolvedValue(expectedResult);

      const result = await controller.createKycVerification(createKycDto);

      expect(kycService.createKycVerification).toHaveBeenCalledWith(createKycDto);
      expect(result).toEqual(expectedResult);
    });

    it('should get KYC verification by ID', async () => {
      const kycId = 'kyc-123';
      const expectedResult = {
        id: kycId,
        userId: 'user-123',
        status: 'approved',
      };

      mockKycService.getKycVerification.mockResolvedValue(expectedResult);

      const result = await controller.getKycVerification(kycId);

      expect(kycService.getKycVerification).toHaveBeenCalledWith(kycId);
      expect(result).toEqual(expectedResult);
    });

    it('should get user trading limits', async () => {
      const userId = 'user-123';
      const expectedResult = {
        dailyLimit: 1000,
        monthlyLimit: 10000,
        totalLimit: 50000,
      };

      mockKycService.getTradingLimits.mockResolvedValue(expectedResult);

      const result = await controller.getTradingLimits(userId);

      expect(kycService.getTradingLimits).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Sanctions Screening', () => {
    it('should create sanctions check', async () => {
      const createSanctionsDto = {
        userId: 'user-123',
        listSource: 'ofac',
        searchCriteria: {
          fullName: 'John Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
        },
      };

      const expectedResult = {
        id: 'sanctions-123',
        ...createSanctionsDto,
        status: 'pending',
        createdAt: new Date(),
      };

      mockSanctionsService.createSanctionsCheck.mockResolvedValue(expectedResult);

      const result = await controller.createSanctionsCheck(createSanctionsDto);

      expect(sanctionsService.createSanctionsCheck).toHaveBeenCalledWith(createSanctionsDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Risk Assessment', () => {
    it('should create risk assessment', async () => {
      const createRiskDto = {
        userId: 'user-123',
        kycVerificationId: 'kyc-123',
        riskFactors: {
          kycTier: 0.2,
          sanctionsRisk: 0.1,
          transactionPattern: 0.15,
        },
      };

      const expectedResult = {
        id: 'risk-123',
        ...createRiskDto,
        riskScore: 0.15,
        riskLevel: 'low',
        createdAt: new Date(),
      };

      mockRiskScoringService.createRiskAssessment.mockResolvedValue(expectedResult);

      const result = await controller.createRiskAssessment(createRiskDto);

      expect(riskScoringService.createRiskAssessment).toHaveBeenCalledWith(createRiskDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Compliance Reports', () => {
    it('should generate compliance report', async () => {
      const reportDto = {
        reportType: 'kyc_summary',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      };

      const expectedResult = {
        id: 'report-123',
        ...reportDto,
        status: 'generated',
        content: { summary: 'KYC summary report' },
        createdAt: new Date(),
      };

      mockComplianceService.generateComplianceReport.mockResolvedValue(expectedResult);

      const result = await controller.generateComplianceReport(reportDto);

      expect(complianceService.generateComplianceReport).toHaveBeenCalledWith(reportDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Dashboard', () => {
    it('should get dashboard summary', async () => {
      const result = await controller.getDashboardSummary();

      expect(result).toHaveProperty('kyc');
      expect(result).toHaveProperty('sanctions');
      expect(result).toHaveProperty('risk');
      expect(result).toHaveProperty('reports');
      expect(result.kyc).toHaveProperty('totalVerifications');
      expect(result.kyc).toHaveProperty('approvalRate');
    });
  });
});
