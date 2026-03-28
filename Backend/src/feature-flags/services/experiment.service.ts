import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Experiment } from '../entities/experiment.entity';
import { ExperimentVariant } from '../entities/experiment-variant.entity';
import { FeatureFlagEvaluation } from '../entities/feature-flag-evaluation.entity';
import { CreateExperimentDto, CreateExperimentVariantDto, EvaluateExperimentDto, TrackConversionDto } from '../dto/feature-flag.dto';

@Injectable()
export class ExperimentService {
  private readonly logger = new Logger(ExperimentService.name);

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentVariant)
    private readonly variantRepository: Repository<ExperimentVariant>,
    @InjectRepository(FeatureFlagEvaluation)
    private readonly evaluationRepository: Repository<FeatureFlagEvaluation>,
  ) {}

  async createExperiment(createDto: CreateExperimentDto): Promise<Experiment> {
    try {
      // Check if key already exists
      const existingExperiment = await this.experimentRepository.findOne({
        where: { key: createDto.key },
      });

      if (existingExperiment) {
        throw new BadRequestException(`Experiment with key '${createDto.key}' already exists`);
      }

      // Validate variant allocations sum to 100%
      const totalAllocation = createDto.variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);
      if (Math.abs(totalAllocation - 100) > 0.01) {
        throw new BadRequestException('Variant traffic allocations must sum to 100%');
      }

      // Ensure there's exactly one control variant
      const controlVariants = createDto.variants.filter(v => v.isControl);
      if (controlVariants.length !== 1) {
        throw new BadRequestException('Experiment must have exactly one control variant');
      }

      const experiment = this.experimentRepository.create({
        ...createDto,
        status: 'draft',
        trafficAllocation: createDto.trafficAllocation ?? 100,
        environment: createDto.environment ?? 'development',
      });

      const savedExperiment = await this.experimentRepository.save(experiment);

      // Create variants
      for (const variantDto of createDto.variants) {
        const variant = this.variantRepository.create({
          experimentId: savedExperiment.id,
          ...variantDto,
        });
        await this.variantRepository.save(variant);
      }

      this.logger.log(`Experiment created: ${savedExperiment.key}`);
      return savedExperiment;

    } catch (error) {
      this.logger.error(`Error creating experiment: ${error.message}`);
      throw error;
    }
  }

  async getExperiment(id: string): Promise<Experiment> {
    const experiment = await this.experimentRepository.findOne({
      where: { id },
      relations: ['variants'],
    });
    
    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    return experiment;
  }

  async getExperimentByKey(key: string): Promise<Experiment> {
    const experiment = await this.experimentRepository.findOne({
      where: { key },
      relations: ['variants'],
    });
    
    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    return experiment;
  }

  async getAllExperiments(filters?: {
    environment?: string;
    status?: string;
    tags?: string[];
    owner?: string;
  }): Promise<Experiment[]> {
    const queryBuilder = this.experimentRepository.createQueryBuilder('experiment')
      .leftJoinAndSelect('experiment.variants', 'variants');

    if (filters?.environment) {
      queryBuilder.andWhere('experiment.environment = :environment', { environment: filters.environment });
    }

    if (filters?.status) {
      queryBuilder.andWhere('experiment.status = :status', { status: filters.status });
    }

    if (filters?.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('experiment.tags @> :tags', { tags: JSON.stringify(filters.tags) });
    }

    if (filters?.owner) {
      queryBuilder.andWhere('experiment.owner = :owner', { owner: filters.owner });
    }

    return queryBuilder.orderBy('experiment.updatedAt', 'DESC').getMany();
  }

  async updateExperimentStatus(id: string, status: string): Promise<Experiment> {
    const experiment = await this.experimentRepository.findOne({ where: { id } });
    
    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    // Validate status transitions
    const validTransitions = {
      'draft': ['running', 'archived'],
      'running': ['paused', 'completed', 'archived'],
      'paused': ['running', 'completed', 'archived'],
      'completed': ['archived'],
      'archived': [],
    };

    if (!validTransitions[experiment.status].includes(status)) {
      throw new BadRequestException(`Invalid status transition from ${experiment.status} to ${status}`);
    }

    await this.experimentRepository.update(id, { status });
    const updatedExperiment = await this.getExperiment(id);

    this.logger.log(`Experiment status updated: ${updatedExperiment.key} -> ${status}`);
    return updatedExperiment;
  }

  async evaluateExperiment(evaluateDto: EvaluateExperimentDto): Promise<{
    variant: string;
    isInExperiment: boolean;
    reason: string;
  }> {
    try {
      const experiment = await this.getExperimentByKey(evaluateDto.key);

      // Check if experiment is running
      if (experiment.status !== 'running') {
        return {
          variant: null,
          isInExperiment: false,
          reason: `Experiment is ${experiment.status}`,
        };
      }

      // Check if user is in target segments
      if (experiment.targetSegments && experiment.targetSegments.length > 0) {
        const userSegments = this.getUserSegments(evaluateDto.userId, evaluateDto.context);
        const matchingSegments = userSegments.filter(segment => 
          experiment.targetSegments.includes(segment)
        );

        if (matchingSegments.length === 0) {
          return {
            variant: null,
            isInExperiment: false,
            reason: 'User does not match target segments',
          };
        }
      }

      // Check traffic allocation
      const hash = this.hashUserId(evaluateDto.userId, experiment.key);
      if (hash * 100 > experiment.trafficAllocation) {
        return {
          variant: null,
          isInExperiment: false,
          reason: 'User is outside traffic allocation',
        };
      }

      // Assign variant based on traffic allocation
      const variant = this.assignVariant(experiment.variants, hash);

      // Update participant count
      await this.variantRepository.increment(
        { id: variant.id, experimentId: experiment.id },
        'participantCount',
        1
      );

      await this.experimentRepository.increment(
        { id: experiment.id },
        'participantCount',
        1
      );

      return {
        variant: variant.variantKey,
        isInExperiment: true,
        reason: `Assigned to variant ${variant.variantKey}`,
      };

    } catch (error) {
      this.logger.error(`Error evaluating experiment: ${error.message}`);
      throw error;
    }
  }

  async trackConversion(trackDto: TrackConversionDto): Promise<void> {
    try {
      const experiment = await this.getExperimentByKey(trackDto.experimentKey);
      const variant = await this.variantRepository.findOne({
        where: {
          experimentId: experiment.id,
          variantKey: trackDto.variantKey,
        },
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      // Update conversion counts
      await this.variantRepository.increment(
        { id: variant.id },
        'conversionCount',
        1
      );

      await this.experimentRepository.increment(
        { id: experiment.id },
        'conversionCount',
        1
      );

      // Recalculate conversion rates
      await this.recalculateConversionRates(experiment.id);

      this.logger.log(`Conversion tracked for experiment ${trackDto.experimentKey}, variant ${trackDto.variantKey}`);

    } catch (error) {
      this.logger.error(`Error tracking conversion: ${error.message}`);
      throw error;
    }
  }

  async getExperimentResults(experimentId: string): Promise<{
    experiment: Experiment;
    variants: Array<{
      variant: ExperimentVariant;
      conversionRate: number;
      statisticalSignificance?: number;
      confidenceInterval?: { lower: number; upper: number };
    }>;
    winner?: string;
    recommendations: string[];
  }> {
    const experiment = await this.getExperiment(experimentId);
    const controlVariant = experiment.variants.find(v => v.isControl);

    const results = {
      experiment,
      variants: [] as Array<{
        variant: ExperimentVariant;
        conversionRate: number;
        statisticalSignificance?: number;
        confidenceInterval?: { lower: number; upper: number };
      }>,
      winner: undefined as string,
      recommendations: [] as string[],
    };

    // Calculate results for each variant
    for (const variant of experiment.variants) {
      const conversionRate = variant.participantCount > 0 
        ? (variant.conversionCount / variant.participantCount) * 100 
        : 0;

      const variantResult = {
        variant,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };

      // Calculate statistical significance against control
      if (controlVariant && variant.id !== controlVariant.id) {
        const significance = this.calculateStatisticalSignificance(
          controlVariant.conversionCount,
          controlVariant.participantCount,
          variant.conversionCount,
          variant.participantCount
        );

        if (significance) {
          variantResult.statisticalSignificance = significance.pValue;
          variantResult.confidenceInterval = significance.confidenceInterval;
        }
      }

      results.variants.push(variantResult);
    }

    // Determine winner and generate recommendations
    if (experiment.status === 'completed' || experiment.participantCount >= 1000) {
      const sortedVariants = results.variants.sort((a, b) => b.conversionRate - a.conversionRate);
      const topVariant = sortedVariants[0];
      
      if (topVariant.variant.isControl) {
        results.recommendations.push('Control variant is performing best - consider keeping current implementation');
      } else if (topVariant.statisticalSignificance && topVariant.statisticalSignificance < 0.05) {
        results.winner = topVariant.variant.variantKey;
        results.recommendations.push(`${topVariant.variant.displayName} is statistically significant winner with ${topVariant.conversionRate}% conversion rate`);
      } else {
        results.recommendations.push(`${topVariant.variant.displayName} has highest conversion rate but results are not statistically significant`);
      }
    }

    return results;
  }

  private assignVariant(variants: ExperimentVariant[], userHash: number): ExperimentVariant {
    let cumulativePercentage = 0;
    
    for (const variant of variants) {
      cumulativePercentage += variant.trafficAllocation;
      if (userHash * 100 <= cumulativePercentage) {
        return variant;
      }
    }

    // Fallback to last variant
    return variants[variants.length - 1];
  }

  private getUserSegments(userId: string, context?: Record<string, any>): string[] {
    const segments: string[] = [];

    if (context) {
      if (context.role) {
        segments.push(`role:${context.role}`);
      }
      
      if (context.tier) {
        segments.push(`tier:${context.tier}`);
      }
      
      if (context.region) {
        segments.push(`region:${context.region}`);
      }
      
      if (context.betaUser) {
        segments.push('beta_users');
      }
    }

    segments.push('all_users');
    return segments;
  }

  private hashUserId(userId: string, experimentKey: string): number {
    const hash = crypto.createHash('md5').update(`${userId}:${experimentKey}`).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  private async recalculateConversionRates(experimentId: string): Promise<void> {
    const variants = await this.variantRepository.find({
      where: { experimentId },
    });

    for (const variant of variants) {
      const conversionRate = variant.participantCount > 0 
        ? (variant.conversionCount / variant.participantCount)
        : 0;

      await this.variantRepository.update(variant.id, {
        conversionRate: Math.round(conversionRate * 10000) / 10000,
      });
    }
  }

  private calculateStatisticalSignificance(
    controlConversions: number,
    controlParticipants: number,
    variantConversions: number,
    variantParticipants: number
  ): { pValue: number; confidenceInterval: { lower: number; upper: number } } | null {
    // Simple Z-test for two proportions
    const p1 = controlConversions / controlParticipants;
    const p2 = variantConversions / variantParticipants;
    const pPooled = (controlConversions + variantConversions) / (controlParticipants + variantParticipants);
    
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/controlParticipants + 1/variantParticipants));
    const z = (p2 - p1) / se;
    
    // Approximate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    // 95% confidence interval
    const margin = 1.96 * Math.sqrt(p2 * (1 - p2) / variantParticipants);
    const confidenceInterval = {
      lower: Math.max(0, p2 - margin),
      upper: Math.min(1, p2 + margin),
    };

    return {
      pValue: Math.round(pValue * 10000) / 10000,
      confidenceInterval,
    };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}
