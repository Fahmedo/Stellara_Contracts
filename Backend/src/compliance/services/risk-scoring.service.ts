import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RiskAssessment } from '../entities/risk-assessment.entity';
import { CreateRiskAssessmentDto } from '../dto/compliance.dto';

@Injectable()
export class RiskScoringService {
  private readonly logger = new Logger(RiskScoringService.name);

  constructor(
    @InjectRepository(RiskAssessment)
    private readonly riskAssessmentRepository: Repository<RiskAssessment>,
  ) {}

  async createRiskAssessment(createRiskDto: CreateRiskAssessmentDto): Promise<RiskAssessment> {
    try {
      // Calculate risk score based on various factors
      const riskFactors = await this.calculateRiskFactors(createRiskDto);
      const riskScore = this.calculateOverallRiskScore(riskFactors);
      const riskLevel = this.determineRiskLevel(riskScore);

      const riskAssessment = this.riskAssessmentRepository.create({
        ...createRiskDto,
        riskScore,
        riskLevel,
        riskFactors,
        modelVersion: '1.0',
        confidenceScore: this.calculateConfidenceScore(riskFactors),
        recommendations: this.generateRecommendations(riskLevel, riskFactors),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      const savedAssessment = await this.riskAssessmentRepository.save(riskAssessment);

      this.logger.log(`Risk assessment created for user ${createRiskDto.userId} with score ${riskScore}`);
      return savedAssessment;

    } catch (error) {
      this.logger.error(`Error creating risk assessment: ${error.message}`);
      throw error;
    }
  }

  private async calculateRiskFactors(createRiskDto: CreateRiskAssessmentDto): Promise<Record<string, number>> {
    const factors: Record<string, number> = {};

    // KYC verification factor (0-1, lower is better)
    if (createRiskDto.kycVerificationId) {
      factors.kycVerification = 0.1; // Low risk for verified users
    } else {
      factors.kycVerification = 0.8; // High risk for unverified users
    }

    // Geographic risk factor
    factors.geographic = 0.2; // Default low risk

    // Transaction pattern risk
    factors.transactionPattern = 0.15; // Default low risk

    // Account age factor
    factors.accountAge = 0.1; // Default low risk

    // Device risk
    factors.deviceRisk = 0.05; // Default low risk

    return factors;
  }

  private calculateOverallRiskScore(riskFactors: Record<string, number>): number {
    // Weighted sum of risk factors
    const weights = {
      kycVerification: 0.3,
      geographic: 0.2,
      transactionPattern: 0.25,
      accountAge: 0.15,
      deviceRisk: 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, score] of Object.entries(riskFactors)) {
      const weight = weights[factor] || 0;
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private determineRiskLevel(riskScore: number): string {
    if (riskScore <= 0.2) return 'low';
    if (riskScore <= 0.5) return 'medium';
    if (riskScore <= 0.8) return 'high';
    return 'critical';
  }

  private calculateConfidenceScore(riskFactors: Record<string, number>): number {
    // Higher confidence when we have more data points
    const factorCount = Object.keys(riskFactors).length;
    const maxFactors = 5;
    
    return Math.min(1, factorCount / maxFactors);
  }

  private generateRecommendations(riskLevel: string, riskFactors: Record<string, number>): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case 'low':
        recommendations.push('Standard monitoring sufficient');
        break;
      case 'medium':
        recommendations.push('Enhanced monitoring recommended');
        recommendations.push('Periodic review required');
        break;
      case 'high':
        recommendations.push('Intensive monitoring required');
        recommendations.push('Consider transaction limits');
        recommendations.push('Manual review for large transactions');
        break;
      case 'critical':
        recommendations.push('Immediate review required');
        recommendations.push('Consider account suspension');
        recommendations.push('Enhanced due diligence required');
        break;
    }

    // Specific factor-based recommendations
    if (riskFactors.kycVerification > 0.7) {
      recommendations.push('Complete KYC verification required');
    }

    if (riskFactors.geographic > 0.6) {
      recommendations.push('Geographic risk mitigation needed');
    }

    return recommendations;
  }

  async getRiskAssessment(id: string): Promise<RiskAssessment> {
    const assessment = await this.riskAssessmentRepository.findOne({ where: { id } });
    
    if (!assessment) {
      throw new Error('Risk assessment not found');
    }

    return assessment;
  }

  async getUserRiskAssessments(userId: string): Promise<RiskAssessment[]> {
    return this.riskAssessmentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLatestRiskAssessment(userId: string): Promise<RiskAssessment | null> {
    return this.riskAssessmentRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async overrideRiskAssessment(
    id: string,
    overrideData: { overrideReason: string; overrideBy: string; newRiskLevel?: string },
  ): Promise<RiskAssessment> {
    const assessment = await this.getRiskAssessment(id);

    const updateData: any = {
      manualOverride: true,
      overrideReason: overrideData.overrideReason,
      overrideBy: overrideData.overrideBy,
    };

    if (overrideData.newRiskLevel) {
      updateData.riskLevel = overrideData.newRiskLevel;
      // Adjust risk score to match new level
      updateData.riskScore = this.getRiskScoreForLevel(overrideData.newRiskLevel);
    }

    await this.riskAssessmentRepository.update(id, updateData);

    return this.getRiskAssessment(id);
  }

  private getRiskScoreForLevel(level: string): number {
    const scoreMap = {
      'low': 0.1,
      'medium': 0.35,
      'high': 0.65,
      'critical': 0.9,
    };

    return scoreMap[level] || 0.5;
  }
}
