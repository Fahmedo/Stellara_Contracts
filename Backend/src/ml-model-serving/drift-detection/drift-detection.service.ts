import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { ModelDriftDetection, DriftType, DriftSeverity } from './model-drift-detection.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { ModelMetrics } from '../monitoring/model-metrics.entity';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DriftDetectionService {
  private readonly logger = new Logger(DriftDetectionService.name);

  constructor(
    @InjectRepository(ModelDriftDetection)
    private readonly driftRepository: Repository<ModelDriftDetection>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    @InjectRepository(ModelMetrics)
    private readonly metricsRepository: Repository<ModelMetrics>,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async detectDriftForAllModels(): Promise<void> {
    this.logger.log('Starting drift detection for all models');
    
    const activeDeployments = await this.deploymentRepository.find({
      where: { status: 'active' as any },
      relations: ['model'],
    });

    for (const deployment of activeDeployments) {
      try {
        await this.detectDrift(deployment.modelId, deployment.id);
      } catch (error) {
        this.logger.error(`Drift detection failed for model ${deployment.modelId}:`, error);
      }
    }

    this.logger.log('Drift detection completed for all models');
  }

  async detectDrift(modelId: string, deploymentId: string): Promise<ModelDriftDetection[]> {
    const driftDetections: ModelDriftDetection[] = [];

    // Data Drift Detection
    const dataDrift = await this.detectDataDrift(modelId, deploymentId);
    if (dataDrift) {
      driftDetections.push(dataDrift);
    }

    // Performance Drift Detection
    const performanceDrift = await this.detectPerformanceDrift(modelId, deploymentId);
    if (performanceDrift) {
      driftDetections.push(performanceDrift);
    }

    // Concept Drift Detection
    const conceptDrift = await this.detectConceptDrift(modelId, deploymentId);
    if (conceptDrift) {
      driftDetections.push(conceptDrift);
    }

    // Label Drift Detection (if applicable)
    const labelDrift = await this.detectLabelDrift(modelId, deploymentId);
    if (labelDrift) {
      driftDetections.push(labelDrift);
    }

    // Save drift detections and trigger alerts
    for (const drift of driftDetections) {
      const savedDrift = await this.driftRepository.save(drift);
      
      if (drift.severity === DriftSeverity.HIGH || drift.severity === DriftSeverity.CRITICAL) {
        await this.triggerDriftAlert(savedDrift);
      }

      this.eventEmitter.emit('drift.detected', {
        modelId,
        deploymentId,
        drift: savedDrift,
      });
    }

    return driftDetections;
  }

  private async detectDataDrift(modelId: string, deploymentId: string): Promise<ModelDriftDetection | null> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const baselineStartTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Get recent metrics for comparison
    const recentMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    const baselineMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(baselineStartTime, startTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    if (recentMetrics.length < 100 || baselineMetrics.length < 100) {
      return null; // Not enough data
    }

    // Calculate distributions for key features
    const currentInputStats = this.aggregateInputStats(recentMetrics);
    const baselineInputStats = this.aggregateInputStats(baselineMetrics);

    // Perform statistical tests (Kolmogorov-Smirnov test for distribution comparison)
    const driftScore = this.calculateKSTest(currentInputStats, baselineInputStats);
    const pValue = this.calculatePValue(driftScore);

    if (pValue < 0.05) { // Significant drift detected
      const severity = this.determineDriftSeverity(driftScore, pValue);

      return this.driftRepository.create({
        modelId,
        deploymentId,
        driftType: DriftType.DATA_DRIFT,
        severity,
        metrics: {
          driftScore,
          pValue,
          statistic: 'kolmogorov-smirnov',
          threshold: 0.05,
          baselineDistribution: baselineInputStats,
          currentDistribution: currentInputStats,
        },
        analysis: {
          method: 'kolmogorov-smirnov',
          windowSize: recentMetrics.length,
          baselinePeriod: {
            start: baselineStartTime,
            end: startTime,
          },
          detectionPeriod: {
            start: startTime,
            end: endTime,
          },
          sampleSize: recentMetrics.length,
          confidenceLevel: 0.95,
        },
        recommendations: this.generateDataDriftRecommendations(driftScore, pValue),
        timestamp: endTime,
      });
    }

    return null;
  }

  private async detectPerformanceDrift(modelId: string, deploymentId: string): Promise<ModelDriftDetection | null> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const baselineStartTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    const baselineMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(baselineStartTime, startTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    if (recentMetrics.length < 50 || baselineMetrics.length < 50) {
      return null;
    }

    const currentLatency = this.calculateAverageLatency(recentMetrics);
    const baselineLatency = this.calculateAverageLatency(baselineMetrics);
    const latencyIncrease = ((currentLatency - baselineLatency) / baselineLatency) * 100;

    const currentErrorRate = this.calculateAverageErrorRate(recentMetrics);
    const baselineErrorRate = this.calculateAverageErrorRate(baselineMetrics);
    const errorRateIncrease = ((currentErrorRate - baselineErrorRate) / baselineErrorRate) * 100;

    // Check if performance degradation is significant
    if (latencyIncrease > 20 || errorRateIncrease > 50) {
      const driftScore = Math.max(latencyIncrease, errorRateIncrease);
      const severity = this.determinePerformanceDriftSeverity(latencyIncrease, errorRateIncrease);

      return this.driftRepository.create({
        modelId,
        deploymentId,
        driftType: DriftType.PERFORMANCE_DRIFT,
        severity,
        metrics: {
          driftScore,
          pValue: 0.01, // Low p-value for significant performance change
          statistic: 'performance-degradation',
          threshold: 20,
          performanceMetrics: {
            baselineLatency,
            currentLatency,
            latencyIncrease,
            baselineErrorRate,
            currentErrorRate,
            errorRateIncrease,
          },
        },
        analysis: {
          method: 'performance-comparison',
          windowSize: recentMetrics.length,
          baselinePeriod: {
            start: baselineStartTime,
            end: startTime,
          },
          detectionPeriod: {
            start: startTime,
            end: endTime,
          },
          sampleSize: recentMetrics.length,
          confidenceLevel: 0.95,
        },
        recommendations: this.generatePerformanceDriftRecommendations(latencyIncrease, errorRateIncrease),
        timestamp: endTime,
      });
    }

    return null;
  }

  private async detectConceptDrift(modelId: string, deploymentId: string): Promise<ModelDriftDetection | null> {
    // Concept drift detection would require access to ground truth labels
    // This is a simplified implementation that looks for prediction distribution changes
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const baselineStartTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    const baselineMetrics = await this.metricsRepository.find({
      where: {
        modelId,
        deploymentId,
        timestamp: Between(baselineStartTime, startTime),
      },
      order: { timestamp: 'DESC' },
      take: 1000,
    });

    if (recentMetrics.length < 100 || baselineMetrics.length < 100) {
      return null;
    }

    const currentOutputDist = this.aggregateOutputDistribution(recentMetrics);
    const baselineOutputDist = this.aggregateOutputDistribution(baselineMetrics);

    const driftScore = this.calculateJensenShannonDivergence(currentOutputDist, baselineOutputDist);

    if (driftScore > 0.1) { // Significant change in prediction distribution
      const severity = this.determineConceptDriftSeverity(driftScore);

      return this.driftRepository.create({
        modelId,
        deploymentId,
        driftType: DriftType.CONCEPT_DRIFT,
        severity,
        metrics: {
          driftScore,
          pValue: 0.05,
          statistic: 'jensen-shannon-divergence',
          threshold: 0.1,
          baselineDistribution: baselineOutputDist,
          currentDistribution: currentOutputDist,
        },
        analysis: {
          method: 'prediction-distribution-analysis',
          windowSize: recentMetrics.length,
          baselinePeriod: {
            start: baselineStartTime,
            end: startTime,
          },
          detectionPeriod: {
            start: startTime,
            end: endTime,
          },
          sampleSize: recentMetrics.length,
          confidenceLevel: 0.95,
        },
        recommendations: this.generateConceptDriftRecommendations(driftScore),
        timestamp: endTime,
      });
    }

    return null;
  }

  private async detectLabelDrift(modelId: string, deploymentId: string): Promise<ModelDriftDetection | null> {
    // Label drift detection would require access to ground truth labels
    // This is a placeholder implementation
    return null;
  }

  private aggregateInputStats(metrics: ModelMetrics[]): Record<string, number> {
    // Simplified aggregation - in practice, you'd aggregate feature distributions
    const aggregated: Record<string, number> = {};
    
    for (const metric of metrics) {
      if (metric.inputStats.avgRequestSize) {
        aggregated.avgRequestSize = (aggregated.avgRequestSize || 0) + metric.inputStats.avgRequestSize;
      }
    }

    // Calculate averages
    Object.keys(aggregated).forEach(key => {
      aggregated[key] = aggregated[key] / metrics.length;
    });

    return aggregated;
  }

  private aggregateOutputDistribution(metrics: ModelMetrics[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const metric of metrics) {
      if (metric.outputStats.predictionDistribution) {
        Object.entries(metric.outputStats.predictionDistribution).forEach(([key, value]) => {
          distribution[key] = (distribution[key] || 0) + value;
        });
      }
    }

    // Normalize to get probability distribution
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    Object.keys(distribution).forEach(key => {
      distribution[key] = distribution[key] / total;
    });

    return distribution;
  }

  private calculateKSTest(distribution1: Record<string, number>, distribution2: Record<string, number>): number {
    // Simplified KS test implementation
    const keys = Object.keys(distribution1);
    let maxDifference = 0;

    for (const key of keys) {
      const diff = Math.abs((distribution1[key] || 0) - (distribution2[key] || 0));
      maxDifference = Math.max(maxDifference, diff);
    }

    return maxDifference;
  }

  private calculateJensenShannonDivergence(p: Record<string, number>, q: Record<string, number>): number {
    const keys = Object.keys(p);
    let divergence = 0;

    for (const key of keys) {
      const p_i = p[key] || 0;
      const q_i = q[key] || 0;
      const m_i = (p_i + q_i) / 2;
      
      if (p_i > 0) divergence += p_i * Math.log2(p_i / m_i);
      if (q_i > 0) divergence += q_i * Math.log2(q_i / m_i);
    }

    return Math.sqrt(divergence / 2);
  }

  private calculatePValue(statistic: number): number {
    // Simplified p-value calculation
    return Math.max(0.001, 1 - statistic);
  }

  private calculateAverageLatency(metrics: ModelMetrics[]): number {
    const latencies = metrics.map(m => m.performance.latency.mean);
    return latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
  }

  private calculateAverageErrorRate(metrics: ModelMetrics[]): number {
    const errorRates = metrics.map(m => m.performance.errorRate.percentage);
    return errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
  }

  private determineDriftSeverity(driftScore: number, pValue: number): DriftSeverity {
    if (driftScore > 0.5 || pValue < 0.01) return DriftSeverity.CRITICAL;
    if (driftScore > 0.3 || pValue < 0.05) return DriftSeverity.HIGH;
    if (driftScore > 0.1 || pValue < 0.1) return DriftSeverity.MEDIUM;
    return DriftSeverity.LOW;
  }

  private determinePerformanceDriftSeverity(latencyIncrease: number, errorRateIncrease: number): DriftSeverity {
    if (latencyIncrease > 100 || errorRateIncrease > 200) return DriftSeverity.CRITICAL;
    if (latencyIncrease > 50 || errorRateIncrease > 100) return DriftSeverity.HIGH;
    if (latencyIncrease > 20 || errorRateIncrease > 50) return DriftSeverity.MEDIUM;
    return DriftSeverity.LOW;
  }

  private determineConceptDriftSeverity(driftScore: number): DriftSeverity {
    if (driftScore > 0.5) return DriftSeverity.CRITICAL;
    if (driftScore > 0.3) return DriftSeverity.HIGH;
    if (driftScore > 0.1) return DriftSeverity.MEDIUM;
    return DriftSeverity.LOW;
  }

  private generateDataDriftRecommendations(driftScore: number, pValue: number): Array<any> {
    const recommendations = [];

    if (driftScore > 0.5) {
      recommendations.push({
        type: 'retrain',
        priority: 'high',
        description: 'Significant data drift detected. Model retraining recommended.',
        actionRequired: true,
        estimatedImpact: 'High - Model performance likely degraded',
      });
    } else if (driftScore > 0.3) {
      recommendations.push({
        type: 'monitor',
        priority: 'medium',
        description: 'Moderate data drift detected. Increase monitoring frequency.',
        actionRequired: false,
        estimatedImpact: 'Medium - Potential performance impact',
      });
    }

    return recommendations;
  }

  private generatePerformanceDriftRecommendations(latencyIncrease: number, errorRateIncrease: number): Array<any> {
    const recommendations = [];

    if (latencyIncrease > 50) {
      recommendations.push({
        type: 'rollback',
        priority: 'high',
        description: 'Significant latency increase detected. Consider rollback.',
        actionRequired: true,
        estimatedImpact: 'High - User experience severely affected',
      });
    }

    if (errorRateIncrease > 100) {
      recommendations.push({
        type: 'retrain',
        priority: 'high',
        description: 'Significant error rate increase detected. Model retraining required.',
        actionRequired: true,
        estimatedImpact: 'Critical - Model reliability compromised',
      });
    }

    return recommendations;
  }

  private generateConceptDriftRecommendations(driftScore: number): Array<any> {
    const recommendations = [];

    if (driftScore > 0.3) {
      recommendations.push({
        type: 'investigate',
        priority: 'high',
        description: 'Concept drift detected. Investigate underlying data patterns.',
        actionRequired: true,
        estimatedImpact: 'High - Model predictions may no longer be valid',
      });
    }

    return recommendations;
  }

  private async triggerDriftAlert(drift: ModelDriftDetection): Promise<void> {
    this.eventEmitter.emit('drift.alert', {
      modelId: drift.modelId,
      deploymentId: drift.deploymentId,
      driftType: drift.driftType,
      severity: drift.severity,
      driftScore: drift.metrics.driftScore,
      recommendations: drift.recommendations,
    });

    this.logger.warn(
      `Drift alert triggered for model ${drift.modelId}: ${drift.driftType} - ${drift.severity}`
    );
  }

  async getDriftHistory(
    modelId: string,
    deploymentId?: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<ModelDriftDetection[]> {
    const where: any = { modelId };
    
    if (deploymentId) {
      where.deploymentId = deploymentId;
    }
    
    if (startTime && endTime) {
      where.timestamp = Between(startTime, endTime);
    } else if (startTime) {
      where.timestamp = MoreThan(startTime);
    }

    return this.driftRepository.find({
      where,
      order: { timestamp: 'DESC' },
      take: 1000,
    });
  }

  async resolveDrift(driftId: string, resolutionNotes: string): Promise<ModelDriftDetection> {
    const drift = await this.driftRepository.findOne({ where: { id: driftId } });
    
    if (!drift) {
      throw new Error(`Drift detection ${driftId} not found`);
    }

    drift.isResolved = true;
    drift.resolvedAt = new Date();
    drift.resolutionNotes = resolutionNotes;

    const resolvedDrift = await this.driftRepository.save(drift);

    this.eventEmitter.emit('drift.resolved', {
      modelId: drift.modelId,
      deploymentId: drift.deploymentId,
      driftId,
      resolutionNotes,
    });

    return resolvedDrift;
  }
}
