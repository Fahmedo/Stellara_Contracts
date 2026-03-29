import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { ModelMetrics } from './model-metrics.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelMetrics, MLModel, ModelDeployment]),
    RedisModule,
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringServiceModule {}
