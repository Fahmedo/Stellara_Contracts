import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { KycVerification } from '../entities/kyc-verification.entity';
import { CreateKycVerificationDto, UpdateKycVerificationDto } from '../dto/compliance.dto';
import { OnfidoService } from '../providers/onfido.service';
import { JumioService } from '../providers/jumio.service';
import { RiskScoringService } from './risk-scoring.service';
import { SanctionsService } from './sanctions.service';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycVerificationRepository: Repository<KycVerification>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly onfidoService: OnfidoService,
    private readonly jumioService: JumioService,
    private readonly riskScoringService: RiskScoringService,
    private readonly sanctionsService: SanctionsService,
  ) {}

  async createKycVerification(createKycDto: CreateKycVerificationDto): Promise<KycVerification> {
    try {
      // Check if user already has pending verification
      const existingVerification = await this.kycVerificationRepository.findOne({
        where: {
          userId: createKycDto.userId,
          status: 'pending',
          verificationType: createKycDto.verificationType,
        },
      });

      if (existingVerification) {
        throw new BadRequestException('User already has a pending verification of this type');
      }

      // Create KYC verification record
      const kycVerification = this.kycVerificationRepository.create({
        ...createKycDto,
        status: 'pending',
        kycTier: this.getInitialTier(createKycDto.verificationType),
      });

      const savedVerification = await this.kycVerificationRepository.save(kycVerification);

      // Submit to provider based on selection
      let providerResult;
      switch (createKycDto.provider) {
        case 'onfido':
          providerResult = await this.onfidoService.submitVerification(createKycDto);
          break;
        case 'jumio':
          providerResult = await this.jumioService.submitVerification(createKycDto);
          break;
        default:
          throw new BadRequestException('Unsupported KYC provider');
      }

      // Update with provider verification ID
      await this.kycVerificationRepository.update(savedVerification.id, {
        providerVerificationId: providerResult.verificationId,
        metadata: providerResult.metadata,
      });

      // Trigger sanctions check
      await this.sanctionsService.createSanctionsCheck({
        userId: createKycDto.userId,
        listSource: 'ofac',
        searchCriteria: {
          fullName: `${createKycDto.personalInfo?.firstName} ${createKycDto.personalInfo?.lastName}`,
          dateOfBirth: createKycDto.personalInfo?.dateOfBirth,
          nationality: createKycDto.personalInfo?.country,
          address: createKycDto.personalInfo?.address,
        },
      });

      this.logger.log(`KYC verification created for user ${createKycDto.userId}`);
      return savedVerification;

    } catch (error) {
      this.logger.error(`Error creating KYC verification: ${error.message}`);
      throw error;
    }
  }

  async updateKycVerification(
    id: string,
    updateKycDto: UpdateKycVerificationDto,
  ): Promise<KycVerification> {
    try {
      const kycVerification = await this.kycVerificationRepository.findOne({ where: { id } });
      
      if (!kycVerification) {
        throw new NotFoundException('KYC verification not found');
      }

      // Update verification
      await this.kycVerificationRepository.update(id, {
        ...updateKycDto,
        completedAt: updateKycDto.status === 'approved' || updateKycDto.status === 'rejected' 
          ? new Date() 
          : kycVerification.completedAt,
      });

      const updatedVerification = await this.kycVerificationRepository.findOne({ where: { id } });

      // If approved, create risk assessment
      if (updateKycDto.status === 'approved') {
        await this.riskScoringService.createRiskAssessment({
          userId: kycVerification.userId,
          kycVerificationId: id,
        });
      }

      this.logger.log(`KYC verification ${id} updated`);
      return updatedVerification;

    } catch (error) {
      this.logger.error(`Error updating KYC verification: ${error.message}`);
      throw error;
    }
  }

  async getKycVerification(id: string): Promise<KycVerification> {
    const verification = await this.kycVerificationRepository.findOne({ where: { id } });
    
    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    return verification;
  }

  async getUserKycVerifications(userId: string): Promise<KycVerification[]> {
    return this.kycVerificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getKycVerificationByProviderId(providerVerificationId: string): Promise<KycVerification> {
    return this.kycVerificationRepository.findOne({
      where: { providerVerificationId },
    });
  }

  async getTradingLimits(userId: string): Promise<Record<string, number>> {
    const latestVerification = await this.kycVerificationRepository.findOne({
      where: { userId, status: 'approved' },
      order: { completedAt: 'DESC' },
    });

    if (!latestVerification) {
      return {
        dailyLimit: 0,
        monthlyLimit: 0,
        totalLimit: 0,
      };
    }

    // Trading limits based on KYC tier
    const limits = {
      1: { daily: 1000, monthly: 10000, total: 50000 },
      2: { daily: 5000, monthly: 50000, total: 250000 },
      3: { daily: 25000, monthly: 250000, total: 1000000 },
      4: { daily: 100000, monthly: 1000000, total: 5000000 },
    };

    const tierLimits = limits[latestVerification.kycTier] || limits[1];

    return {
      dailyLimit: tierLimits.daily,
      monthlyLimit: tierLimits.monthly,
      totalLimit: tierLimits.total,
    };
  }

  private getInitialTier(verificationType: string): number {
    const tierMap = {
      'identity': 1,
      'document': 2,
      'address': 2,
      'enhanced_due_diligence': 3,
    };

    return tierMap[verificationType] || 1;
  }

  async processWebhook(provider: string, payload: any): Promise<void> {
    try {
      this.logger.log(`Processing webhook from ${provider}`);

      let verificationId: string;
      let status: string;

      switch (provider) {
        case 'onfido':
          const onfidoResult = await this.onfidoService.processWebhook(payload);
          verificationId = onfidoResult.verificationId;
          status = onfidoResult.status;
          break;
        case 'jumio':
          const jumioResult = await this.jumioService.processWebhook(payload);
          verificationId = jumioResult.verificationId;
          status = jumioResult.status;
          break;
        default:
          throw new BadRequestException('Unsupported provider webhook');
      }

      // Find verification by provider ID
      const kycVerification = await this.getKycVerificationByProviderId(verificationId);
      
      if (!kycVerification) {
        this.logger.warn(`Verification not found for provider ID: ${verificationId}`);
        return;
      }

      // Update status
      await this.updateKycVerification(kycVerification.id, { status });

      this.logger.log(`Webhook processed successfully for verification ${kycVerification.id}`);

    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      throw error;
    }
  }
}
