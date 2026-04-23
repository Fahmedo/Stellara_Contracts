import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { UserController } from './user.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { ReputationModule } from './reputation/reputation.module';
import { DatabaseModule } from './database.module';
import { HealthModule } from './health/health.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationModule } from './notification/notification.module';
import { StorageModule } from './storage/storage.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { AppLogger } from './common/logger/app.logger';
import { AppCacheModule } from './cache/cache.module';
import { EsopModule } from './esop/esop.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute per IP
          },
        ],
      }),
    }),
    ReputationModule,
    DatabaseModule,
    HealthModule,
    IndexerModule,
    NotificationModule,
    StorageModule,
    InsuranceModule,
    AppCacheModule,
    EsopModule,
    SecurityModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService, AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .forRoutes('*');
  }
}
