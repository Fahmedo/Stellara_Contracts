# Blue-Green Deployment Runbook

## Objective

Release backend changes with zero downtime by deploying into the inactive slot, validating health, shifting traffic in stages, and rolling back instantly by repointing the load balancer to the previous slot.

## Architecture

- Two production-identical backend slots exist at all times: `blue` and `green`.
- Shared dependencies remain stable across both slots: PostgreSQL, Redis, RabbitMQ, secrets, and external services.
- Runtime behavior is environment-agnostic. Slot identity, release metadata, and control-plane endpoints are injected through environment variables.
- The load balancer owns live traffic. Application instances only expose readiness and deployment metadata.
- New behavior ships dark behind feature flags first, then traffic moves gradually through the load balancer.

## Required Environment Variables

- `DEPLOYMENT_ENVIRONMENT`, `DEPLOYMENT_SLOT`, `RELEASE_VERSION`, `RELEASE_COMMIT_SHA`, `RELEASE_BUILD_ID`
- `BLUE_GREEN_ACTIVE_SLOT`, `BLUE_GREEN_CANDIDATE_SLOT`
- `BLUE_GREEN_PUBLIC_BASE_URL`, `BLUE_GREEN_BLUE_BASE_URL`, `BLUE_GREEN_GREEN_BASE_URL`
- `BLUE_GREEN_LB_SWITCH_URL`
- Optional: `BLUE_GREEN_LB_STATUS_URL`, `BLUE_GREEN_LB_API_TOKEN`, `BLUE_GREEN_RUN_DB_ROLLBACK`

## Release Flow

1. Build and deploy the new release into the inactive slot only.
2. Confirm the candidate slot reports `ready: true` from `/health/ready`.
3. Run `npm run db:pre-deploy` and `npm run db:migrate:deploy`.
4. Validate candidate health again after the migration.
5. Keep new code paths gated behind feature flags where the change is not fully reversible at the schema level.
6. Shift load balancer traffic progressively using `BLUE_GREEN_TRAFFIC_STEPS`, defaulting to `10,50,100`.
7. Run smoke checks after each traffic shift.
8. If any health gate fails, move traffic back to the previous slot immediately and optionally execute `npm run db:rollback -- --steps 1`.

## Backward-Compatible Migration Rules

- Expand first, contract later. Add nullable columns or defaults before any application switch.
- Never rename or drop a column in the same release that introduces the replacement.
- Keep both old and new read/write paths alive until the old slot is fully drained.
- Use concurrent index creation for large tables.
- Treat destructive schema changes as a separate release after the new slot has been stable in production.

## Feature Flag Rollout

- Release risky features disabled by default.
- Validate the new slot with flags off first.
- After traffic reaches 100% on the candidate slot, enable flags gradually using the existing config manager endpoints.
- Use percentage rollout on the `featureFlag` records for tenant or user cohorts before global enablement.

## Health Check Gates

- `/health/live` proves the process is alive.
- `/health/ready` proves startup completed, dependencies are reachable, and the instance is not draining.
- `/health/deployment` exposes slot, release version, commit SHA, build ID, and traffic state for control-plane verification.

## Rollback Procedure

1. Stop traffic progression.
2. Run `npm run deploy:rollback` with the previous live slot configured as `BLUE_GREEN_ACTIVE_SLOT`.
3. Confirm the load balancer returns traffic to the stable slot.
4. If the failure was caused by the latest migration and `BLUE_GREEN_RUN_DB_ROLLBACK=true` is approved for the release, execute a single-step rollback.
5. Leave the failed slot out of rotation until root cause is fixed and a fresh deployment is ready.

## GitHub Actions Integration

The workflow at `.github/workflows/backend-blue-green.yml` performs:

- candidate slot deployment through a provider-specific deploy hook
- migration checks and deployment
- progressive traffic switching through a load balancer hook
- automatic rollback on health or smoke-test failure

## Manual Commands

```bash
npm run deploy:blue-green
npm run deploy:rollback
```
