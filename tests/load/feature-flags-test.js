// Feature Flags Load Test
// Tests the feature flags endpoints under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let featureFlagErrorRate = new Rate('feature_flag_errors');
export let evaluationSuccessRate = new Rate('evaluation_success');
export let experimentSuccessRate = new Rate('experiment_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 300 },   // Warm up
    { duration: '5m', target: 1000 },  // Load test
    { duration: '2m', target: 2000 },  // Peak load
    { duration: '5m', target: 2000 },  // Sustained peak
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'],
    feature_flag_errors: ['rate<0.005'],
    evaluation_success: ['rate>0.99'],
    experiment_success: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Test data
const testFlags = [
  'new-trading-ui',
  'advanced-analytics',
  'social-trading',
  'mobile-app-v2',
  'api-v2-endpoints',
];

const testExperiments = [
  'trading-interface-redesign',
  'onboarding-flow-optimization',
  'notification-system-upgrade',
];

// Setup function to authenticate users
export function setup() {
  console.log('Setting up feature flags load test...');
  
  // Authenticate test users
  const credentials = {
    email: __ENV.TEST_USER_EMAIL || 'featureuser@example.com',
    password: __ENV.TEST_USER_PASSWORD || 'TestPassword123!',
  };
  
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify(credentials), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginResponse.status !== 200) {
    throw new Error('Failed to authenticate test user');
  }
  
  const loginData = JSON.parse(loginResponse.body);
  console.log('Setup complete. Test user authenticated.');
  
  return {
    token: loginData.access_token,
    userId: loginData.user.id,
  };
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Test 1: Get all feature flags
  const flagsResponse = http.get(`${BASE_URL}/feature-flags`, {
    headers: authHeaders,
  });
  
  const flagsSuccess = check(flagsResponse, {
    'get flags status is 200': (r) => r.status === 200,
    'get flags response time < 100ms': (r) => r.timings.duration < 100,
    'flags returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });
  
  evaluationSuccessRate.add(flagsSuccess);
  featureFlagErrorRate.add(!flagsSuccess);

  // Test 2: Evaluate individual feature flags
  for (const flagKey of testFlags) {
    const evaluatePayload = JSON.stringify({
      key: flagKey,
      userId: data.userId,
      context: {
        role: 'user',
        tier: 'premium',
        region: 'US',
        betaUser: true,
      },
      userAgent: 'k6-load-test',
      ipAddress: '192.168.1.1',
      requestId: `req-${Date.now()}-${Math.random()}`,
    });

    const evaluateResponse = http.post(`${BASE_URL}/feature-flags/evaluate`, evaluatePayload, {
      headers: authHeaders,
    });
    
    const evaluateSuccess = check(evaluateResponse, {
      [`evaluate ${flagKey} status is 200`]: (r) => r.status === 200,
      [`evaluate ${flagKey} response time < 50ms`]: (r) => r.timings.duration < 50,
      [`evaluate ${flagKey} has enabled field`]: (r) => JSON.parse(r.body).enabled !== undefined,
      [`evaluate ${flagKey} has reason`]: (r) => JSON.parse(r.body).reason !== undefined,
    });
    
    evaluationSuccessRate.add(evaluateSuccess);
    featureFlagErrorRate.add(!evaluateSuccess);
  }

  // Test 3: Batch evaluate multiple flags
  const batchPayload = JSON.stringify({
    userId: data.userId,
    flagKeys: testFlags,
    context: {
      role: 'user',
      tier: 'premium',
      region: 'US',
      betaUser: true,
    },
    userAgent: 'k6-load-test',
    ipAddress: '192.168.1.1',
    requestId: `batch-${Date.now()}-${Math.random()}`,
  });

  const batchResponse = http.post(`${BASE_URL}/feature-flags/evaluate-batch`, batchPayload, {
    headers: authHeaders,
  });
  
  check(batchResponse, {
    'batch evaluate status is 200': (r) => r.status === 200,
    'batch evaluate response time < 100ms': (r) => r.timings.duration < 100,
    'batch evaluate returns array': (r) => Array.isArray(JSON.parse(r.body)),
    'batch evaluate has all flags': (r) => JSON.parse(r.body).length === testFlags.length,
  });

  // Test 4: Get feature flag analytics
  const analyticsResponse = http.get(`${BASE_URL}/feature-flags/${testFlags[0]}/analytics`, {
    headers: authHeaders,
  });
  
  check(analyticsResponse, {
    'get analytics status is 200': (r) => r.status === 200,
    'get analytics response time < 200ms': (r) => r.timings.duration < 200,
    'analytics has total evaluations': (r) => JSON.parse(r.body).totalEvaluations !== undefined,
    'analytics has enablement rate': (r) => JSON.parse(r.body).enablementRate !== undefined,
  });

  // Test 5: Get SDK flags
  const sdkFlagsResponse = http.get(`${BASE_URL}/feature-flags/sdk/flags?environment=production`, {
    headers: authHeaders,
  });
  
  check(sdkFlagsResponse, {
    'get SDK flags status is 200': (r) => r.status === 200,
    'get SDK flags response time < 150ms': (r) => r.timings.duration < 150,
    'SDK flags returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 6: SDK evaluate endpoint
  const sdkEvaluatePayload = JSON.stringify({
    key: testFlags[0],
    userId: data.userId,
    context: {
      role: 'user',
      tier: 'premium',
    },
    userAgent: 'k6-sdk-test',
  });

  const sdkEvaluateResponse = http.post(`${BASE_URL}/feature-flags/sdk/evaluate`, sdkEvaluatePayload, {
    headers: authHeaders,
  });
  
  check(sdkEvaluateResponse, {
    'SDK evaluate status is 200': (r) => r.status === 200,
    'SDK evaluate response time < 50ms': (r) => r.timings.duration < 50,
    'SDK evaluate has enabled field': (r) => JSON.parse(r.body).enabled !== undefined,
  });

  // Test 7: Get all experiments
  const experimentsResponse = http.get(`${BASE_URL}/experiments`, {
    headers: authHeaders,
  });
  
  const experimentsSuccess = check(experimentsResponse, {
    'get experiments status is 200': (r) => r.status === 200,
    'get experiments response time < 150ms': (r) => r.timings.duration < 150,
    'experiments returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });
  
  experimentSuccessRate.add(experimentsSuccess);

  // Test 8: Evaluate experiments
  for (const experimentKey of testExperiments) {
    const experimentPayload = JSON.stringify({
      key: experimentKey,
      userId: data.userId,
      context: {
        role: 'user',
        tier: 'premium',
        region: 'US',
      },
      userAgent: 'k6-load-test',
      ipAddress: '192.168.1.1',
      requestId: `exp-${Date.now()}-${Math.random()}`,
    });

    const experimentResponse = http.post(`${BASE_URL}/experiments/evaluate`, experimentPayload, {
      headers: authHeaders,
    });
    
    const experimentSuccess = check(experimentResponse, {
      [`evaluate ${experimentKey} status is 200`]: (r) => r.status === 200,
      [`evaluate ${experimentKey} response time < 100ms`]: (r) => r.timings.duration < 100,
      [`evaluate ${experimentKey} has variant`]: (r) => JSON.parse(r.body).variant !== undefined,
      [`evaluate ${experimentKey} has isInExperiment`]: (r) => JSON.parse(r.body).isInExperiment !== undefined,
    });
    
    experimentSuccessRate.add(experimentSuccess);
  }

  // Test 9: Get SDK experiments
  const sdkExperimentsResponse = http.get(`${BASE_URL}/experiments/sdk/experiments?environment=production`, {
    headers: authHeaders,
  });
  
  check(sdkExperimentsResponse, {
    'get SDK experiments status is 200': (r) => r.status === 200,
    'get SDK experiments response time < 200ms': (r) => r.timings.duration < 200,
    'SDK experiments returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 10: Track conversion (simulated)
  if (Math.random() < 0.3) { // 30% chance to track conversion
    const conversionPayload = JSON.stringify({
      experimentKey: testExperiments[0],
      userId: data.userId,
      variantKey: 'variant_a',
      eventType: 'purchase_completed',
      value: 100,
      metadata: {
        product: 'premium_subscription',
        currency: 'USD',
      },
    });

    const conversionResponse = http.post(`${BASE_URL}/experiments/track-conversion`, conversionPayload, {
      headers: authHeaders,
    });
    
    check(conversionResponse, {
      'track conversion status is 200': (r) => r.status === 200,
      'track conversion response time < 100ms': (r) => r.timings.duration < 100,
    });
  }

  // Test 11: Get experiment results
  const resultsResponse = http.get(`${BASE_URL}/experiments/results`, {
    headers: authHeaders,
  });
  
  check(resultsResponse, {
    'get experiment results status is 200': (r) => r.status === 200,
    'get experiment results response time < 300ms': (r) => r.timings.duration < 300,
    'experiment results has data': (r) => JSON.parse(r.body).experiment !== undefined,
  });

  // Test 12: Get dashboard summary
  const dashboardResponse = http.get(`${BASE_URL}/feature-flags/dashboard/summary`, {
    headers: authHeaders,
  });
  
  check(dashboardResponse, {
    'get dashboard status is 200': (r) => r.status === 200,
    'get dashboard response time < 200ms': (r) => r.timings.duration < 200,
    'dashboard has total flags': (r) => JSON.parse(r.body).totalFlags !== undefined,
    'dashboard has enabled flags': (r) => JSON.parse(r.body).enabledFlags !== undefined,
  });

  sleep(0.1); // Very brief pause for high-frequency testing
}

export function teardown(data) {
  console.log('Feature flags load test completed.');
}

export function handleSummary(data) {
  return {
    'feature-flags-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
