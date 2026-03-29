import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import {
    PrismaPoolStats,
    PrismaPoolTuning,
    getPrismaPoolStats,
    getPrismaPoolTuning,
} from '../../prisma/client';
import {
    prismaPoolActiveGauge,
    prismaPoolErrorCounter,
    prismaPoolHealthGauge,
    prismaPoolHealthLatencyGauge,
    prismaPoolIdleGauge,
    prismaPoolTotalGauge,
    prismaPoolUtilizationGauge,
    prismaPoolWaitingGauge,
} from './prisma-pool.metrics';

interface PrismaPoolHealthSnapshot {
    healthy: boolean;
    checkedAt: string;
    latencyMs: number;
    error?: string;
}

interface PrismaPoolSnapshot {
    connections: PrismaPoolStats;
    tuning: PrismaPoolTuning;
    cleanup: {
        automaticStaleConnectionCleanup: true;
        idleTimeoutMillis: number;
        maxLifetimeSeconds: number;
        maxUses: number;
        allowExitOnIdle: boolean;
    };
    health: PrismaPoolHealthSnapshot;
    sampledAt: string;
}

@Injectable()
export class PrismaPoolService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaPoolService.name);
    private metricsTimer?: NodeJS.Timeout;
    private healthTimer?: NodeJS.Timeout;
    private latestHealth: PrismaPoolHealthSnapshot = {
        healthy: false,
        checkedAt: new Date(0).toISOString(),
        latencyMs: 0,
        error: 'Health check has not run yet',
    };

    constructor(private readonly prisma: PrismaService) { }

    async onModuleInit (): Promise<void> {
        this.refreshMetrics();
        await this.checkHealth();

        const tuning = getPrismaPoolTuning();
        this.metricsTimer = setInterval(() => {
            this.refreshMetrics();
        }, tuning.metricsIntervalMs);
        this.metricsTimer.unref();

        this.healthTimer = setInterval(() => {
            void this.checkHealth();
        }, tuning.healthCheckIntervalMs);
        this.healthTimer.unref();
    }

    onModuleDestroy (): void {
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
        }

        if (this.healthTimer) {
            clearInterval(this.healthTimer);
        }
    }

    refreshMetrics (): PrismaPoolSnapshot {
        const tuning = getPrismaPoolTuning();
        const connections = getPrismaPoolStats();

        prismaPoolActiveGauge.set(connections.active);
        prismaPoolIdleGauge.set(connections.idle);
        prismaPoolWaitingGauge.set(connections.waiting);
        prismaPoolTotalGauge.set(connections.total);
        prismaPoolUtilizationGauge.set(Number(connections.utilization.toFixed(4)));

        return {
            connections,
            tuning,
            cleanup: {
                automaticStaleConnectionCleanup: true,
                idleTimeoutMillis: tuning.idleTimeoutMillis,
                maxLifetimeSeconds: tuning.maxLifetimeSeconds,
                maxUses: tuning.maxUses,
                allowExitOnIdle: tuning.allowExitOnIdle,
            },
            health: this.latestHealth,
            sampledAt: new Date().toISOString(),
        };
    }

    async checkHealth (): Promise<PrismaPoolHealthSnapshot> {
        const startedAt = Date.now();

        try {
            await this.prisma.$queryRaw`SELECT 1`;
            const latencyMs = Date.now() - startedAt;

            this.latestHealth = {
                healthy: true,
                checkedAt: new Date().toISOString(),
                latencyMs,
            };

            prismaPoolHealthGauge.set(1);
            prismaPoolHealthLatencyGauge.set(latencyMs);
            return this.latestHealth;
        } catch (error) {
            const latencyMs = Date.now() - startedAt;
            const message = error instanceof Error ? error.message : 'Unknown Prisma pool health check error';

            this.latestHealth = {
                healthy: false,
                checkedAt: new Date().toISOString(),
                latencyMs,
                error: message,
            };

            prismaPoolHealthGauge.set(0);
            prismaPoolHealthLatencyGauge.set(latencyMs);
            prismaPoolErrorCounter.inc();
            this.logger.error(`Prisma pool health check failed: ${message}`);
            return this.latestHealth;
        }
    }

    async getSnapshot (forceHealthCheck = false): Promise<PrismaPoolSnapshot> {
        if (forceHealthCheck) {
            await this.checkHealth();
        }

        return this.refreshMetrics();
    }
}