import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { MLModel } from '../model-registry/entities/ml-model.entity';

@Entity('model_metrics')
@Index(['modelId', 'timestamp'])
export class ModelMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  modelId: string;

  @ManyToOne(() => MLModel, model => model.metrics)
  model: MLModel;

  @Column()
  deploymentId: string;

  @Column('timestamp')
  timestamp: Date;

  @Column('jsonb')
  performance: {
    latency: {
      p50: number;
      p95: number;
      p99: number;
      min: number;
      max: number;
      mean: number;
      median: number;
    };
    throughput: {
      requestsPerSecond: number;
      requestsPerMinute: number;
      requestsPerHour: number;
    };
    errorRate: {
      percentage: number;
      count: number;
      totalRequests: number;
    };
    resourceUsage: {
      cpu: {
        utilization: number;
        request: string;
        limit: string;
      };
      memory: {
        utilization: number;
        request: string;
        limit: string;
        used: string;
        available: string;
      };
      gpu?: {
        utilization: number;
        memoryUsed: string;
        memoryTotal: string;
      };
    };
  };

  @Column('jsonb')
  modelSpecific: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    customMetrics?: Record<string, number>;
  };

  @Column('jsonb')
  inputStats: {
    requestCount: number;
    avgRequestSize: number;
    inputDistribution?: Record<string, number>;
    featureStats?: Record<string, {
      mean: number;
      std: number;
      min: number;
      max: number;
    }>;
  };

  @Column('jsonb')
  outputStats: {
    responseCount: number;
    avgResponseSize: number;
    outputDistribution?: Record<string, number>;
    predictionDistribution?: Record<string, number>;
  };

  @Column('jsonb', { nullable: true })
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    threshold: number;
    actualValue: number;
    triggeredAt: Date;
  }>;

  @CreateDateColumn()
  createdAt: Date;
}
