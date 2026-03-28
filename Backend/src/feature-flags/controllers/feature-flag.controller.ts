import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
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
  CreateFeatureFlagDto, 
  UpdateFeatureFlagDto, 
  EvaluateFeatureFlagDto 
} from '../dto/feature-flag.dto';
import { FeatureFlagService } from '../services/feature-flag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('feature-flags')
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FeatureFlagController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created successfully' })
  async createFeatureFlag(@Body() createDto: CreateFeatureFlagDto) {
    return this.featureFlagService.createFeatureFlag(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feature flags with optional filters' })
  async getAllFeatureFlags(
    @Query('environment') environment?: string,
    @Query('isEnabled') isEnabled?: string,
    @Query('tags') tags?: string,
    @Query('owner') owner?: string,
  ) {
    const filters = {
      environment,
      isEnabled: isEnabled ? isEnabled === 'true' : undefined,
      tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      owner,
    };

    return this.featureFlagService.getAllFeatureFlags(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feature flag by ID' })
  async getFeatureFlag(@Param('id') id: string) {
    return this.featureFlagService.getFeatureFlag(id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get feature flag by key' })
  async getFeatureFlagByKey(@Param('key') key: string) {
    return this.featureFlagService.getFeatureFlagByKey(key);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update feature flag' })
  async updateFeatureFlag(
    @Param('id') id: string,
    @Body() updateDto: UpdateFeatureFlagDto
  ) {
    return this.featureFlagService.updateFeatureFlag(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete feature flag' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeatureFlag(@Param('id') id: string) {
    return this.featureFlagService.deleteFeatureFlag(id);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate feature flag for user' })
  async evaluateFeatureFlag(@Body() evaluateDto: EvaluateFeatureFlagDto) {
    return this.featureFlagService.evaluateFeatureFlag(evaluateDto);
  }

  @Post('evaluate-batch')
  @ApiOperation({ summary: 'Evaluate multiple feature flags for user' })
  async evaluateMultipleFlags(@Body() body: { 
    userId: string; 
    flagKeys: string[]; 
    context?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
  }) {
    const results = [];

    for (const flagKey of body.flagKeys) {
      try {
        const result = await this.featureFlagService.evaluateFeatureFlag({
          key: flagKey,
          userId: body.userId,
          context: body.context,
          userAgent: body.userAgent,
          ipAddress: body.ipAddress,
          requestId: body.requestId,
        });
        results.push({ key: flagKey, ...result });
      } catch (error) {
        results.push({ 
          key: flagKey, 
          enabled: false, 
          reason: 'Evaluation error',
          error: error.message 
        });
      }
    }

    return results;
  }

  @Get(':key/analytics')
  @ApiOperation({ summary: 'Get feature flag analytics' })
  async getFeatureFlagAnalytics(
    @Param('key') key: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate),
    } : undefined;

    return this.featureFlagService.getFeatureFlagAnalytics(key, period);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Update multiple feature flags' })
  async bulkUpdateFeatureFlags(@Body() body: { 
    updates: Array<{ id: string; updateDto: UpdateFeatureFlagDto }> 
  }) {
    return this.featureFlagService.bulkUpdateFeatureFlags(body.updates);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate feature flag' })
  async duplicateFeatureFlag(
    @Param('id') id: string,
    @Body() body: { 
      newKey: string; 
      newDisplayName: string; 
    }
  ) {
    return this.featureFlagService.duplicateFeatureFlag(id, body.newKey, body.newDisplayName);
  }

  @Get('user/:userId/enabled-flags')
  @ApiOperation({ summary: 'Get all enabled flags for a user' })
  async getEnabledFlagsForUser(
    @Param('userId') userId: string,
    @Query('context') context?: string,
  ) {
    const allFlags = await this.featureFlagService.getAllFeatureFlags();
    const contextObj = context ? JSON.parse(context) : undefined;

    // This would need to be implemented in the service
    // For now, return all flags that the user might have access to
    return {
      userId,
      totalFlags: allFlags.length,
      flags: allFlags.map(flag => ({
        key: flag.key,
        displayName: flag.displayName,
        isEnabled: flag.isEnabled,
      })),
    };
  }

  // SDK endpoints for frontend integration
  @Get('sdk/flags')
  @ApiOperation({ summary: 'Get all feature flags for SDK consumption' })
  async getSdkFlags(
    @Query('environment') environment: string = 'production',
    @Query('version') version?: string,
  ) {
    const flags = await this.featureFlagService.getAllFeatureFlags({ environment });
    
    // Return only the information needed for SDK
    return flags.map(flag => ({
      key: flag.key,
      displayName: flag.displayName,
      description: flag.description,
      rolloutStrategy: flag.rolloutStrategy,
      rolloutPercentage: flag.rolloutPercentage,
      targetSegments: flag.targetSegments,
      tags: flag.tags,
      updatedAt: flag.updatedAt,
    }));
  }

  @Post('sdk/evaluate')
  @ApiOperation({ summary: 'SDK endpoint to evaluate feature flags' })
  async sdkEvaluate(@Body() evaluateDto: EvaluateFeatureFlagDto) {
    return this.featureFlagService.evaluateFeatureFlag(evaluateDto);
  }

  // Admin dashboard endpoints
  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get feature flags dashboard summary' })
  async getDashboardSummary() {
    const allFlags = await this.featureFlagService.getAllFeatureFlags();
    
    const summary = {
      totalFlags: allFlags.length,
      enabledFlags: allFlags.filter(f => f.isEnabled).length,
      disabledFlags: allFlags.filter(f => !f.isEnabled).length,
      killSwitches: allFlags.filter(f => f.isKillSwitch).length,
      environments: [...new Set(allFlags.map(f => f.environment))],
      strategies: {
        boolean: allFlags.filter(f => f.rolloutStrategy === 'boolean').length,
        percentage: allFlags.filter(f => f.rolloutStrategy === 'percentage').length,
        user_segment: allFlags.filter(f => f.rolloutStrategy === 'user_segment').length,
        gradual: allFlags.filter(f => f.rolloutStrategy === 'gradual').length,
      },
      recentActivity: allFlags
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 10)
        .map(f => ({
          key: f.key,
          displayName: f.displayName,
          updatedAt: f.updatedAt,
          isEnabled: f.isEnabled,
        })),
    };

    return summary;
  }
}
