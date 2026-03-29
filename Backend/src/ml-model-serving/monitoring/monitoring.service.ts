import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { ModelMetrics } from './model-metrics.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(ModelMetrics)
    private readonly metricsRepository: Repository<ModelMetrics>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordMetrics(
    modelId: string,
    deploymentId: string,
    metrics: any,
  ): Promise<ModelMetrics> {
    const modelMetrics = this.metricsRepository.create({
      modelId,
      deploymentId,
      timestamp: new Date(),
      performance: metrics.performance,
      modelSpecific: metrics.modelSpecific,
      inputStats: metrics.inputStats,
      outputStats: metrics.outputStats,
      alerts: metrics.alerts || [],
    });

    const savedMetrics = await this.metricsRepository.save(modelMetrics);

    await this.updateRealTimeMetrics(modelId, deploymentId, metrics);
    await this.checkAlerts(modelId, deploymentId, metrics);

    this.eventEmitter.emit('metrics.recorded', {
      modelId,
      deploymentId,
      metrics: savedMetrics,
    });

    return savedMetrics;
  }

  async getMetrics(
    modelId: string,
    deploymentId?: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<ModelMetrics[]> {
    const where: any = { modelId };
    
    if (deploymentId) {
      where.deploymentId = deploymentId;
    }
    
    if (startTime && endTime) {
      where.timestamp = Between(startTime, endTime);
    } else if (startTime) {
      where.timestamp = MoreThan(startTime);
    }

    return this.metricsRepository.find({
      where,
      order: { timestamp: 'DESC' },
      take: 1000,
    });
  }

  async getRealTimeMetrics(modelId: string, deploymentId?: string): Promise<any> {
    const key = deploymentId 
      ? `metrics:realtime:${deploymentId}`
      : `metrics:realtime:${modelId}`;
    
    const cached = await this.redisService.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = await this.calculateRealTimeMetrics(modelId, deploymentId);
    await this.redisService.setex(key, 30, JSON.stringify(metrics));
    
    return metrics;
  }

  async getLatencyMetrics(
    modelId: string,
    deploymentId?: string,
    timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<any> {
    const endTime = new Date();
    const startTime = this.getStartTime(timeRange, endTime);

    const metrics = await this.getMetrics(modelId, deploymentId, startTime, endTime);
    
    const latencies = metrics.map(m => m.performance.latency);
    
    return {
      p50: this.percentile(latencies.map(l => l.p50), 50),
      p95: this.percentile(latencies.map(l => l.p95), 95),
      p99: this.percentile(latencies.map(l => l.p99), 99),
      min: Math.min(...latencies.map(l => l.min)),
      max: Math.max(...latencies.map(l => l.max)),
      mean: latencies.reduce((sum, l) => sum + l.mean, 0) / latencies.length,
      timeRange,
      dataPoints: latencies.length,
    };
  }

  async getThroughputMetrics(
    modelId: string,
    deploymentId?: string,
    timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<any> {
    const endTime = new Date();
    const startTime = this.getStartTime(timeRange, endTime);

    const metrics = await this.getMetrics(modelId, deploymentId, startTime, endTime);
    
    const throughputData = metrics.map(m => m.performance.throughput);
    
    return {
      requestsPerSecond: {
        current: throughputData[throughputData.length - 1]?.requestsPerSecond || 0,
        average: throughputData.reduce((sum, t) => sum + t.requestsPerSecond, 0) / throughputData.length,
        peak: Math.max(...throughputData.map(t => t.requestsPerSecond)),
      },
      requestsPerMinute: {
        current: throughputData[throughputData.length - 1]?.requestsPerMinute || 0,
        average: throughputData.reduce((sum, t) => sum + t.requestsPerMinute, 0) / throughputData.length,
        peak: Math.max(...throughputData.map(t => t.requestsPerMinute)),
      },
      timeRange,
      dataPoints: throughputData.length,
    };
  }

  async getErrorRateMetrics(
    modelId: string,
    deploymentId?: string,
    timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<any> {
    const endTime = new Date();
    const startTime = this.getStartTime(timeRange, endTime);

    const metrics = await this.getMetrics(modelId, deploymentId, startTime, endTime);
    
    const errorRates = metrics.map(m => m.performance.errorRate);
    
    return {
      current: errorRates[errorRates.length - 1]?.percentage || 0,
      average: errorRates.reduce((sum, e) => sum + e.percentage, 0) / errorRates.length,
      peak: Math.max(...errorRates.map(e => e.percentage)),
      totalErrors: errorRates.reduce((sum, e) => sum + e.count, 0),
      totalRequests: errorRates.reduce((sum, e) => sum + e.totalRequests, 0),
      timeRange,
      dataPoints: errorRates.length,
    };
  }

  async getResourceUsageMetrics(
    modelId: string,
    deploymentId?: string,
    timeRange: '1h' | '6h' | '24h' | '7d' = '1h',
  ): Promise<any> {
    const endTime = new Date();
    const startTime = this.getStartTime(timeRange, endTime);

    const metrics = await this.getMetrics(modelId, deploymentId, startTime, endTime);
    
    const resourceData = metrics.map(m => m.performance.resourceUsage);
    
    return {
      cpu: {
        current: resourceData[resourceData.length - 1]?.cpu?.utilization || 0,
        average: resourceData.reduce((sum, r) => sum + (r.cpu?.utilization || 0), 0) / resourceData.length,
        peak: Math.max(...resourceData.map(r => r.cpu?.utilization || 0)),
      },
      memory: {
        current: resourceData[resourceData.length - 1]?.memory?.utilization || 0,
        average: resourceData.reduce((sum, r) => sum + (r.memory?.utilization || 0), 0) / resourceData.length,
        peak: Math.max(...resourceData.map(r => r.memory?.utilization || 0)),
      },
      gpu: resourceData.some(r => r.gpu) ? {
        current: resourceData[resourceData.length - 1]?.gpu?.utilization || 0,
        average: resourceData.reduce((sum, r) => sum + (r.gpu?.utilization || 0), 0) / resourceData.length,
        peak: Math.max(...resourceData.map(r => r.gpu?.utilization || 0)),
      } : null,
      timeRange,
      dataPoints: resourceData.length,
    };
  }

  async getDashboardData(modelId: string, deploymentId?: string): Promise<any> {
    const [latency, throughput, errorRate, resourceUsage] = await Promise.all([
      this.getLatencyMetrics(modelId, deploymentId),
      this.getThroughputMetrics(modelId, deploymentId),
      this.getErrorRateMetrics(modelId, deploymentId),
      this.getResourceUsageMetrics(modelId, deploymentId),
    ]);

    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    const deployment = deploymentId 
      ? await this.deploymentRepository.findOne({ where: { id: deploymentId } })
      : null;

    return {
      model: {
        id: model.id,
        name: model.name,
        version: model.version,
        format: model.format,
      },
      deployment: deployment ? {
        id: deployment.id,
        name: deployment.name,
        type: deployment.type,
        status: deployment.status,
      } : null,
      metrics: {
        latency,
        throughput,
        errorRate,
        resourceUsage,
      },
      timestamp: new Date(),
    };
  }

  private async updateRealTimeMetrics(
    modelId: string,
    deploymentId: string,
    metrics: any,
  ): Promise<void> {
    const key = `metrics:realtime:${deploymentId}`;
    const existing = await this.redisService.get(key);
    
    const realtimeMetrics = existing ? JSON.parse(existing) : {};
    
    realtimeMetrics.lastUpdate = new Date();
    realtimeMetrics.performance = metrics.performance;
    realtimeMetrics.modelSpecific = metrics.modelSpecific;
    
    await this.redisService.setex(key, 60, JSON.stringify(realtimeMetrics));
  }

  private async checkAlerts(
    modelId: string,
    deploymentId: string,
    metrics: any,
  ): Promise<void> {
    const alerts = [];

    // Latency alerts
    if (metrics.performance.latency.p95 > 5000) {
      alerts.push({
        type: 'latency',
        severity: 'high',
        message: 'P95 latency exceeded 5 seconds',
        threshold: 5000,
        actualValue: metrics.performance.latency.p95,
        triggeredAt: new Date(),
      });
    }

    // Error rate alerts
    if (metrics.performance.errorRate.percentage > 5) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: 'Error rate exceeded 5%',
        threshold: 5,
        actualValue: metrics.performance.errorRate.percentage,
        triggeredAt: new Date(),
      });
    }

    // CPU usage alerts
    if (metrics.performance.resourceUsage.cpu.utilization > 90) {
      alerts.push({
        type: 'cpu_usage',
        severity: 'medium',
        message: 'CPU usage exceeded 90%',
        threshold: 90,
        actualValue: metrics.performance.resourceUsage.cpu.utilization,
        triggeredAt: new Date(),
      });
    }

    // Memory usage alerts
    if (metrics.performance.resourceUsage.memory.utilization > 90) {
      alerts.push({
        type: 'memory_usage',
        severity: 'medium',
        message: 'Memory usage exceeded 90%',
        threshold: 90,
        actualValue: metrics.performance.resourceUsage.memory.utilization,
        triggeredAt: new Date(),
      });
    }

    if (alerts.length > 0) {
      this.eventEmitter.emit('alerts.triggered', {
        modelId,
        deploymentId,
        alerts,
      });
    }
  }

  private async calculateRealTimeMetrics(
    modelId: string,
    deploymentId?: string,
  ): Promise<any> {
    // This would typically query Prometheus or another metrics system
    // For now, return placeholder data
    return {
      timestamp: new Date(),
      performance: {
        latency: { p50: 100, p95: 200, p99: 500 },
        throughput: { requestsPerSecond: 50, requestsPerMinute: 3000 },
        errorRate: { percentage: 0.1 },
        resourceUsage: {
          cpu: { utilization: 45 },
          memory: { utilization: 60 },
        },
      },
    };
  }

  private getStartTime(timeRange: string, endTime: Date): Date {
    const startTime = new Date(endTime);
    
    switch (timeRange) {
      case '1h':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(startTime.getHours() - 6);
        break;
      case '24h':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(startTime.getDate() - 7);
        break;
    }
    
    return startTime;
  }

  private percentile(values: number[], p: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }
}
