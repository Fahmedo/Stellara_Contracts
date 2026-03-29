import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { KubernetesService } from './kubernetes.service';
import { TrafficSplittingService } from './traffic-splitting.service';
import { AutoScalingService } from './auto-scaling.service';
import { ModelDeployment } from './model-deployment.entity';
import { MLModel } from '../model-registry/entities/ml-model.entity';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelDeployment, MLModel]),
    RedisModule,
  ],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    KubernetesService,
    TrafficSplittingService,
    AutoScalingService,
  ],
  exports: [
    DeploymentService,
    KubernetesService,
    TrafficSplittingService,
    AutoScalingService,
  ],
})
export class DeploymentModule {}
