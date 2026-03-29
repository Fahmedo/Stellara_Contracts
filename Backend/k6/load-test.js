import { check } from 'k6';
import http from 'k6/http';

const BASELINE = JSON.parse(open('./baseline.json'));
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const API_PREFIX = (__ENV.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');
const TARGET_PATH = (__ENV.TARGET_PATH || 'monitoring/health').replace(/^\/+/, '');
const EXPECT_STATUS = Number(__ENV.EXPECT_STATUS || 200);
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '1m';
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || Math.round(BASELINE.p95 * 1.1));
const MIN_RPS = Number(__ENV.MIN_RPS || Math.round(BASELINE.rps * 0.9));

if (!TARGET_URL) {
  throw new Error('TARGET_URL environment variable is required to run the performance test');
}

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
    http_reqs: [`rate>${MIN_RPS}`],
  },
};

export default function () {
  const response = http.get(`${TARGET_URL}/${API_PREFIX}/${TARGET_PATH}`);
  check(response, {
    'target endpoint returns expected status': (r) => r.status === EXPECT_STATUS,
  });
}
