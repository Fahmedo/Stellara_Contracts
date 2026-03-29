import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ModelDeployment, DeploymentStatus, DeploymentType } from './model-deployment.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KubernetesService } from './kubernetes.service';
import { TrafficSplittingService } from './traffic-splitting.service';
import { AutoScalingService } from './auto-scaling.service';

@Injectable()
export class DeploymentService {
  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly kubernetesService: KubernetesService,
    private readonly trafficSplittingService: TrafficSplittingService,
    private readonly autoScalingService: AutoScalingService,
  ) {}

  async create(createDeploymentDto: CreateDeploymentDto): Promise<ModelDeployment> {
    const model = await this.modelRepository.findOne({
      where: { id: createDeploymentDto.modelId },
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${createDeploymentDto.modelId} not found`);
    }

    const existingDeployment = await this.deploymentRepository.findOne({
      where: { name: createDeploymentDto.name },
    });

    if (existingDeployment) {
      throw new ConflictException(`Deployment ${createDeploymentDto.name} already exists`);
    }

    const deployment = this.deploymentRepository.create({
      ...createDeploymentDto,
      model,
      modelId: createDeploymentDto.modelId,
      status: DeploymentStatus.PENDING,
      scaling: {
        currentReplicas: createDeploymentDto.config.replicas,
        desiredReplicas: createDeploymentDto.config.replicas,
        scaleUpEvents: 0,
        scaleDownEvents: 0,
      },
    });

    const savedDeployment = await this.deploymentRepository.save(deployment);

    this.eventEmitter.emit('deployment.created', {
      deploymentId: savedDeployment.id,
      modelId: savedDeployment.modelId,
      name: savedDeployment.name,
    });

    await this.deploy(savedDeployment.id);
    return savedDeployment;
  }

  async findAll(modelId?: string, status?: DeploymentStatus): Promise<ModelDeployment[]> {
    const where: any = {};
    if (modelId) where.modelId = modelId;
    if (status) where.status = status;

    return this.deploymentRepository.find({
      where,
      relations: ['model'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ModelDeployment> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      relations: ['model'],
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${id} not found`);
    }

    return deployment;
  }

  async update(id: string, updateDeploymentDto: UpdateDeploymentDto): Promise<ModelDeployment> {
    const deployment = await this.findOne(id);
    
    Object.assign(deployment, updateDeploymentDto);
    const updatedDeployment = await this.deploymentRepository.save(deployment);

    await this.redisService.del(`deployment:${id}`);

    this.eventEmitter.emit('deployment.updated', {
      deploymentId: updatedDeployment.id,
      modelId: updatedDeployment.modelId,
      name: updatedDeployment.name,
    });

    return updatedDeployment;
  }

  async deploy(id: string): Promise<ModelDeployment> {
    const deployment = await this.findOne(id);
    
    deployment.status = DeploymentStatus.DEPLOYING;
    await this.deploymentRepository.save(deployment);

    try {
      const k8sDeployment = await this.kubernetesService.createDeployment(deployment);
      const service = await this.kubernetesService.createService(deployment);
      const ingress = await this.kubernetesService.createIngress(deployment);

      deployment.endpoints = {
        inference: `https://${ingress.host}/predict`,
        health: `https://${ingress.host}/health`,
        metrics: `https://${ingress.host}/metrics`,
      };

      deployment.deploymentMetadata = {
        kubernetesNamespace: k8sDeployment.namespace,
        serviceName: service.name,
        deploymentName: k8sDeployment.name,
        ingressName: ingress.name,
      };

      deployment.status = DeploymentStatus.ACTIVE;
      deployment.deployedAt = new Date();

      const savedDeployment = await this.deploymentRepository.save(deployment);

      await this.trafficSplittingService.updateTrafficSplitting(deployment.modelId);
      await this.autoScalingService.startAutoScaling(deployment.id);

      this.eventEmitter.emit('deployment.deployed', {
        deploymentId: savedDeployment.id,
        modelId: savedDeployment.modelId,
        name: savedDeployment.name,
        endpoints: savedDeployment.endpoints,
      });

      return savedDeployment;
    } catch (error) {
      deployment.status = DeploymentStatus.FAILED;
      await this.deploymentRepository.save(deployment);

      this.eventEmitter.emit('deployment.failed', {
        deploymentId: deployment.id,
        modelId: deployment.modelId,
        name: deployment.name,
        error: error.message,
      });

      throw error;
    }
  }

  async createCanaryDeployment(
    modelId: string,
    trafficPercentage: number = 10,
    config?: any,
  ): Promise<ModelDeployment> {
    const productionDeployment = await this.deploymentRepository.findOne({
      where: { 
        modelId, 
        type: DeploymentType.PRODUCTION, 
        status: DeploymentStatus.ACTIVE 
      },
      relations: ['model'],
    });

    if (!productionDeployment) {
      throw new NotFoundException(`No production deployment found for model ${modelId}`);
    }

    const canaryConfig = config || productionDeployment.config;
    canaryConfig.traffic = { percentage: trafficPercentage };

    const canaryDeployment = await this.create({
      modelId,
      name: `${productionDeployment.model.name}-canary-${Date.now()}`,
      type: DeploymentType.CANARY,
      config: canaryConfig,
    });

    await this.trafficSplittingService.setupCanaryTraffic(
      productionDeployment.id,
      canaryDeployment.id,
      trafficPercentage,
    );

    return canaryDeployment;
  }

  async rollback(deploymentId: string): Promise<ModelDeployment> {
    const deployment = await this.findOne(deploymentId);
    
    if (!deployment.rollbackConfig?.enabled) {
      throw new ConflictException('Rollback not enabled for this deployment');
    }

    const previousDeployment = deployment.rollbackConfig.previousDeploymentId
      ? await this.findOne(deployment.rollbackConfig.previousDeploymentId)
      : await this.findPreviousProductionDeployment(deployment.modelId);

    if (!previousDeployment) {
      throw new NotFoundException('No previous deployment found for rollback');
    }

    this.eventEmitter.emit('deployment.rollback.started', {
      deploymentId: deployment.id,
      previousDeploymentId: previousDeployment.id,
      modelId: deployment.modelId,
    });

    await this.terminate(deploymentId);
    await this.deploy(previousDeployment.id);

    return previousDeployment;
  }

  async terminate(id: string): Promise<ModelDeployment> {
    const deployment = await this.findOne(id);
    
    deployment.status = DeploymentStatus.TERMINATING;
    await this.deploymentRepository.save(deployment);

    try {
      await this.kubernetesService.deleteDeployment(deployment);
      await this.kubernetesService.deleteService(deployment);
      await this.kubernetesService.deleteIngress(deployment);

      await this.autoScalingService.stopAutoScaling(id);
      await this.trafficSplittingService.removeFromTrafficSplitting(id);

      deployment.status = DeploymentStatus.TERMINATED;
      deployment.terminatedAt = new Date();

      const savedDeployment = await this.deploymentRepository.save(deployment);

      this.eventEmitter.emit('deployment.terminated', {
        deploymentId: savedDeployment.id,
        modelId: savedDeployment.modelId,
        name: savedDeployment.name,
      });

      return savedDeployment;
    } catch (error) {
      deployment.status = DeploymentStatus.FAILED;
      await this.deploymentRepository.save(deployment);
      throw error;
    }
  }

  async scale(deploymentId: string, replicas: number): Promise<ModelDeployment> {
    const deployment = await this.findOne(deploymentId);
    
    deployment.config.replicas = replicas;
    deployment.scaling.desiredReplicas = replicas;
    deployment.status = DeploymentStatus.SCALING;

    const savedDeployment = await this.deploymentRepository.save(deployment);

    await this.kubernetesService.scaleDeployment(deploymentId, replicas);

    this.eventEmitter.emit('deployment.scaled', {
      deploymentId,
      modelId: deployment.modelId,
      replicas,
    });

    return savedDeployment;
  }

  async getDeploymentMetrics(id: string): Promise<any> {
    const cacheKey = `deployment:${id}:metrics`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const deployment = await this.findOne(id);
    const metrics = await this.kubernetesService.getDeploymentMetrics(deployment);

    await this.redisService.setex(cacheKey, 30, JSON.stringify(metrics));
    return metrics;
  }

  private async findPreviousProductionDeployment(modelId: string): Promise<ModelDeployment | null> {
    return this.deploymentRepository.findOne({
      where: { 
        modelId, 
        type: DeploymentType.PRODUCTION, 
        status: DeploymentStatus.TERMINATED 
      },
      order: { terminatedAt: 'DESC' },
      relations: ['model'],
    });
  }
}
