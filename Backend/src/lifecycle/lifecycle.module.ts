import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { RedisModule } from '../redis/redis.module';
import { ApplicationStateService } from './application-state.service';
import { InflightRequestMiddleware } from './inflight-request.middleware';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [ApplicationStateService, InflightRequestMiddleware],
  controllers: [HealthController],
  exports: [ApplicationStateService, InflightRequestMiddleware],
})
export class LifecycleModule {}
