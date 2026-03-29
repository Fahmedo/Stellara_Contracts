import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelDeployment } from './model-deployment.entity';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TrafficSplittingService {
  private readonly logger = new Logger(TrafficSplittingService.name);

  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    private readonly redisService: RedisService,
  ) {}

  async updateTrafficSplitting(modelId: string): Promise<void> {
    const deployments = await this.deploymentRepository.find({
      where: { 
        modelId,
        status: 'active' as any,
      },
      relations: ['model'],
    });

    if (deployments.length === 0) {
      this.logger.warn(`No active deployments found for model ${modelId}`);
      return;
    }

    const trafficSplitting = this.calculateTrafficSplitting(deployments);
    const cacheKey = `traffic-splitting:${modelId}`;

    await this.redisService.setex(cacheKey, 300, JSON.stringify(trafficSplitting));

    await Promise.all(
      deployments.map(deployment => 
        this.updateDeploymentTrafficConfig(deployment, trafficSplitting)
      )
    );

    this.logger.log(`Updated traffic splitting for model ${modelId}:`, trafficSplitting);
  }

  async setupCanaryTraffic(
    productionDeploymentId: string,
    canaryDeploymentId: string,
    canaryPercentage: number,
  ): Promise<void> {
    const productionDeployment = await this.deploymentRepository.findOne({
      where: { id: productionDeploymentId },
      relations: ['model'],
    });

    const canaryDeployment = await this.deploymentRepository.findOne({
      where: { id: canaryDeploymentId },
      relations: ['model'],
    });

    if (!productionDeployment || !canaryDeployment) {
      throw new Error('Production or canary deployment not found');
    }

    const productionPercentage = 100 - canaryPercentage;

    productionDeployment.config.traffic.percentage = productionPercentage;
    canaryDeployment.config.traffic.percentage = canaryPercentage;

    await this.deploymentRepository.save([productionDeployment, canaryDeployment]);

    await this.updateTrafficSplitting(productionDeployment.modelId);

    this.logger.log(
      `Setup canary traffic: ${productionDeployment.name} (${productionPercentage}%), ` +
      `${canaryDeployment.name} (${canaryPercentage}%)`
    );
  }

  async promoteCanaryToProduction(canaryDeploymentId: string): Promise<void> {
    const canaryDeployment = await this.deploymentRepository.findOne({
      where: { id: canaryDeploymentId },
      relations: ['model'],
    });

    if (!canaryDeployment) {
      throw new Error('Canary deployment not found');
    }

    const deployments = await this.deploymentRepository.find({
      where: { 
        modelId: canaryDeployment.modelId,
        status: 'active' as any,
      },
    });

    for (const deployment of deployments) {
      if (deployment.id === canaryDeploymentId) {
        deployment.type = 'production' as any;
        deployment.config.traffic.percentage = 100;
      } else {
        deployment.config.traffic.percentage = 0;
      }
      await this.deploymentRepository.save(deployment);
    }

    await this.updateTrafficSplitting(canaryDeployment.modelId);

    this.logger.log(`Promoted canary ${canaryDeployment.name} to production`);
  }

  async getTrafficSplitting(modelId: string): Promise<any> {
    const cacheKey = `traffic-splitting:${modelId}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const deployments = await this.deploymentRepository.find({
      where: { 
        modelId,
        status: 'active' as any,
      },
      relations: ['model'],
    });

    return this.calculateTrafficSplitting(deployments);
  }

  async routeRequest(modelId: string, requestHeaders?: Record<string, string>): Promise<string> {
    const trafficSplitting = await this.getTrafficSplitting(modelId);
    
    if (trafficSplitting.deployments.length === 0) {
      throw new Error('No active deployments found for model');
    }

    const canaryDeployment = trafficSplitting.deployments.find(d => d.type === 'canary');
    
    if (canaryDeployment && this.shouldRouteToCanary(canaryDeployment, requestHeaders)) {
      return canaryDeployment.deploymentId;
    }

    const random = Math.random() * 100;
    let cumulativePercentage = 0;

    for (const deployment of trafficSplitting.deployments) {
      cumulativePercentage += deployment.percentage;
      if (random <= cumulativePercentage) {
        return deployment.deploymentId;
      }
    }

    return trafficSplitting.deployments[0].deploymentId;
  }

  private calculateTrafficSplitting(deployments: ModelDeployment[]): any {
    const totalWeight = deployments.reduce((sum, d) => sum + d.config.traffic.percentage, 0);
    
    const deploymentTraffic = deployments.map(deployment => ({
      deploymentId: deployment.id,
      name: deployment.name,
      type: deployment.type,
      weight: deployment.config.traffic.percentage,
      percentage: (deployment.config.traffic.percentage / totalWeight) * 100,
    }));

    return {
      modelId: deployments[0].modelId,
      modelName: deployments[0].model.name,
      totalWeight,
      deployments: deploymentTraffic,
      lastUpdated: new Date(),
    };
  }

  private shouldRouteToCanary(canaryDeployment: any, requestHeaders?: Record<string, string>): boolean {
    if (!requestHeaders || !canaryDeployment.config.traffic.canaryRules) {
      return false;
    }

    const { header, value } = canaryDeployment.config.traffic.canaryRules;
    
    if (header && value && requestHeaders[header] === value) {
      return true;
    }

    return false;
  }

  private async updateDeploymentTrafficConfig(deployment: ModelDeployment, trafficSplitting: any): Promise<void> {
    const deploymentTraffic = trafficSplitting.deployments.find(d => d.deploymentId === deployment.id);
    
    if (deploymentTraffic) {
      deployment.trafficSplitting = trafficSplitting;
      await this.deploymentRepository.save(deployment);
    }
  }

  async getDeploymentMetrics(deploymentId: string): Promise<any> {
    const cacheKey = `deployment:${deploymentId}:traffic-metrics`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
      relations: ['model'],
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const metrics = {
      deploymentId,
      modelName: deployment.model.name,
      trafficPercentage: deployment.config.traffic.percentage,
      requestCount: await this.getRequestCount(deploymentId),
      errorRate: await this.getErrorRate(deploymentId),
      avgLatency: await this.getAverageLatency(deploymentId),
    };

    await this.redisService.setex(cacheKey, 60, JSON.stringify(metrics));
    return metrics;
  }

  private async getRequestCount(deploymentId: string): Promise<number> {
    const key = `requests:${deploymentId}:count`;
    const count = await this.redisService.get(key);
    return parseInt(count || '0', 10);
  }

  private async getErrorRate(deploymentId: string): Promise<number> {
    const totalKey = `requests:${deploymentId}:total`;
    const errorKey = `requests:${deploymentId}:errors`;
    
    const total = await this.redisService.get(totalKey);
    const errors = await this.redisService.get(errorKey);
    
    if (!total || parseInt(total, 10) === 0) {
      return 0;
    }
    
    return (parseInt(errors || '0', 10) / parseInt(total, 10)) * 100;
  }

  private async getAverageLatency(deploymentId: string): Promise<number> {
    const key = `requests:${deploymentId}:latency`;
    const latency = await this.redisService.get(key);
    return parseFloat(latency || '0');
  }
}
