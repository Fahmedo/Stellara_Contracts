import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaPoolService } from '../prisma-pool.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prismaPool: PrismaPoolService) {
    super();
  }

  async isHealthy (key: string): Promise<HealthIndicatorResult> {
    try {
      const snapshot = await this.prismaPool.getSnapshot(true);
      return this.getStatus(key, snapshot.health.healthy, {
        latencyMs: snapshot.health.latencyMs,
        connections: snapshot.connections,
        cleanup: snapshot.cleanup,
      });
    } catch (e) {
      const snapshot = await this.prismaPool.getSnapshot(false);
      const status = this.getStatus(key, false, {
        message: (e as Error).message,
        latencyMs: snapshot.health.latencyMs,
        connections: snapshot.connections,
        cleanup: snapshot.cleanup,
      });
      throw new HealthCheckError('Prisma check failed', status);
    }
  }
}
