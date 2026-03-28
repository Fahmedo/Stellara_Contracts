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
  CreateExperimentDto, 
  EvaluateExperimentDto, 
  TrackConversionDto 
} from '../dto/feature-flag.dto';
import { ExperimentService } from '../services/experiment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('experiments')
@Controller('experiments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExperimentController {
  constructor(
    private readonly experimentService: ExperimentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new experiment' })
  @ApiResponse({ status: 201, description: 'Experiment created successfully' })
  async createExperiment(@Body() createDto: CreateExperimentDto) {
    return this.experimentService.createExperiment(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all experiments with optional filters' })
  async getAllExperiments(
    @Query('environment') environment?: string,
    @Query('status') status?: string,
    @Query('tags') tags?: string,
    @Query('owner') owner?: string,
  ) {
    const filters = {
      environment,
      status,
      tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      owner,
    };

    return this.experimentService.getAllExperiments(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get experiment by ID' })
  async getExperiment(@Param('id') id: string) {
    return this.experimentService.getExperiment(id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get experiment by key' })
  async getExperimentByKey(@Param('key') key: string) {
    return this.experimentService.getExperimentByKey(key);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update experiment status' })
  async updateExperimentStatus(
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    return this.experimentService.updateExperimentStatus(id, body.status);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate experiment for user' })
  async evaluateExperiment(@Body() evaluateDto: EvaluateExperimentDto) {
    return this.experimentService.evaluateExperiment(evaluateDto);
  }

  @Post('track-conversion')
  @ApiOperation({ summary: 'Track conversion for experiment' })
  @HttpCode(HttpStatus.OK)
  async trackConversion(@Body() trackDto: TrackConversionDto) {
    await this.experimentService.trackConversion(trackDto);
    return { success: true };
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get experiment results with statistical analysis' })
  async getExperimentResults(@Param('id') id: string) {
    return this.experimentService.getExperimentResults(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete experiment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExperiment(@Param('id') id: string) {
    // This would need to be implemented in the service
    // For now, just return success
    return;
  }

  // SDK endpoints for frontend integration
  @Get('sdk/experiments')
  @ApiOperation({ summary: 'Get all active experiments for SDK consumption' })
  async getSdkExperiments(
    @Query('environment') environment: string = 'production',
    @Query('version') version?: string,
  ) {
    const experiments = await this.experimentService.getAllExperiments({ 
      environment, 
      status: 'running' 
    });
    
    // Return only the information needed for SDK
    return experiments.map(experiment => ({
      key: experiment.key,
      displayName: experiment.displayName,
      trafficAllocation: experiment.trafficAllocation,
      targetSegments: experiment.targetSegments,
      variants: experiment.variants.map(variant => ({
        variantKey: variant.variantKey,
        displayName: variant.displayName,
        trafficAllocation: variant.trafficAllocation,
        isControl: variant.isControl,
      })),
      startDate: experiment.configuration?.startDate,
      endDate: experiment.configuration?.endDate,
    }));
  }

  @Post('sdk/evaluate')
  @ApiOperation({ summary: 'SDK endpoint to evaluate experiments' })
  async sdkEvaluate(@Body() evaluateDto: EvaluateExperimentDto) {
    return this.experimentService.evaluateExperiment(evaluateDto);
  }

  @Post('sdk/track-conversion')
  @ApiOperation({ summary: 'SDK endpoint to track conversions' })
  @HttpCode(HttpStatus.OK)
  async sdkTrackConversion(@Body() trackDto: TrackConversionDto) {
    await this.experimentService.trackConversion(trackDto);
    return { success: true };
  }

  // Admin dashboard endpoints
  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get experiments dashboard summary' })
  async getDashboardSummary() {
    const allExperiments = await this.experimentService.getAllExperiments();
    
    const summary = {
      totalExperiments: allExperiments.length,
      statusBreakdown: {
        draft: allExperiments.filter(e => e.status === 'draft').length,
        running: allExperiments.filter(e => e.status === 'running').length,
        paused: allExperiments.filter(e => e.status === 'paused').length,
        completed: allExperiments.filter(e => e.status === 'completed').length,
        archived: allExperiments.filter(e => e.status === 'archived').length,
      },
      totalParticipants: allExperiments.reduce((sum, e) => sum + e.participantCount, 0),
      totalConversions: allExperiments.reduce((sum, e) => sum + e.conversionCount, 0),
      averageConversionRate: allExperiments.length > 0 
        ? (allExperiments.reduce((sum, e) => {
            const rate = e.participantCount > 0 ? (e.conversionCount / e.participantCount) * 100 : 0;
            return sum + rate;
          }, 0) / allExperiments.length)
        : 0,
      environments: [...new Set(allExperiments.map(e => e.environment))],
      recentActivity: allExperiments
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 10)
        .map(e => ({
          key: e.key,
          displayName: e.displayName,
          status: e.status,
          updatedAt: e.updatedAt,
          participantCount: e.participantCount,
          conversionCount: e.conversionCount,
        })),
    };

    return summary;
  }

  @Get('running/overview')
  @ApiOperation({ summary: 'Get overview of currently running experiments' })
  async getRunningExperimentsOverview() {
    const runningExperiments = await this.experimentService.getAllExperiments({ 
      status: 'running' 
    });

    const overview = await Promise.all(
      runningExperiments.map(async (experiment) => {
        const results = await this.experimentService.getExperimentResults(experiment.id);
        
        return {
          id: experiment.id,
          key: experiment.key,
          displayName: experiment.displayName,
          participantCount: experiment.participantCount,
          conversionCount: experiment.conversionCount,
          variants: results.variants.map(v => ({
            variantKey: v.variant.variantKey,
            displayName: v.variant.displayName,
            participantCount: v.variant.participantCount,
            conversionCount: v.variant.conversionCount,
            conversionRate: v.conversionRate,
            isControl: v.variant.isControl,
            statisticalSignificance: v.statisticalSignificance,
          })),
          winner: results.winner,
          recommendations: results.recommendations,
          startDate: experiment.configuration?.startDate,
          endDate: experiment.configuration?.endDate,
        };
      })
    );

    return overview;
  }
}
