import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ML Model Monitoring')
@Controller('ml-monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Post('metrics/:modelId/:deploymentId')
  @ApiOperation({ summary: 'Record model metrics' })
  @ApiResponse({ status: 201, description: 'Metrics recorded successfully' })
  recordMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Param('deploymentId', ParseUUIDPipe) deploymentId: string,
    @Body() metrics: any,
  ) {
    return this.monitoringService.recordMetrics(modelId, deploymentId, metrics);
  }

  @Get('metrics/:modelId')
  @ApiOperation({ summary: 'Get model metrics' })
  @ApiResponse({ status: 200, description: 'Model metrics' })
  getMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const start = startTime ? new Date(startTime) : undefined;
    const end = endTime ? new Date(endTime) : undefined;
    
    return this.monitoringService.getMetrics(modelId, deploymentId, start, end);
  }

  @Get('realtime/:modelId')
  @ApiOperation({ summary: 'Get real-time metrics' })
  @ApiResponse({ status: 200, description: 'Real-time metrics' })
  getRealTimeMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
  ) {
    return this.monitoringService.getRealTimeMetrics(modelId, deploymentId);
  }

  @Get('latency/:modelId')
  @ApiOperation({ summary: 'Get latency metrics' })
  @ApiResponse({ status: 200, description: 'Latency metrics' })
  getLatencyMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('timeRange') timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ) {
    return this.monitoringService.getLatencyMetrics(modelId, deploymentId, timeRange);
  }

  @Get('throughput/:modelId')
  @ApiOperation({ summary: 'Get throughput metrics' })
  @ApiResponse({ status: 200, description: 'Throughput metrics' })
  getThroughputMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('timeRange') timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ) {
    return this.monitoringService.getThroughputMetrics(modelId, deploymentId, timeRange);
  }

  @Get('error-rate/:modelId')
  @ApiOperation({ summary: 'Get error rate metrics' })
  @ApiResponse({ status: 200, description: 'Error rate metrics' })
  getErrorRateMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('timeRange') timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ) {
    return this.monitoringService.getErrorRateMetrics(modelId, deploymentId, timeRange);
  }

  @Get('resource-usage/:modelId')
  @ApiOperation({ summary: 'Get resource usage metrics' })
  @ApiResponse({ status: 200, description: 'Resource usage metrics' })
  getResourceUsageMetrics(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
    @Query('timeRange') timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ) {
    return this.monitoringService.getResourceUsageMetrics(modelId, deploymentId, timeRange);
  }

  @Get('dashboard/:modelId')
  @ApiOperation({ summary: 'Get dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  getDashboardData(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Query('deploymentId') deploymentId?: string,
  ) {
    return this.monitoringService.getDashboardData(modelId, deploymentId);
  }
}
