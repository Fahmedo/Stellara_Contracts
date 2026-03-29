import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { StellarHealthIndicator } from './indicators/stellar-health.indicator';
import { RabbitMqHealthIndicator } from './indicators/rabbitmq-health.indicator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaPoolService } from './prisma-pool.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
    private stellarHealth: StellarHealthIndicator,
    private rabbitMqHealth: RabbitMqHealthIndicator,
    private memory: MemoryHealthIndicator,
    private http: HttpHealthIndicator,
    private prismaPool: PrismaPoolService,
  ) { }

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Check if the service is alive and core dependencies are up' })
  check () {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('health/detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check for all internal and external dependencies' })
  checkDetailed () {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.stellarHealth.isHealthy('stellar_blockchain'),
      () => this.rabbitMqHealth.isHealthy('messaging_queue'),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024), // 512MB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
      () => this.http.pingCheck('stellar_horizon_public', 'https://horizon.stellar.org'),
      () => this.http.pingCheck('stripe_api', 'https://api.stripe.com'),
      () => this.http.pingCheck('sendgrid_api', 'https://api.sendgrid.com/v3/stats', { timeout: 3000 }),
    ]);
  }

  @Get('database/pool')
  @ApiOperation({ summary: 'Inspect Prisma connection pool utilization and tuning settings' })
  getDatabasePool (@Query('refresh') refresh?: string) {
    return this.prismaPool.getSnapshot(refresh === 'true');
  }
}
