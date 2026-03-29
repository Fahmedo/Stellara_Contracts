import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ML Model Deployment')
@Controller('ml-deployments')
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new model deployment' })
  @ApiResponse({ status: 201, description: 'Deployment created successfully' })
  create(@Body() createDeploymentDto: CreateDeploymentDto) {
    return this.deploymentService.create(createDeploymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all deployments' })
  @ApiResponse({ status: 200, description: 'List of all deployments' })
  findAll(
    @Query('modelId') modelId?: string,
    @Query('status') status?: string,
  ) {
    return this.deploymentService.findAll(modelId, status as any);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deployment by ID' })
  @ApiResponse({ status: 200, description: 'Deployment details' })
  findOne(@Param('id') id: string) {
    return this.deploymentService.findOne(id);
  }

  @Post(':id/deploy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deploy a model' })
  @ApiResponse({ status: 200, description: 'Model deployed successfully' })
  deploy(@Param('id') id: string) {
    return this.deploymentService.deploy(id);
  }

  @Post(':id/canary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create canary deployment' })
  @ApiResponse({ status: 200, description: 'Canary deployment created' })
  createCanary(
    @Param('id') id: string,
    @Body() body: { trafficPercentage?: number; config?: any },
  ) {
    return this.deploymentService.createCanaryDeployment(
      id,
      body.trafficPercentage,
      body.config,
    );
  }

  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback deployment' })
  @ApiResponse({ status: 200, description: 'Deployment rolled back' })
  rollback(@Param('id') id: string) {
    return this.deploymentService.rollback(id);
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate deployment' })
  @ApiResponse({ status: 200, description: 'Deployment terminated' })
  terminate(@Param('id') id: string) {
    return this.deploymentService.terminate(id);
  }

  @Post(':id/scale')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Scale deployment' })
  @ApiResponse({ status: 200, description: 'Deployment scaled' })
  scale(@Param('id') id: string, @Body() body: { replicas: number }) {
    return this.deploymentService.scale(id, body.replicas);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get deployment metrics' })
  @ApiResponse({ status: 200, description: 'Deployment metrics' })
  getMetrics(@Param('id') id: string) {
    return this.deploymentService.getDeploymentMetrics(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update deployment' })
  @ApiResponse({ status: 200, description: 'Deployment updated' })
  update(@Param('id') id: string, @Body() updateDeploymentDto: UpdateDeploymentDto) {
    return this.deploymentService.update(id, updateDeploymentDto);
  }
}
