import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InferenceService } from './inference.service';
import { InferenceRequestDto, BatchInferenceRequestDto } from './dto/inference-request.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ML Model Inference')
@Controller('ml-inference')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post('predict')
  @ApiOperation({ summary: 'Make a single prediction' })
  @ApiResponse({ status: 200, description: 'Prediction completed successfully' })
  predict(@Body() request: InferenceRequestDto) {
    return this.inferenceService.predict(request);
  }

  @Post('predict-batch')
  @ApiOperation({ summary: 'Make batch predictions' })
  @ApiResponse({ status: 200, description: 'Batch predictions completed' })
  predictBatch(@Body() request: BatchInferenceRequestDto) {
    const requests = request.inputs.map(input => ({
      modelName: request.modelName,
      version: request.version,
      input,
    }));
    
    return this.inferenceService.predictBatch(requests);
  }

  @Get('model-info/:modelName')
  @ApiOperation({ summary: 'Get model information' })
  @ApiResponse({ status: 200, description: 'Model information' })
  getModelInfo(
    @Query('modelName') modelName: string,
    @Query('version') version?: string,
  ) {
    return this.inferenceService.getModelInfo(modelName, version);
  }

  @Get('stats/:deploymentId')
  @ApiOperation({ summary: 'Get inference statistics' })
  @ApiResponse({ status: 200, description: 'Inference statistics' })
  getStats(@Param('deploymentId', ParseUUIDPipe) deploymentId: string) {
    return this.inferenceService.getInferenceStats(deploymentId);
  }
}
