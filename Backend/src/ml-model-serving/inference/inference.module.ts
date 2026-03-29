import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { ModelDeployment } from '../deployment/model-deployment.entity';
import { RedisModule } from '../../redis/redis.module';
import { MonitoringServiceModule } from '../monitoring/monitoring.module';
import { DeploymentModule } from '../deployment/deployment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MLModel, ModelDeployment]),
    RedisModule,
    MonitoringServiceModule,
    DeploymentModule,
  ],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
