import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { TrafficSplittingService } from '../deployment/traffic-splitting.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as tf from '@tensorflow/tfjs-node';
import * as ort from 'onnxruntime-node';
import { PythonShell } from 'python-shell';

interface InferenceRequest {
  modelName: string;
  version?: string;
  input: any;
  headers?: Record<string, string>;
}

interface InferenceResponse {
  prediction: any;
  modelId: string;
  deploymentId: string;
  latency: number;
  timestamp: Date;
}

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);
  private readonly modelCache = new Map<string, any>();
  private readonly pythonProcesses = new Map<string, PythonShell>();

  constructor(
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    private readonly trafficSplittingService: TrafficSplittingService,
    private readonly monitoringService: MonitoringService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async predict(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    
    try {
      const deploymentId = await this.trafficSplittingService.routeRequest(
        request.modelName,
        request.headers,
      );

      const deployment = await this.deploymentRepository.findOne({
        where: { id: deploymentId },
        relations: ['model'],
      });

      if (!deployment) {
        throw new NotFoundException(`Deployment ${deploymentId} not found`);
      }

      const model = deployment.model;
      const modelKey = `${model.name}:${model.version}`;
      
      let modelInstance = this.modelCache.get(modelKey);
      if (!modelInstance) {
        modelInstance = await this.loadModel(model);
        this.modelCache.set(modelKey, modelInstance);
      }

      const prediction = await this.runInference(modelInstance, model, request.input);
      const latency = Date.now() - startTime;

      const response: InferenceResponse = {
        prediction,
        modelId: model.id,
        deploymentId,
        latency,
        timestamp: new Date(),
      };

      await this.recordInferenceMetrics(deployment, response, request);
      
      this.eventEmitter.emit('inference.completed', {
        modelId: model.id,
        deploymentId,
        latency,
        inputSize: JSON.stringify(request.input).length,
        outputSize: JSON.stringify(prediction).length,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      this.eventEmitter.emit('inference.failed', {
        modelName: request.modelName,
        latency,
        error: error.message,
      });

      throw error;
    }
  }

  async predictBatch(requests: InferenceRequest[]): Promise<InferenceResponse[]> {
    const responses: InferenceResponse[] = [];
    
    for (const request of requests) {
      try {
        const response = await this.predict(request);
        responses.push(response);
      } catch (error) {
        this.logger.error(`Batch inference failed for ${request.modelName}:`, error);
        // Continue with other requests in batch
      }
    }
    
    return responses;
  }

  private async loadModel(model: MLModel): Promise<any> {
    switch (model.format) {
      case 'tensorflow':
        return await this.loadTensorFlowModel(model);
      case 'pytorch':
        return await this.loadPyTorchModel(model);
      case 'onnx':
        return await this.loadONNXModel(model);
      default:
        throw new Error(`Unsupported model format: ${model.format}`);
    }
  }

  private async loadTensorFlowModel(model: MLModel): Promise<any> {
    try {
      const modelPath = model.modelPath;
      const tfModel = await tf.loadGraphModel(modelPath);
      
      return {
        type: 'tensorflow',
        model: tfModel,
        predict: async (input: any) => {
          const tensor = tf.tensor(input);
          const result = await tfModel.executeAsync(tensor);
          const prediction = await result.array();
          tensor.dispose();
          result.dispose();
          return prediction;
        },
      };
    } catch (error) {
      this.logger.error(`Failed to load TensorFlow model ${model.name}:`, error);
      throw error;
    }
  }

  private async loadPyTorchModel(model: MLModel): Promise<any> {
    try {
      const modelKey = `${model.name}:${model.version}`;
      
      if (!this.pythonProcesses.has(modelKey)) {
        const shell = new PythonShell('src/ml-model-serving/inference/pytorch_server.py', {
          mode: 'json',
          pythonPath: 'python3',
          args: [model.modelPath, model.name, model.version],
        });

        this.pythonProcesses.set(modelKey, shell);
      }

      return {
        type: 'pytorch',
        shell: this.pythonProcesses.get(modelKey),
        predict: async (input: any) => {
          const shell = this.pythonProcesses.get(modelKey);
          return new Promise((resolve, reject) => {
            shell.send({ action: 'predict', input });
            shell.once('message', (message) => {
              if (message.error) {
                reject(new Error(message.error));
              } else {
                resolve(message.prediction);
              }
            });
          });
        },
      };
    } catch (error) {
      this.logger.error(`Failed to load PyTorch model ${model.name}:`, error);
      throw error;
    }
  }

  private async loadONNXModel(model: MLModel): Promise<any> {
    try {
      const session = await ort.InferenceSession.create(model.modelPath);
      
      return {
        type: 'onnx',
        session,
        predict: async (input: any) => {
          const inputTensor = new ort.Tensor(input.type || 'float32', new Float32Array(input.data.flat()), input.dims);
          const results = await session.run({ [input.name]: inputTensor });
          return Object.values(results)[0].data;
        },
      };
    } catch (error) {
      this.logger.error(`Failed to load ONNX model ${model.name}:`, error);
      throw error;
    }
  }

  private async runInference(modelInstance: any, model: MLModel, input: any): Promise<any> {
    try {
      // Validate input against schema
      this.validateInput(model.inputSchema, input);
      
      // Run prediction
      const prediction = await modelInstance.predict(input);
      
      // Validate output against schema
      this.validateOutput(model.outputSchema, prediction);
      
      return prediction;
    } catch (error) {
      this.logger.error(`Inference failed for model ${model.name}:`, error);
      throw error;
    }
  }

  private validateInput(schema: Record<string, any>, input: any): void {
    // Basic validation - in production, use a proper JSON schema validator
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in input)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
  }

  private validateOutput(schema: Record<string, any>, output: any): void {
    // Basic validation - in production, use a proper JSON schema validator
    if (schema.type && typeof output !== schema.type) {
      throw new Error(`Output type mismatch: expected ${schema.type}, got ${typeof output}`);
    }
  }

  private async recordInferenceMetrics(
    deployment: ModelDeployment,
    response: InferenceResponse,
    request: InferenceRequest,
  ): Promise<void> {
    const metrics = {
      performance: {
        latency: {
          p50: response.latency,
          p95: response.latency,
          p99: response.latency,
          min: response.latency,
          max: response.latency,
          mean: response.latency,
          median: response.latency,
        },
        throughput: {
          requestsPerSecond: 1,
          requestsPerMinute: 60,
          requestsPerHour: 3600,
        },
        errorRate: {
          percentage: 0,
          count: 0,
          totalRequests: 1,
        },
        resourceUsage: {
          cpu: { utilization: 0 }, // Would be populated by actual monitoring
          memory: { utilization: 0 },
        },
      },
      inputStats: {
        requestCount: 1,
        avgRequestSize: JSON.stringify(request.input).length,
      },
      outputStats: {
        responseCount: 1,
        avgResponseSize: JSON.stringify(response.prediction).length,
      },
    };

    await this.monitoringService.recordMetrics(
      deployment.modelId,
      deployment.id,
      metrics,
    );

    // Update Redis counters for real-time metrics
    const key = `inference:${deployment.id}`;
    await this.redisService.incr(`${key}:requests`);
    await this.redisService.expire(`${key}:requests`, 3600);
    
    await this.redisService.lpush(`${key}:latencies`, response.latency);
    await this.redisService.ltrim(`${key}:latencies`, 0, 999);
    await this.redisService.expire(`${key}:latencies`, 3600);
  }

  async getModelInfo(modelName: string, version?: string): Promise<any> {
    const model = version 
      ? await this.modelRepository.findOne({ where: { name: modelName, version } })
      : await this.modelRepository.findOne({ where: { name: modelName, isProduction: true } });

    if (!model) {
      throw new NotFoundException(`Model ${modelName}${version ? ` v${version}` : ' (production)'} not found`);
    }

    return {
      id: model.id,
      name: model.name,
      version: model.version,
      format: model.format,
      inputSchema: model.inputSchema,
      outputSchema: model.outputSchema,
      metadata: model.metadata,
    };
  }

  async getInferenceStats(deploymentId: string): Promise<any> {
    const key = `inference:${deploymentId}`;
    const requests = await this.redisService.get(`${key}:requests`);
    const latencies = await this.redisService.lrange(`${key}:latencies`, 0, -1);
    
    const latencyNumbers = latencies.map(l => parseFloat(l));
    
    return {
      totalRequests: parseInt(requests || '0', 10),
      averageLatency: latencyNumbers.length > 0 
        ? latencyNumbers.reduce((sum, l) => sum + l, 0) / latencyNumbers.length 
        : 0,
      p95Latency: this.percentile(latencyNumbers, 95),
      p99Latency: this.percentile(latencyNumbers, 99),
    };
  }

  private percentile(numbers: number[], p: number): number {
    if (numbers.length === 0) return 0;
    
    const sorted = numbers.slice().sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Clean up Python processes
    for (const [key, shell] of this.pythonProcesses) {
      shell.end();
    }
    this.pythonProcesses.clear();
    
    // Clear model cache
    this.modelCache.clear();
  }
}
