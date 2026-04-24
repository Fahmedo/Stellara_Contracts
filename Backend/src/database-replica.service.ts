import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Provides read/write splitting via separate Prisma clients.
 * - `write` → primary (DATABASE_URL)
 * - `read`  → replica (DATABASE_REPLICA_URL), falls back to primary on failure
 */
@Injectable()
export class DatabaseReplicaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseReplicaService.name);

  private readonly primaryClient: PrismaClient;
  private replicaClient: PrismaClient | null = null;
  private replicaHealthy = false;

  constructor(private readonly config: ConfigService) {
    const logLevel = config.get('NODE_ENV') === 'development' ? (['query', 'error', 'warn'] as const) : (['error'] as const);

    this.primaryClient = new PrismaClient({
      datasources: { db: { url: config.getOrThrow<string>('DATABASE_URL') } },
      log: logLevel,
    });

    const replicaUrl = config.get<string>('DATABASE_REPLICA_URL');
    if (replicaUrl) {
      this.replicaClient = new PrismaClient({
        datasources: { db: { url: replicaUrl } },
        log: logLevel,
      });
    } else {
      this.logger.warn('DATABASE_REPLICA_URL not set — all reads will use primary');
    }
  }

  async onModuleInit() {
    await this.primaryClient.$connect();
    if (this.replicaClient) {
      await this.checkReplicaHealth();
    }
  }

  async onModuleDestroy() {
    await this.primaryClient.$disconnect();
    await this.replicaClient?.$disconnect();
  }

  /** Client for INSERT / UPDATE / DELETE operations */
  get write(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Client for SELECT operations.
   * Automatically falls back to primary when the replica is unhealthy.
   */
  get read(): PrismaClient {
    if (this.replicaClient && this.replicaHealthy) {
      return this.replicaClient;
    }
    return this.primaryClient;
  }

  /** Probe the replica and update `replicaHealthy`. */
  async checkReplicaHealth(): Promise<boolean> {
    if (!this.replicaClient) return false;
    try {
      await this.replicaClient.$queryRaw`SELECT 1`;
      if (!this.replicaHealthy) {
        this.logger.log('Replica is healthy — read traffic routed to replica');
      }
      this.replicaHealthy = true;
    } catch (err) {
      if (this.replicaHealthy) {
        this.logger.warn('Replica unhealthy — falling back to primary for reads', err);
      }
      this.replicaHealthy = false;
    }
    return this.replicaHealthy;
  }

  /** Returns current replication lag in seconds (requires pg_stat_replication on primary). */
  async getReplicationLag(): Promise<number | null> {
    try {
      const rows = await this.primaryClient.$queryRaw<{ lag_seconds: number }[]>`
        SELECT EXTRACT(EPOCH FROM write_lag)::float AS lag_seconds
        FROM pg_stat_replication
        LIMIT 1
      `;
      return rows[0]?.lag_seconds ?? null;
    } catch {
      return null;
    }
  }

  isReplicaHealthy(): boolean {
    return this.replicaHealthy;
  }
}
