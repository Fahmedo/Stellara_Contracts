import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { DriftDetectionService } from './drift-detection.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ML Model Drift Detection')
@Controller('ml-drift-detection')
export class DriftDetectionController {
  constructor(private readonly driftDetectionService: DriftDetectionService) {}

  @Post('detect/:modelId/:deploymentId')
  @ApiOperation({ summary: 'Trigger drift detection for a model' })
  @ApiResponse({ status: 200, description: 'Drift detection completed' })
  detectDrift(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Param('deploymentId', ParseUUIDPipe) deploymentId: string,
  ) {
    return this.driftDetectionService.detectDrift(modelId, deploymentId);
  }

  @Get('history/:modelId')
  @ApiOperation({ summary: 'Get drift detection history' })
  @ApiResponse({ status: 200, description: 'Drift detection history' })
  getDriftHistory(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const start = startTime ? new Date(startTime) : undefined;
    const end = endTime ? new Date(endTime) : undefined;
    
    return this.driftDetectionService.getDriftHistory(modelId, deploymentId, start, end);
  }

  @Patch('resolve/:driftId')
  @ApiOperation({ summary: 'Resolve drift detection' })
  @ApiResponse({ status: 200, description: 'Drift detection resolved' })
  resolveDrift(
    @Param('driftId', ParseUUIDPipe) driftId: string,
    @Body() body: { resolutionNotes: string },
  ) {
    return this.driftDetectionService.resolveDrift(driftId, body.resolutionNotes);
  }
}
