import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { ModelMetrics } from '../monitoring/model-metrics.entity';

export enum ModelFormat {
  TENSORFLOW = 'tensorflow',
  PYTORCH = 'pytorch',
  ONNX = 'onnx',
}

export enum ModelStatus {
  TRAINING = 'training',
  READY = 'ready',
  DEPLOYING = 'deploying',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

@Entity('ml_models')
export class MLModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  version: string;

  @Column({ type: 'enum', enum: ModelFormat })
  format: ModelFormat;

  @Column({ type: 'enum', enum: ModelStatus, default: ModelStatus.TRAINING })
  status: ModelStatus;

  @Column('jsonb')
  metadata: {
    accuracy?: number;
    trainingDate?: Date;
    features?: string[];
    hyperparameters?: Record<string, any>;
    datasetInfo?: Record<string, any>;
    framework?: string;
    dependencies?: string[];
  };

  @Column()
  modelPath: string;

  @Column('jsonb')
  inputSchema: Record<string, any>;

  @Column('jsonb')
  outputSchema: Record<string, any>;

  @Column({ default: false })
  isProduction: boolean;

  @Column({ type: 'timestamp', nullable: true })
  productionDeployedAt?: Date;

  @Column('jsonb', { nullable: true })
  performanceMetrics?: {
    latency: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };

  @OneToMany(() => ModelDeployment, deployment => deployment.model)
  deployments: ModelDeployment[];

  @OneToMany(() => ModelMetrics, metrics => metrics.model)
  metrics: ModelMetrics[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
