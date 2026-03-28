import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { FeatureFlag } from '../entities/feature-flag.entity';
import { EvaluateFeatureFlagDto } from '../dto/feature-flag.dto';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  async evaluate(featureFlag: FeatureFlag, evaluateDto: EvaluateFeatureFlagDto): Promise<{
    enabled: boolean;
    reason: string;
    variant?: string;
  }> {
    // If feature is disabled, return false immediately
    if (!featureFlag.isEnabled) {
      return {
        enabled: false,
        reason: 'Feature flag is disabled',
      };
    }

    // Check blacklist first (highest priority)
    if (featureFlag.blacklistedUsers && featureFlag.blacklistedUsers.includes(evaluateDto.userId)) {
      return {
        enabled: false,
        reason: 'User is blacklisted',
      };
    }

    // Check whitelist (high priority)
    if (featureFlag.whitelistedUsers && featureFlag.whitelistedUsers.includes(evaluateDto.userId)) {
      return {
        enabled: true,
        reason: 'User is whitelisted',
      };
    }

    // Evaluate based on rollout strategy
    switch (featureFlag.rolloutStrategy) {
      case 'boolean':
        return this.evaluateBoolean(featureFlag, evaluateDto);
      
      case 'percentage':
        return this.evaluatePercentage(featureFlag, evaluateDto);
      
      case 'user_segment':
        return this.evaluateUserSegment(featureFlag, evaluateDto);
      
      case 'gradual':
        return this.evaluateGradual(featureFlag, evaluateDto);
      
      default:
        return {
          enabled: false,
          reason: 'Unknown rollout strategy',
        };
    }
  }

  private evaluateBoolean(featureFlag: FeatureFlag, evaluateDto: EvaluateFeatureFlagDto): {
    enabled: boolean;
    reason: string;
  } {
    return {
      enabled: featureFlag.isEnabled,
      reason: featureFlag.isEnabled ? 'Feature flag is enabled' : 'Feature flag is disabled',
    };
  }

  private evaluatePercentage(featureFlag: FeatureFlag, evaluateDto: EvaluateFeatureFlagDto): {
    enabled: boolean;
    reason: string;
    variant?: string;
  } {
    const hash = this.hashUserId(evaluateDto.userId, featureFlag.key);
    const percentage = hash * 100;

    if (percentage <= featureFlag.rolloutPercentage) {
      return {
        enabled: true,
        reason: `User falls within ${featureFlag.rolloutPercentage}% rollout`,
      };
    }

    return {
      enabled: false,
      reason: `User falls outside ${featureFlag.rolloutPercentage}% rollout`,
    };
  }

  private evaluateUserSegment(featureFlag: FeatureFlag, evaluateDto: EvaluateFeatureFlagDto): {
    enabled: boolean;
    reason: string;
  } {
    if (!featureFlag.targetSegments || featureFlag.targetSegments.length === 0) {
      return {
        enabled: false,
        reason: 'No target segments configured',
      };
    }

    const userSegments = this.getUserSegments(evaluateDto.userId, evaluateDto.context);
    const matchingSegments = userSegments.filter(segment => 
      featureFlag.targetSegments.includes(segment)
    );

    if (matchingSegments.length > 0) {
      return {
        enabled: true,
        reason: `User matches segments: ${matchingSegments.join(', ')}`,
      };
    }

    return {
      enabled: false,
      reason: `User segments [${userSegments.join(', ')}] do not match target segments [${featureFlag.targetSegments.join(', ')}]`,
    };
  }

  private evaluateGradual(featureFlag: FeatureFlag, evaluateDto: EvaluateFeatureFlagDto): {
    enabled: boolean;
    reason: string;
  } {
    if (!featureFlag.gradualConfig) {
      return {
        enabled: false,
        reason: 'Gradual rollout configuration not found',
      };
    }

    const config = featureFlag.gradualConfig;
    const now = new Date();
    const startDate = new Date(config.startDate);
    const endDate = config.endDate ? new Date(config.endDate) : null;

    // Check if we're within the rollout period
    if (now < startDate) {
      return {
        enabled: false,
        reason: 'Gradual rollout has not started yet',
      };
    }

    if (endDate && now > endDate) {
      return {
        enabled: false,
        reason: 'Gradual rollout has ended',
      };
    }

    // Calculate current percentage based on elapsed time
    const elapsedMs = now.getTime() - startDate.getTime();
    const totalMs = (endDate ? endDate.getTime() : startDate.getTime() + (config.stepIntervalHours * 60 * 60 * 1000 * 100)) - startDate.getTime();
    const progress = Math.min(elapsedMs / totalMs, 1);

    const currentPercentage = config.initialPercentage + 
      (config.finalPercentage - config.initialPercentage) * progress;

    const hash = this.hashUserId(evaluateDto.userId, featureFlag.key);
    const userPercentage = hash * 100;

    if (userPercentage <= currentPercentage) {
      return {
        enabled: true,
        reason: `User falls within current gradual rollout (${Math.round(currentPercentage * 100) / 100}%)`,
      };
    }

    return {
      enabled: false,
      reason: `User falls outside current gradual rollout (${Math.round(currentPercentage * 100) / 100}%)`,
    };
  }

  private getUserSegments(userId: string, context?: Record<string, any>): string[] {
    const segments: string[] = [];

    // Add segments based on context
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
      
      if (context.premiumUser) {
        segments.push('premium_users');
      }
    }

    // Add default segments
    segments.push('all_users');

    // Add segments based on user ID patterns
    if (userId.startsWith('admin-')) {
      segments.push('administrators');
    }

    if (userId.includes('test')) {
      segments.push('test_users');
    }

    return segments;
  }

  private hashUserId(userId: string, flagKey: string): number {
    const hash = crypto.createHash('md5').update(`${userId}:${flagKey}`).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  // Method to evaluate multiple flags at once
  async evaluateMultipleFlags(
    flags: FeatureFlag[], 
    evaluateDto: EvaluateFeatureFlagDto
  ): Promise<Array<{ key: string; enabled: boolean; reason: string; variant?: string }>> {
    const results = [];

    for (const flag of flags) {
      try {
        const result = await this.evaluate(flag, evaluateDto);
        results.push({
          key: flag.key,
          ...result,
        });
      } catch (error) {
        this.logger.error(`Error evaluating flag ${flag.key}: ${error.message}`);
        results.push({
          key: flag.key,
          enabled: false,
          reason: 'Evaluation error',
        });
      }
    }

    return results;
  }

  // Method to get all enabled flags for a user
  async getEnabledFlagsForUser(
    flags: FeatureFlag[], 
    userId: string, 
    context?: Record<string, any>
  ): Promise<FeatureFlag[]> {
    const enabledFlags: FeatureFlag[] = [];

    for (const flag of flags) {
      try {
        const result = await this.evaluate(flag, { 
          key: flag.key, 
          userId, 
          context 
        });
        
        if (result.enabled) {
          enabledFlags.push(flag);
        }
      } catch (error) {
        this.logger.error(`Error evaluating flag ${flag.key}: ${error.message}`);
      }
    }

    return enabledFlags;
  }
}
