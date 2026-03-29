import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrismaModule } from '../prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ModelRegistryModule } from './model-registry/model-registry.module';
import { InferenceModule } from './inference/inference.module';
import { DeploymentModule } from './deployment/deployment.module';
import { MonitoringServiceModule } from './monitoring/monitoring.module';
import { DriftDetectionModule } from './drift-detection/drift-detection.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    MonitoringModule,
    ModelRegistryModule,
    InferenceModule,
    DeploymentModule,
    MonitoringServiceModule,
    DriftDetectionModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    ModelRegistryModule,
    InferenceModule,
    DeploymentModule,
    MonitoringServiceModule,
    DriftDetectionModule,
  ],
})
export class MLModelServingModule {}
