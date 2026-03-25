import { AuditModule } from './audit/audit.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { RateLimitModule } from './rate-limiting/rate-limit.module';
import { SessionModule } from './sessions/session.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { IndexAnalysisModule } from './index-analysis/index-analysis.module';
import { BackupModule } from './backup/backup.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database.module';
import { ErrorHandlingModule } from './common/error-handling.module';
import { LoggingModule } from './logging/logging.module';
import { Module } from '@nestjs/common';
import { ReputationModule } from './reputation/reputation.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { WebsocketModule } from './websocket/websocket.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    // Structured logging with correlation IDs and performance tracing
    LoggingModule.forRoot({
      enableRequestLogging: true,
      enablePerformanceTracing: true,
      defaultContext: 'Application',
    }),
    // Global rate limiting with Redis storage
    ThrottlerModule.forRootAsync({
      useFactory: () =>
        ({
          ttl: 60, // time window in seconds
          limit: 100, // default requests per window
          storage: new ThrottlerStorageRedisService({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
          }),
        }) as never,
    }),
    // Error handling with global filters
    ErrorHandlingModule,
    // Comprehensive audit logging for compliance
    AuditModule,
    ReputationModule,
    RedisModule,
    DatabaseModule,
    LifecycleModule,
    RateLimitModule,
    SessionModule,
    IndexAnalysisModule,
    AuthModule,
    WebsocketModule,
    // Backup and disaster recovery module
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
