import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelDeployment } from './model-deployment.entity';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { KubernetesService } from './kubernetes.service';

@Injectable()
export class AutoScalingService {
  private readonly logger = new Logger(AutoScalingService.name);
  private readonly scalingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly kubernetesService: KubernetesService,
  ) {}

  async startAutoScaling(deploymentId: string): Promise<void> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
      relations: ['model'],
    });

    if (!deployment || !deployment.config.autoScaling.enabled) {
      return;
    }

    if (this.scalingIntervals.has(deploymentId)) {
      this.logger.warn(`Auto-scaling already started for deployment ${deploymentId}`);
      return;
    }

    const interval = setInterval(
      () => this.checkAndScale(deploymentId),
      30000, // Check every 30 seconds
    );

    this.scalingIntervals.set(deploymentId, interval);
    
    this.logger.log(`Started auto-scaling for deployment ${deploymentId}`);
  }

  async stopAutoScaling(deploymentId: string): Promise<void> {
    const interval = this.scalingIntervals.get(deploymentId);
    
    if (interval) {
      clearInterval(interval);
      this.scalingIntervals.delete(deploymentId);
      this.logger.log(`Stopped auto-scaling for deployment ${deploymentId}`);
    }
  }

  private async checkAndScale(deploymentId: string): Promise<void> {
    try {
      const deployment = await this.deploymentRepository.findOne({
        where: { id: deploymentId },
        relations: ['model'],
      });

      if (!deployment || deployment.status !== 'active') {
        await this.stopAutoScaling(deploymentId);
        return;
      }

      const metrics = await this.getDeploymentMetrics(deployment);
      const decision = this.makeScalingDecision(deployment, metrics);

      if (decision.shouldScale) {
        await this.executeScaling(deployment, decision.replicas);
      }
    } catch (error) {
      this.logger.error(`Error during auto-scaling check for deployment ${deploymentId}:`, error);
    }
  }

  private async getDeploymentMetrics(deployment: ModelDeployment): Promise<any> {
    const cacheKey = `deployment:${deployment.id}:metrics:autoscaling`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const k8sMetrics = await this.kubernetesService.getDeploymentMetrics(deployment);
      
      const requestMetrics = await this.getRequestMetrics(deployment.id);
      
      const metrics = {
        ...k8sMetrics,
        ...requestMetrics,
        timestamp: new Date(),
      };

      await this.redisService.setex(cacheKey, 15, JSON.stringify(metrics));
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get metrics for deployment ${deployment.id}:`, error);
      return null;
    }
  }

  private async getRequestMetrics(deploymentId: string): Promise<any> {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const requestCount = await this.redisService.zcount(
      `requests:${deploymentId}:timestamps`,
      fiveMinutesAgo / 1000,
      now / 1000
    );

    const avgLatency = await this.getAverageLatency(deploymentId, fiveMinutesAgo);
    const errorRate = await this.getErrorRate(deploymentId, fiveMinutesAgo);

    return {
      requestsPerMinute: requestCount / 5,
      averageLatency: avgLatency,
      errorRate: errorRate,
    };
  }

  private async getAverageLatency(deploymentId: string, since: number): Promise<number> {
    const latencies = await this.redisService.zrangebyscore(
      `requests:${deploymentId}:latencies`,
      since / 1000,
      Date.now() / 1000,
      'WITHSCORES'
    );

    if (latencies.length === 0) return 0;

    const totalLatency = latencies.reduce((sum, latency) => sum + parseFloat(latency), 0);
    return totalLatency / (latencies.length / 2);
  }

  private async getErrorRate(deploymentId: string, since: number): Promise<number> {
    const totalRequests = await this.redisService.zcount(
      `requests:${deploymentId}:timestamps`,
      since / 1000,
      Date.now() / 1000
    );

    if (totalRequests === 0) return 0;

    const errorRequests = await this.redisService.zcount(
      `requests:${deploymentId}:errors`,
      since / 1000,
      Date.now() / 1000
    );

    return (errorRequests / totalRequests) * 100;
  }

  private makeScalingDecision(deployment: ModelDeployment, metrics: any): any {
    if (!metrics) {
      return { shouldScale: false };
    }

    const config = deployment.config.autoScaling;
    const currentReplicas = deployment.scaling.currentReplicas;
    const desiredReplicas = currentReplicas;

    let shouldScale = false;
    let newReplicas = currentReplicas;

    // Scale up based on CPU utilization
    if (config.targetCPUUtilization && metrics.cpuUtilization > config.targetCPUUtilization) {
      newReplicas = Math.min(
        Math.ceil(currentReplicas * 1.5),
        deployment.config.maxReplicas
      );
      shouldScale = true;
    }

    // Scale up based on memory utilization
    if (config.targetMemoryUtilization && metrics.memoryUtilization > config.targetMemoryUtilization) {
      newReplicas = Math.min(
        Math.ceil(currentReplicas * 1.5),
        deployment.config.maxReplicas
      );
      shouldScale = true;
    }

    // Scale up based on request rate
    if (metrics.requestsPerMinute > currentReplicas * 100) {
      newReplicas = Math.min(
        Math.ceil(metrics.requestsPerMinute / 100),
        deployment.config.maxReplicas
      );
      shouldScale = true;
    }

    // Scale down based on low utilization
    if (
      currentReplicas > deployment.config.minReplicas &&
      metrics.cpuUtilization < (config.targetCPUUtilization || 70) * 0.5 &&
      metrics.memoryUtilization < (config.targetMemoryUtilization || 70) * 0.5 &&
      metrics.requestsPerMinute < currentReplicas * 50
    ) {
      newReplicas = Math.max(
        Math.ceil(currentReplicas * 0.8),
        deployment.config.minReplicas
      );
      shouldScale = true;
    }

    // Check cooldown periods
    if (shouldScale) {
      const lastScaleEvent = deployment.scaling.lastScaleEvent;
      const cooldownPeriod = newReplicas > currentReplicas 
        ? config.scaleUpCooldown * 1000 
        : config.scaleDownCooldown * 1000;

      if (lastScaleEvent && (Date.now() - lastScaleEvent.getTime()) < cooldownPeriod) {
        shouldScale = false;
        newReplicas = currentReplicas;
      }
    }

    return {
      shouldScale: shouldScale && newReplicas !== currentReplicas,
      replicas: newReplicas,
      reason: shouldScale ? this.getScalingReason(deployment, metrics, newReplicas) : null,
    };
  }

  private getScalingReason(deployment: ModelDeployment, metrics: any, newReplicas: number): string {
    const currentReplicas = deployment.scaling.currentReplicas;
    
    if (newReplicas > currentReplicas) {
      return `Scale up from ${currentReplicas} to ${newReplicas} replicas due to high load`;
    } else {
      return `Scale down from ${currentReplicas} to ${newReplicas} replicas due to low load`;
    }
  }

  private async executeScaling(deployment: ModelDeployment, newReplicas: number): Promise<void> {
    try {
      await this.kubernetesService.scaleDeployment(deployment.id, newReplicas);

      deployment.scaling.currentReplicas = newReplicas;
      deployment.scaling.desiredReplicas = newReplicas;
      deployment.scaling.lastScaleEvent = new Date();
      
      if (newReplicas > deployment.scaling.currentReplicas) {
        deployment.scaling.scaleUpEvents++;
      } else {
        deployment.scaling.scaleDownEvents++;
      }

      await this.deploymentRepository.save(deployment);

      this.eventEmitter.emit('deployment.autoscaled', {
        deploymentId: deployment.id,
        modelId: deployment.modelId,
        oldReplicas: deployment.scaling.currentReplicas,
        newReplicas,
        timestamp: new Date(),
      });

      this.logger.log(
        `Scaled deployment ${deployment.name} from ${deployment.scaling.currentReplicas} to ${newReplicas} replicas`
      );

    } catch (error) {
      this.logger.error(`Failed to scale deployment ${deployment.id}:`, error);
    }
  }

  async getAutoScalingMetrics(deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const metrics = await this.getDeploymentMetrics(deployment);
    const decision = this.makeScalingDecision(deployment, metrics);

    return {
      deploymentId,
      autoScaling: deployment.config.autoScaling,
      currentReplicas: deployment.scaling.currentReplicas,
      desiredReplicas: deployment.scaling.desiredReplicas,
      lastScaleEvent: deployment.scaling.lastScaleEvent,
      scaleUpEvents: deployment.scaling.scaleUpEvents,
      scaleDownEvents: deployment.scaling.scaleDownEvents,
      metrics,
      nextScalingDecision: decision,
      isAutoScalingEnabled: this.scalingIntervals.has(deploymentId),
    };
  }

  async onModuleDestroy(): Promise<void> {
    for (const [deploymentId, interval] of this.scalingIntervals) {
      clearInterval(interval);
    }
    this.scalingIntervals.clear();
  }
}
