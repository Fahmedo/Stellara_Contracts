import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { DistributedLockService } from './distributed-lock.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          ttl: 60, // default TTL in seconds
        }),
      }),
      isGlobal: true,
    }),
  ],
  providers: [RedisService, DistributedLockService],
  exports: [CacheModule, RedisService, DistributedLockService],
})
export class RedisModule {}
