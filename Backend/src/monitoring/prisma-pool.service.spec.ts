import { PrismaPoolService } from './prisma-pool.service';

jest.mock('../../prisma/client', () => ({
  getPrismaPoolStats: jest.fn(),
  getPrismaPoolTuning: jest.fn(),
}));

const { getPrismaPoolStats, getPrismaPoolTuning } = jest.requireMock('../../prisma/client') as {
  getPrismaPoolStats: jest.Mock;
  getPrismaPoolTuning: jest.Mock;
};

describe('PrismaPoolService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pool metrics with derived connection values', async () => {
    getPrismaPoolTuning.mockReturnValue({
      expectedConcurrency: 500,
      max: 20,
      min: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      maxLifetimeSeconds: 300,
      maxUses: 7500,
      queryTimeoutMillis: 15000,
      statementTimeoutMillis: 10000,
      healthCheckIntervalMs: 30000,
      metricsIntervalMs: 5000,
      allowExitOnIdle: false,
    });
    getPrismaPoolStats.mockReturnValue({
      total: 12,
      active: 8,
      idle: 4,
      waiting: 2,
      expired: 0,
      max: 20,
      min: 5,
      utilization: 0.4,
      saturation: 0.5,
    });

    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any;

    const service = new PrismaPoolService(prisma);
    await service.checkHealth();
    const snapshot = await service.getSnapshot(false);

    expect(snapshot.connections.active).toBe(8);
    expect(snapshot.connections.idle).toBe(4);
    expect(snapshot.connections.waiting).toBe(2);
    expect(snapshot.cleanup.automaticStaleConnectionCleanup).toBe(true);
    expect(snapshot.health.healthy).toBe(true);
  });

  it('marks the pool unhealthy when the health query fails', async () => {
    getPrismaPoolTuning.mockReturnValue({
      expectedConcurrency: 500,
      max: 20,
      min: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      maxLifetimeSeconds: 300,
      maxUses: 7500,
      queryTimeoutMillis: 15000,
      statementTimeoutMillis: 10000,
      healthCheckIntervalMs: 30000,
      metricsIntervalMs: 5000,
      allowExitOnIdle: false,
    });
    getPrismaPoolStats.mockReturnValue({
      total: 0,
      active: 0,
      idle: 0,
      waiting: 3,
      expired: 0,
      max: 20,
      min: 5,
      utilization: 0,
      saturation: 0.15,
    });

    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection timeout')),
    } as any;

    const service = new PrismaPoolService(prisma);
    const health = await service.checkHealth();

    expect(health.healthy).toBe(false);
    expect(health.error).toContain('connection timeout');
  });
});