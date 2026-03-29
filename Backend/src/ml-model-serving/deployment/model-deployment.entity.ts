import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { MLModel } from '../model-registry/entities/ml-model.entity';

export enum DeploymentStatus {
  PENDING = 'pending',
  DEPLOYING = 'deploying',
  ACTIVE = 'active',
  SCALING = 'scaling',
  FAILED = 'failed',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
}

export enum DeploymentType {
  PRODUCTION = 'production',
  CANARY = 'canary',
  STAGING = 'staging',
  TESTING = 'testing',
}

@Entity('model_deployments')
export class ModelDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MLModel, model => model.deployments)
  model: MLModel;

  @Column()
  modelId: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: DeploymentType })
  type: DeploymentType;

  @Column({ type: 'enum', enum: DeploymentStatus, default: DeploymentStatus.PENDING })
  status: DeploymentStatus;

  @Column('jsonb')
  config: {
    replicas: number;
    minReplicas: number;
    maxReplicas: number;
    cpuRequest: string;
    cpuLimit: string;
    memoryRequest: string;
    memoryLimit: string;
    gpuRequest?: string;
    gpuLimit?: string;
    autoScaling: {
      enabled: boolean;
      targetCPUUtilization?: number;
      targetMemoryUtilization?: number;
      scaleUpCooldown: number;
      scaleDownCooldown: number;
    };
    traffic: {
      percentage: number;
      canaryRules?: {
        header?: string;
        value?: string;
        percentage?: number;
      };
    };
    environment: Record<string, string>;
  };

  @Column('jsonb', { nullable: true })
  endpoints: {
    inference: string;
    health: string;
    metrics: string;
  };

  @Column('jsonb', { nullable: true })
  scaling: {
    currentReplicas: number;
    desiredReplicas: number;
    lastScaleEvent?: Date;
    scaleUpEvents: number;
    scaleDownEvents: number;
  };

  @Column('jsonb', { nullable: true })
  trafficSplitting: {
    totalWeight: number;
    deployments: Array<{
      deploymentId: string;
      weight: number;
      percentage: number;
    }>;
    lastUpdated: Date;
  };

  @Column('jsonb', { nullable: true })
  rollbackConfig: {
    enabled: boolean;
    timeout: number;
    previousDeploymentId?: string;
    rollbackThresholds: {
      errorRate: number;
      latencyP95: number;
      latencyP99: number;
    };
  };

  @Column('timestamp', { nullable: true })
  deployedAt?: Date;

  @Column('timestamp', { nullable: true })
  terminatedAt?: Date;

  @Column('jsonb', { nullable: true })
  deploymentMetadata: {
    kubernetesNamespace?: string;
    serviceName?: string;
    deploymentName?: string;
    ingressName?: string;
    configMapName?: string;
    secretName?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
