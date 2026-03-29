import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { MLModel } from '../model-registry/entities/ml-model.entity';

export enum DriftType {
  DATA_DRIFT = 'data_drift',
  CONCEPT_DRIFT = 'concept_drift',
  PERFORMANCE_DRIFT = 'performance_drift',
  LABEL_DRIFT = 'label_drift',
}

export enum DriftSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('model_drift_detections')
@Index(['modelId', 'timestamp'])
export class ModelDriftDetection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  modelId: string;

  @ManyToOne(() => MLModel, model => model.metrics)
  model: MLModel;

  @Column()
  deploymentId: string;

  @Column({ type: 'enum', enum: DriftType })
  driftType: DriftType;

  @Column({ type: 'enum', enum: DriftSeverity })
  severity: DriftSeverity;

  @Column('jsonb')
  metrics: {
    driftScore: number;
    pValue: number;
    statistic: string;
    threshold: number;
    baselineDistribution: Record<string, number>;
    currentDistribution: Record<string, number>;
    featureDrift?: Array<{
      feature: string;
      driftScore: number;
      pValue: number;
      statistic: string;
    }>;
    performanceMetrics?: {
      baselineAccuracy: number;
      currentAccuracy: number;
      accuracyDrop: number;
      baselineLatency: number;
      currentLatency: number;
      latencyIncrease: number;
    };
  };

  @Column('jsonb')
  analysis: {
    method: string;
    windowSize: number;
    baselinePeriod: {
      start: Date;
      end: Date;
    };
    detectionPeriod: {
      start: Date;
      end: Date;
    };
    sampleSize: number;
    confidenceLevel: number;
  };

  @Column('jsonb')
  recommendations: Array<{
    type: 'retrain' | 'monitor' | 'rollback' | 'investigate';
    priority: 'low' | 'medium' | 'high';
    description: string;
    actionRequired: boolean;
    estimatedImpact: string;
  }>;

  @Column({ default: false })
  isResolved: boolean;

  @Column('timestamp', { nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolutionNotes?: string;

  @Column('jsonb', { nullable: true })
  alerts?: Array<{
    type: string;
    message: string;
    sentAt: Date;
    channel: string;
  }>;

  @Column('timestamp')
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
