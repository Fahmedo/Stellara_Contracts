import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MonitoringController } from './monitoring.controller';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { PrismaPoolService } from './prisma-pool.service';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { StellarHealthIndicator } from './indicators/stellar-health.indicator';
import { RabbitMqHealthIndicator } from './indicators/rabbitmq-health.indicator';
import { RedisModule } from '../redis/redis.module';
import { RabbitmqModule } from '../messaging/rabbitmq/rabbitmq.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    RedisModule,
    RabbitmqModule,
    PrismaModule,
    // Prometheus metrics configuration
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  controllers: [MonitoringController],
  providers: [
    PrismaPoolService,
    PrismaHealthIndicator,
    RedisHealthIndicator,
    StellarHealthIndicator,
    RabbitMqHealthIndicator,
  ],
})
export class MonitoringModule { }
