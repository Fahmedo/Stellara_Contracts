import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

export interface PrismaPoolTuning {
    expectedConcurrency: number;
    max: number;
    min: number;
    connectionTimeoutMillis: number;
    idleTimeoutMillis: number;
    maxLifetimeSeconds: number;
    maxUses: number;
    queryTimeoutMillis: number;
    statementTimeoutMillis: number;
    healthCheckIntervalMs: number;
    metricsIntervalMs: number;
    allowExitOnIdle: boolean;
}

export interface PrismaPoolStats {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    expired: number;
    max: number;
    min: number;
    utilization: number;
    saturation: number;
}

let prismaPool: Pool | undefined;

function clamp (value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function parseIntegerEnv (name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanEnv (name: string, fallback: boolean): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) {
        return fallback;
    }

    if (['1', 'true', 'yes', 'on'].includes(raw)) {
        return true;
    }

    if (['0', 'false', 'no', 'off'].includes(raw)) {
        return false;
    }

    return fallback;
}

function getDefaultPoolMax (expectedConcurrency: number): number {
    const cpuBasedTarget = Math.max(10, require('node:os').cpus().length * 2);
    const concurrencyBasedTarget = Math.max(10, Math.ceil(expectedConcurrency / 25));
    return clamp(Math.max(cpuBasedTarget, concurrencyBasedTarget), 10, 50);
}

export function getPrismaPoolTuning (): PrismaPoolTuning {
    const expectedConcurrency = parseIntegerEnv('PRISMA_POOL_EXPECTED_CONCURRENCY', 500);
    const max = parseIntegerEnv('PRISMA_POOL_MAX', getDefaultPoolMax(expectedConcurrency));
    const min = clamp(parseIntegerEnv('PRISMA_POOL_MIN', Math.max(2, Math.floor(max / 4))), 0, max);

    return {
        expectedConcurrency,
        max,
        min,
        connectionTimeoutMillis: parseIntegerEnv('PRISMA_POOL_CONNECTION_TIMEOUT_MS', 5_000),
        idleTimeoutMillis: parseIntegerEnv('PRISMA_POOL_IDLE_TIMEOUT_MS', 30_000),
        maxLifetimeSeconds: parseIntegerEnv('PRISMA_POOL_MAX_LIFETIME_SECONDS', 300),
        maxUses: parseIntegerEnv('PRISMA_POOL_MAX_USES', 7_500),
        queryTimeoutMillis: parseIntegerEnv('PRISMA_POOL_QUERY_TIMEOUT_MS', 15_000),
        statementTimeoutMillis: parseIntegerEnv('PRISMA_POOL_STATEMENT_TIMEOUT_MS', 10_000),
        healthCheckIntervalMs: parseIntegerEnv('PRISMA_POOL_HEALTHCHECK_INTERVAL_MS', 30_000),
        metricsIntervalMs: parseIntegerEnv('PRISMA_POOL_METRICS_INTERVAL_MS', 5_000),
        allowExitOnIdle: parseBooleanEnv('PRISMA_POOL_ALLOW_EXIT_ON_IDLE', false),
    };
}

function getDatabaseUrl (): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set');
    }
    return databaseUrl;
}

export function getPrismaPoolConfig (): PoolConfig {
    const tuning = getPrismaPoolTuning();

    return {
        connectionString: getDatabaseUrl(),
        application_name: process.env.SERVICE_NAME ?? 'stellara-backend',
        max: tuning.max,
        min: tuning.min,
        connectionTimeoutMillis: tuning.connectionTimeoutMillis,
        idleTimeoutMillis: tuning.idleTimeoutMillis,
        maxLifetimeSeconds: tuning.maxLifetimeSeconds,
        maxUses: tuning.maxUses,
        allowExitOnIdle: tuning.allowExitOnIdle,
        query_timeout: tuning.queryTimeoutMillis,
        statement_timeout: tuning.statementTimeoutMillis,
        keepAlive: true,
    };
}

export function getPrismaPool (): Pool {
    if (!prismaPool) {
        prismaPool = new Pool(getPrismaPoolConfig());
        prismaPool.on('error', (error) => {
            console.error('[prisma-pool] unexpected pool error', error);
        });
    }

    return prismaPool;
}

export function getPrismaPoolStats (): PrismaPoolStats {
    const pool = getPrismaPool();
    const tuning = getPrismaPoolTuning();
    const total = pool.totalCount;
    const idle = pool.idleCount;
    const active = Math.max(0, total - idle);
    const waiting = pool.waitingCount;
    const expired = pool.expiredCount;
    const max = tuning.max;
    const utilization = max > 0 ? active / max : 0;
    const saturation = max > 0 ? (active + waiting) / max : 0;

    return {
        total,
        active,
        idle,
        waiting,
        expired,
        max,
        min: tuning.min,
        utilization,
        saturation,
    };
}

export function getPrismaClientOptions () {
    return {
        adapter: new PrismaPg(getPrismaPool()),
    };
}

export function createPrismaClient () {
    return new PrismaClient(getPrismaClientOptions());
}
