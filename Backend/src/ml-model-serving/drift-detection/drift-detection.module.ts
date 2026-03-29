import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriftDetectionController } from './drift-detection.controller';
import { DriftDetectionService } from './drift-detection.service';
import { ModelDriftDetection } from './model-drift-detection.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { ModelMetrics } from '../monitoring/model-metrics.entity';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelDriftDetection, MLModel, ModelDeployment, ModelMetrics]),
    RedisModule,
  ],
  controllers: [DriftDetectionController],
  providers: [DriftDetectionService],
  exports: [DriftDetectionService],
})
export class DriftDetectionModule {}
