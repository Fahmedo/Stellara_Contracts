import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../redis/redis.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { RateLimitService } from './rate-limit.service';
import { RateLimitController } from './rate-limit.controller';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RedisModule, LifecycleModule],
  providers: [RateLimitService, UserThrottlerGuard],
  controllers: [RateLimitController],
  exports: [RateLimitService, UserThrottlerGuard],
})
export class RateLimitModule {}
