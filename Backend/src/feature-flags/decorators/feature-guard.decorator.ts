import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from '../services/feature-flag.service';
import { EvaluateFeatureFlagDto } from '../dto/feature-flag.dto';

export const FEATURE_FLAG_KEY = 'feature_flag';

export const FeatureGuard = (flagKey: string, options?: {
  fallback?: boolean;
  context?: Record<string, any>;
}) => {
  return SetMetadata(FEATURE_FLAG_KEY, { flagKey, options });
};

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureFlagConfig = this.reflector.get<{ flagKey: string; options?: any }>(
      FEATURE_FLAG_KEY,
      context.getHandler(),
    );

    if (!featureFlagConfig) {
      return true; // No feature flag configured, allow access
    }

    const { flagKey, options } = featureFlagConfig;
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return options?.fallback ?? false; // Use fallback value if no user
    }

    try {
      const evaluateDto: EvaluateFeatureFlagDto = {
        key: flagKey,
        userId: user.id || user.sub,
        context: {
          ...options?.context,
          role: user.role,
          tier: user.tier,
          region: user.region,
          betaUser: user.betaUser,
          premiumUser: user.premiumUser,
        },
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        requestId: request.id,
      };

      const result = await this.featureFlagService.evaluateFeatureFlag(evaluateDto);
      return result.enabled;

    } catch (error) {
      // Log error but return fallback value
      console.error(`Error evaluating feature flag ${flagKey}:`, error);
      return options?.fallback ?? false;
    }
  }
}

// Higher-order decorator for multiple feature flags
export const FeatureFlagsGuard = (flags: Array<{
  key: string;
  requireAll?: boolean; // If true, all flags must be enabled; if false, any flag enabled
  fallback?: boolean;
}>) => {
  return SetMetadata(FEATURE_FLAG_KEY, { flags, isMultiple: true });
};

@Injectable()
export class MultipleFeatureFlagsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<{ flags: any[]; isMultiple: boolean }>(
      FEATURE_FLAG_KEY,
      context.getHandler(),
    );

    if (!config || !config.isMultiple) {
      return true;
    }

    const { flags } = config;
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return flags.every(flag => flag.fallback === true);
    }

    const results = [];

    for (const flag of flags) {
      try {
        const evaluateDto: EvaluateFeatureFlagDto = {
          key: flag.key,
          userId: user.id || user.sub,
          context: {
            role: user.role,
            tier: user.tier,
            region: user.region,
            betaUser: user.betaUser,
            premiumUser: user.premiumUser,
          },
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
          requestId: request.id,
        };

        const result = await this.featureFlagService.evaluateFeatureFlag(evaluateDto);
        results.push(result.enabled);

      } catch (error) {
        console.error(`Error evaluating feature flag ${flag.key}:`, error);
        results.push(flag.fallback ?? false);
      }
    }

    // Check if all flags must be enabled or any flag enabled
    const requireAll = flags.some(flag => flag.requireAll !== false);
    return requireAll ? results.every(r => r) : results.some(r => r);
  }
}

// Decorator for feature flag with variant assignment (for A/B testing)
export const ExperimentGuard = (experimentKey: string, options?: {
  fallbackVariant?: string;
  context?: Record<string, any>;
}) => {
  return SetMetadata('experiment', { experimentKey, options });
};

@Injectable()
export class ExperimentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly experimentService: ExperimentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const experimentConfig = this.reflector.get<{ experimentKey: string; options?: any }>(
      'experiment',
      context.getHandler(),
    );

    if (!experimentConfig) {
      return true; // No experiment configured, allow access
    }

    const { experimentKey, options } = experimentConfig;
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Set fallback variant if provided
      if (options?.fallbackVariant) {
        request.experimentVariant = options.fallbackVariant;
      }
      return true;
    }

    try {
      const result = await this.experimentService.evaluateExperiment({
        key: experimentKey,
        userId: user.id || user.sub,
        context: {
          ...options?.context,
          role: user.role,
          tier: user.tier,
          region: user.region,
          betaUser: user.betaUser,
          premiumUser: user.premiumUser,
        },
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        requestId: request.id,
      });

      // Store variant in request for use in controller
      request.experimentVariant = result.variant;
      request.isInExperiment = result.isInExperiment;

      return true; // Always allow access, variant assignment is the key

    } catch (error) {
      console.error(`Error evaluating experiment ${experimentKey}:`, error);
      if (options?.fallbackVariant) {
        request.experimentVariant = options.fallbackVariant;
      }
      return true;
    }
  }
}
