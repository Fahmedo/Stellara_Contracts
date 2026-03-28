import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { FeatureFlag } from '../entities/feature-flag.entity';
import { FeatureFlagEvaluation } from '../entities/feature-flag-evaluation.entity';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto, EvaluateFeatureFlagDto } from '../dto/feature-flag.dto';
import { EvaluationService } from './evaluation.service';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(FeatureFlagEvaluation)
    private readonly evaluationRepository: Repository<FeatureFlagEvaluation>,
    private readonly configService: ConfigService,
    private readonly evaluationService: EvaluationService,
  ) {}

  async createFeatureFlag(createDto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    try {
      // Check if key already exists
      const existingFlag = await this.featureFlagRepository.findOne({
        where: { key: createDto.key },
      });

      if (existingFlag) {
        throw new BadRequestException(`Feature flag with key '${createDto.key}' already exists`);
      }

      const featureFlag = this.featureFlagRepository.create({
        ...createDto,
        isEnabled: createDto.isEnabled ?? false,
        rolloutStrategy: createDto.rolloutStrategy ?? 'boolean',
        rolloutPercentage: createDto.rolloutPercentage ?? 0,
        environment: createDto.environment ?? 'development',
      });

      const savedFlag = await this.featureFlagRepository.save(featureFlag);

      this.logger.log(`Feature flag created: ${savedFlag.key}`);
      return savedFlag;

    } catch (error) {
      this.logger.error(`Error creating feature flag: ${error.message}`);
      throw error;
    }
  }

  async updateFeatureFlag(id: string, updateDto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    try {
      const featureFlag = await this.featureFlagRepository.findOne({ where: { id } });
      
      if (!featureFlag) {
        throw new NotFoundException('Feature flag not found');
      }

      await this.featureFlagRepository.update(id, updateDto);
      const updatedFlag = await this.featureFlagRepository.findOne({ where: { id } });

      this.logger.log(`Feature flag updated: ${updatedFlag.key}`);
      return updatedFlag;

    } catch (error) {
      this.logger.error(`Error updating feature flag: ${error.message}`);
      throw error;
    }
  }

  async getFeatureFlag(id: string): Promise<FeatureFlag> {
    const featureFlag = await this.featureFlagRepository.findOne({ where: { id } });
    
    if (!featureFlag) {
      throw new NotFoundException('Feature flag not found');
    }

    return featureFlag;
  }

  async getFeatureFlagByKey(key: string): Promise<FeatureFlag> {
    const featureFlag = await this.featureFlagRepository.findOne({ where: { key } });
    
    if (!featureFlag) {
      throw new NotFoundException('Feature flag not found');
    }

    return featureFlag;
  }

  async getAllFeatureFlags(filters?: {
    environment?: string;
    isEnabled?: boolean;
    tags?: string[];
    owner?: string;
  }): Promise<FeatureFlag[]> {
    const queryBuilder = this.featureFlagRepository.createQueryBuilder('featureFlag');

    if (filters?.environment) {
      queryBuilder.andWhere('featureFlag.environment = :environment', { environment: filters.environment });
    }

    if (filters?.isEnabled !== undefined) {
      queryBuilder.andWhere('featureFlag.isEnabled = :isEnabled', { isEnabled: filters.isEnabled });
    }

    if (filters?.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('featureFlag.tags @> :tags', { tags: JSON.stringify(filters.tags) });
    }

    if (filters?.owner) {
      queryBuilder.andWhere('featureFlag.owner = :owner', { owner: filters.owner });
    }

    return queryBuilder.orderBy('featureFlag.updatedAt', 'DESC').getMany();
  }

  async deleteFeatureFlag(id: string): Promise<void> {
    try {
      const featureFlag = await this.featureFlagRepository.findOne({ where: { id } });
      
      if (!featureFlag) {
        throw new NotFoundException('Feature flag not found');
      }

      // Check if it's a kill switch
      if (featureFlag.isKillSwitch) {
        throw new BadRequestException('Cannot delete kill switch feature flags');
      }

      await this.featureFlagRepository.delete(id);
      this.logger.log(`Feature flag deleted: ${featureFlag.key}`);

    } catch (error) {
      this.logger.error(`Error deleting feature flag: ${error.message}`);
      throw error;
    }
  }

  async evaluateFeatureFlag(evaluateDto: EvaluateFeatureFlagDto): Promise<{
    enabled: boolean;
    reason: string;
    variant?: string;
  }> {
    try {
      const featureFlag = await this.getFeatureFlagByKey(evaluateDto.key);

      // Update evaluation count and last evaluated timestamp
      await this.featureFlagRepository.update(featureFlag.id, {
        evaluationCount: featureFlag.evaluationCount + 1,
        lastEvaluatedAt: new Date(),
      });

      const result = await this.evaluationService.evaluate(featureFlag, evaluateDto);

      // Store evaluation for analytics
      await this.evaluationRepository.save({
        featureFlagId: featureFlag.id,
        userId: evaluateDto.userId,
        context: evaluateDto.context,
        result: result.enabled,
        reason: result.reason,
        variant: result.variant,
        userAgent: evaluateDto.userAgent,
        ipAddress: evaluateDto.ipAddress,
        requestId: evaluateDto.requestId,
      });

      return result;

    } catch (error) {
      this.logger.error(`Error evaluating feature flag: ${error.message}`);
      throw error;
    }
  }

  async getFeatureFlagAnalytics(key: string, period?: { start: Date; end: Date }): Promise<{
    totalEvaluations: number;
    uniqueUsers: number;
    enabledCount: number;
    disabledCount: number;
    enablementRate: number;
    evaluationsByDay: Array<{ date: string; count: number }>;
    topVariants: Array<{ variant: string; count: number; percentage: number }>;
  }> {
    const featureFlag = await this.getFeatureFlagByKey(key);

    const queryBuilder = this.evaluationRepository.createQueryBuilder('evaluation')
      .where('evaluation.featureFlagId = :featureFlagId', { featureFlagId: featureFlag.id });

    if (period) {
      queryBuilder.andWhere('evaluation.createdAt BETWEEN :start AND :end', {
        start: period.start,
        end: period.end,
      });
    }

    const evaluations = await queryBuilder.getMany();

    const totalEvaluations = evaluations.length;
    const uniqueUsers = new Set(evaluations.map(e => e.userId)).size;
    const enabledCount = evaluations.filter(e => e.result).length;
    const disabledCount = totalEvaluations - enabledCount;
    const enablementRate = totalEvaluations > 0 ? (enabledCount / totalEvaluations) * 100 : 0;

    // Group by day
    const evaluationsByDay = evaluations.reduce((acc, evaluation) => {
      const date = evaluation.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const dailyData = Object.entries(evaluationsByDay).map(([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Group by variant
    const variantCounts = evaluations
      .filter(e => e.variant)
      .reduce((acc, evaluation) => {
        acc[evaluation.variant] = (acc[evaluation.variant] || 0) + 1;
        return acc;
      }, {});

    const topVariants = Object.entries(variantCounts)
      .map(([variant, count]) => ({
        variant,
        count,
        percentage: totalEvaluations > 0 ? (count / totalEvaluations) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvaluations,
      uniqueUsers,
      enabledCount,
      disabledCount,
      enablementRate: Math.round(enablementRate * 100) / 100,
      evaluationsByDay: dailyData,
      topVariants,
    };
  }

  async bulkUpdateFeatureFlags(updates: Array<{ id: string; updateDto: UpdateFeatureFlagDto }>): Promise<FeatureFlag[]> {
    const results: FeatureFlag[] = [];

    for (const { id, updateDto } of updates) {
      try {
        const updated = await this.updateFeatureFlag(id, updateDto);
        results.push(updated);
      } catch (error) {
        this.logger.error(`Failed to update feature flag ${id}: ${error.message}`);
        // Continue with other updates
      }
    }

    return results;
  }

  async duplicateFeatureFlag(id: string, newKey: string, newDisplayName: string): Promise<FeatureFlag> {
    const originalFlag = await this.getFeatureFlag(id);

    const createDto: CreateFeatureFlagDto = {
      key: newKey,
      displayName: newDisplayName,
      description: originalFlag.description,
      isEnabled: false, // Start disabled for safety
      rolloutStrategy: originalFlag.rolloutStrategy,
      rolloutPercentage: originalFlag.rolloutPercentage,
      targetSegments: originalFlag.targetSegments,
      whitelistedUsers: originalFlag.whitelistedUsers,
      blacklistedUsers: originalFlag.blacklistedUsers,
      gradualConfig: originalFlag.gradualConfig,
      metadata: originalFlag.metadata,
      tags: originalFlag.tags,
      owner: originalFlag.owner,
      isKillSwitch: false, // Never duplicate kill switches
      environment: originalFlag.environment,
    };

    return this.createFeatureFlag(createDto);
  }

  // Helper method for consistent hashing
  private hashUserId(userId: string, flagKey: string): number {
    const hash = crypto.createHash('md5').update(`${userId}:${flagKey}`).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }
}
