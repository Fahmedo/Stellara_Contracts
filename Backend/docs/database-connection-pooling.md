# Database Connection Pooling

This backend now runs Prisma through a shared `pg.Pool` so connection limits, queueing, timeouts, and stale connection recycling are controlled in one place.

## What changed

- Prisma now uses a singleton `pg.Pool` via `@prisma/adapter-pg`
- Pool sizing is derived from expected concurrency with explicit environment overrides
- Connection acquisition timeout, query timeout, and statement timeout are configurable
- Idle and long-lived connections are recycled automatically with `idleTimeoutMillis`, `maxLifetimeSeconds`, and `maxUses`
- Pool metrics are exposed at `/api/v1/monitoring/database/pool`
- Prometheus now exports pool gauges for active, idle, waiting, total, utilization, and health-check latency
- Database health checks now include pool utilization details

## Tuning parameters

| Variable                              | Default   | Purpose                                                                       |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `PRISMA_POOL_EXPECTED_CONCURRENCY`    | `500`     | Expected peak request concurrency used to derive a sensible default pool size |
| `PRISMA_POOL_MAX`                     | derived   | Maximum number of PostgreSQL connections Prisma may hold                      |
| `PRISMA_POOL_MIN`                     | `max / 4` | Minimum warm connections kept available                                       |
| `PRISMA_POOL_CONNECTION_TIMEOUT_MS`   | `5000`    | Max time a request waits to acquire a connection before failing               |
| `PRISMA_POOL_IDLE_TIMEOUT_MS`         | `30000`   | Idle connection lifetime before the pool closes it                            |
| `PRISMA_POOL_MAX_LIFETIME_SECONDS`    | `300`     | Hard cap on connection age to rotate stale sockets                            |
| `PRISMA_POOL_MAX_USES`                | `7500`    | Recycles frequently-used connections before they become unhealthy             |
| `PRISMA_POOL_QUERY_TIMEOUT_MS`        | `15000`   | Client-side timeout for query execution                                       |
| `PRISMA_POOL_STATEMENT_TIMEOUT_MS`    | `10000`   | PostgreSQL server-side statement timeout                                      |
| `PRISMA_POOL_HEALTHCHECK_INTERVAL_MS` | `30000`   | Frequency of active `SELECT 1` health checks                                  |
| `PRISMA_POOL_METRICS_INTERVAL_MS`     | `5000`    | Frequency of pool metric sampling                                             |
| `PRISMA_POOL_ALLOW_EXIT_ON_IDLE`      | `false`   | Allows Node to exit when only idle pool connections remain                    |

## Pool sizing guidance

- Start with `PRISMA_POOL_MAX` near `expected_concurrency / 25` for light read workloads.
- Increase the pool only when `waiting` is consistently non-zero and PostgreSQL still has CPU headroom.
- Decrease the pool when the database saturates before the app does, or when multiple backend replicas are deployed.
- Across replicas, keep total connections under the PostgreSQL server limit with headroom for migrations, admin access, and background jobs.

## Metrics and health

- JSON snapshot: `/api/v1/monitoring/database/pool`
- Force a fresh health probe: `/api/v1/monitoring/database/pool?refresh=true`
- Health endpoint: `/api/v1/monitoring/health`
- Prometheus metrics path: `/metrics`

The JSON pool snapshot includes:

- `connections.active`
- `connections.idle`
- `connections.waiting`
- `connections.total`
- `connections.utilization`
- `cleanup` settings used for stale connection recycling
- `health.latencyMs` and the last health-check result

## Load testing

Use the dedicated pool stress profile:

```bash
npm run perf:test:db-pool
```

That profile targets the database-backed monitoring health endpoint with `550` virtual users for `2` minutes. Override values with environment variables when testing other environments:

```bash
TARGET_URL=http://localhost:3000 API_PREFIX=api/v1 TARGET_PATH=monitoring/health VUS=550 DURATION=2m npm run perf:test
```

## Interpreting results

- Healthy pool: `waiting=0` most of the time and `utilization < 0.8` during normal peaks
- Near exhaustion: sustained `waiting > 0`, rising health-check latency, and request latency growth
- Oversized pool: database CPU saturation without reduced wait time, or too many idle connections across replicas
