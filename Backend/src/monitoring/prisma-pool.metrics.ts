type GaugeLike = {
    set: (...args: unknown[]) => void;
};

type CounterLike = {
    inc: (...args: unknown[]) => void;
};

type PromClientModule = {
    Gauge: new (config: { name: string; help: string }) => GaugeLike;
    Counter: new (config: { name: string; help: string }) => CounterLike;
    register: {
        getSingleMetric: (name: string) => GaugeLike | CounterLike | undefined;
        registerMetric: (metric: GaugeLike | CounterLike) => void;
    };
};

const noopGauge: GaugeLike = {
    set: () => undefined,
};

const noopCounter: CounterLike = {
    inc: () => undefined,
};

function getPromClient (): PromClientModule | undefined {
    try {
        return require('prom-client') as PromClientModule;
    } catch {
        return undefined;
    }
}

function getOrCreateGauge (name: string, help: string): GaugeLike {
    const promClient = getPromClient();
    if (!promClient) {
        return noopGauge;
    }

    const existing = promClient.register.getSingleMetric(name);
    if (existing) {
        return existing as GaugeLike;
    }

    const metric = new promClient.Gauge({ name, help });
    promClient.register.registerMetric(metric);
    return metric;
}

function getOrCreateCounter (name: string, help: string): CounterLike {
    const promClient = getPromClient();
    if (!promClient) {
        return noopCounter;
    }

    const existing = promClient.register.getSingleMetric(name);
    if (existing) {
        return existing as CounterLike;
    }

    const metric = new promClient.Counter({ name, help });
    promClient.register.registerMetric(metric);
    return metric;
}

export const prismaPoolActiveGauge = getOrCreateGauge(
    'stellara_prisma_pool_active_connections',
    'Number of active Prisma PostgreSQL pool connections',
);

export const prismaPoolIdleGauge = getOrCreateGauge(
    'stellara_prisma_pool_idle_connections',
    'Number of idle Prisma PostgreSQL pool connections',
);

export const prismaPoolWaitingGauge = getOrCreateGauge(
    'stellara_prisma_pool_waiting_clients',
    'Number of queued Prisma PostgreSQL pool clients waiting for a connection',
);

export const prismaPoolTotalGauge = getOrCreateGauge(
    'stellara_prisma_pool_total_connections',
    'Total number of Prisma PostgreSQL pool connections',
);

export const prismaPoolUtilizationGauge = getOrCreateGauge(
    'stellara_prisma_pool_utilization_ratio',
    'Ratio of active Prisma PostgreSQL connections to configured max pool size',
);

export const prismaPoolHealthLatencyGauge = getOrCreateGauge(
    'stellara_prisma_pool_healthcheck_latency_ms',
    'Latency of the most recent Prisma PostgreSQL pool health check in milliseconds',
);

export const prismaPoolHealthGauge = getOrCreateGauge(
    'stellara_prisma_pool_health_status',
    'Prisma PostgreSQL pool health status (1=healthy, 0=unhealthy)',
);

export const prismaPoolErrorCounter = getOrCreateCounter(
    'stellara_prisma_pool_connection_errors_total',
    'Total Prisma PostgreSQL pool connectivity or health check errors',
);