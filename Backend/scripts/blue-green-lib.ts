type SlotName = 'blue' | 'green';

interface DeploymentDescriptor {
  environment: string;
  activeSlot: SlotName;
  candidateSlot: SlotName;
  releaseVersion: string;
  commitSha: string;
  buildId: string;
}

interface RuntimeConfig extends DeploymentDescriptor {
  publicBaseUrl: string;
  candidateBaseUrl: string;
  activeBaseUrl: string;
  healthPath: string;
  smokePaths: string[];
  trafficSteps: number[];
  lbSwitchUrl: string;
  lbStatusUrl?: string;
  apiToken?: string;
  stepTimeoutMs: number;
  stepIntervalMs: number;
  healthTimeoutMs: number;
  rollbackOnFailure: boolean;
  runDbRollback: boolean;
}

interface SlotHealthResponse {
  ready?: boolean;
  status?: string;
  deployment?: {
    slot?: string;
    environment?: string;
    releaseVersion?: string;
    commitSha?: string;
    buildId?: string;
  };
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return raw.toLowerCase() === 'true';
}

function parseSlot(name: string, fallback?: SlotName): SlotName {
  const value = process.env[name]?.toLowerCase();
  if (!value && fallback) {
    return fallback;
  }

  if (value === 'blue' || value === 'green') {
    return value;
  }

  throw new Error(`Environment variable ${name} must be either "blue" or "green"`);
}

function parseTrafficSteps(raw: string | undefined): number[] {
  const values = (raw ?? '10,50,100')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));

  if (values.length === 0) {
    throw new Error('BLUE_GREEN_TRAFFIC_STEPS must contain at least one numeric step');
  }

  return values.map((value) => {
    if (value < 0 || value > 100) {
      throw new Error('BLUE_GREEN_TRAFFIC_STEPS entries must be between 0 and 100');
    }

    return value;
  });
}

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}`).toString();
}

async function http<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T | string }> {
  const response = await fetch(url, init);
  const text = await response.text();

  let body: T | string = text;
  try {
    body = JSON.parse(text) as T;
  } catch {}

  return {
    status: response.status,
    body,
  };
}

export function loadRuntimeConfig(): RuntimeConfig {
  const environment = process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? 'staging';
  const activeSlot = parseSlot('BLUE_GREEN_ACTIVE_SLOT');
  const candidateSlot = parseSlot(
    'BLUE_GREEN_CANDIDATE_SLOT',
    activeSlot === 'blue' ? 'green' : 'blue',
  );

  const publicBaseUrl = readRequired('BLUE_GREEN_PUBLIC_BASE_URL');
  const blueBaseUrl = readRequired('BLUE_GREEN_BLUE_BASE_URL');
  const greenBaseUrl = readRequired('BLUE_GREEN_GREEN_BASE_URL');

  return {
    environment,
    activeSlot,
    candidateSlot,
    releaseVersion: process.env.RELEASE_VERSION ?? process.env.GITHUB_SHA ?? 'local',
    commitSha: process.env.RELEASE_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    buildId: process.env.RELEASE_BUILD_ID ?? process.env.GITHUB_RUN_ID ?? 'manual',
    publicBaseUrl,
    candidateBaseUrl: candidateSlot === 'blue' ? blueBaseUrl : greenBaseUrl,
    activeBaseUrl: activeSlot === 'blue' ? blueBaseUrl : greenBaseUrl,
    healthPath: process.env.BLUE_GREEN_HEALTH_PATH ?? '/health/ready',
    smokePaths: (process.env.BLUE_GREEN_SMOKE_PATHS ?? '/health,/health/ready')
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean),
    trafficSteps: parseTrafficSteps(process.env.BLUE_GREEN_TRAFFIC_STEPS),
    lbSwitchUrl: readRequired('BLUE_GREEN_LB_SWITCH_URL'),
    lbStatusUrl: process.env.BLUE_GREEN_LB_STATUS_URL,
    apiToken: process.env.BLUE_GREEN_LB_API_TOKEN,
    stepTimeoutMs: readNumber('BLUE_GREEN_STEP_TIMEOUT_MS', 120000),
    stepIntervalMs: readNumber('BLUE_GREEN_STEP_INTERVAL_MS', 15000),
    healthTimeoutMs: readNumber('BLUE_GREEN_HEALTH_TIMEOUT_MS', 120000),
    rollbackOnFailure: readBoolean('BLUE_GREEN_ROLLBACK_ON_FAILURE', true),
    runDbRollback: readBoolean('BLUE_GREEN_RUN_DB_ROLLBACK', false),
  };
}

export async function waitForHealthySlot(config: RuntimeConfig): Promise<void> {
  const url = buildUrl(config.candidateBaseUrl, config.healthPath);
  const deadline = Date.now() + config.healthTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const { status, body } = await http<SlotHealthResponse>(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (status >= 200 && status < 300 && typeof body !== 'string' && body.ready) {
        const deployment = body.deployment ?? {};
        if (
          deployment.slot &&
          deployment.slot !== config.candidateSlot
        ) {
          throw new Error(
            `Candidate health endpoint reported slot ${deployment.slot}, expected ${config.candidateSlot}`,
          );
        }

        console.log(
          `Candidate slot ${config.candidateSlot} is healthy for release ${deployment.releaseVersion ?? config.releaseVersion}`,
        );
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'health check failed';
      console.log(`Waiting for candidate slot ${config.candidateSlot}: ${message}`);
    }

    await sleep(5000);
  }

  throw new Error(`Candidate slot ${config.candidateSlot} did not become ready within timeout`);
}

export async function runSmokeChecks(config: RuntimeConfig, baseUrl = config.publicBaseUrl): Promise<void> {
  for (const path of config.smokePaths) {
    const { status } = await http(buildUrl(baseUrl, path), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (status < 200 || status >= 300) {
      throw new Error(`Smoke check failed for ${path} with status ${status}`);
    }
  }
}

export async function switchTraffic(config: RuntimeConfig, percent: number): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  const payload = {
    environment: config.environment,
    activeSlot: config.activeSlot,
    candidateSlot: config.candidateSlot,
    targetSlot: config.candidateSlot,
    candidateWeightPct: percent,
    releaseVersion: config.releaseVersion,
    commitSha: config.commitSha,
    buildId: config.buildId,
  };

  const { status, body } = await http(config.lbSwitchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (status < 200 || status >= 300) {
    throw new Error(
      `Traffic switch failed with status ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`,
    );
  }
}

export async function rollbackTraffic(config: RuntimeConfig, reason: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  const payload = {
    environment: config.environment,
    activeSlot: config.activeSlot,
    candidateSlot: config.candidateSlot,
    targetSlot: config.activeSlot,
    candidateWeightPct: 0,
    reason,
    releaseVersion: config.releaseVersion,
    commitSha: config.commitSha,
    buildId: config.buildId,
  };

  const { status, body } = await http(config.lbSwitchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (status < 200 || status >= 300) {
    throw new Error(
      `Rollback traffic switch failed with status ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`,
    );
  }
}

export async function verifyLoadBalancer(config: RuntimeConfig): Promise<void> {
  if (!config.lbStatusUrl) {
    return;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  const { status } = await http(config.lbStatusUrl, { headers });
  if (status < 200 || status >= 300) {
    throw new Error(`Load balancer status check failed with status ${status}`);
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
