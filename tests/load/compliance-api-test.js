// Compliance API Load Test
// Tests the compliance endpoints under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let complianceErrorRate = new Rate('compliance_errors');
export let kycSuccessRate = new Rate('kyc_success');
export let sanctionsSuccessRate = new Rate('sanctions_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Warm up
    { duration: '5m', target: 200 },   // Load test
    { duration: '2m', target: 400 },   // Peak load
    { duration: '5m', target: 400 },   // Sustained peak
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    compliance_errors: ['rate<0.02'],
    kyc_success: ['rate>0.90'],
    sanctions_success: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Setup function to authenticate users
export function setup() {
  console.log('Setting up compliance load test...');
  
  // Authenticate test users
  const credentials = {
    email: __ENV.TEST_USER_EMAIL || 'compliance@example.com',
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

  // Test 1: Submit KYC verification
  const kycPayload = JSON.stringify({
    userId: data.userId,
    provider: 'onfido',
    verificationType: 'identity',
    documents: ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
    personalInfo: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      dateOfBirth: '1990-01-01',
      address: '123 Test St',
      city: 'Test City',
      country: 'US',
      postalCode: '12345',
    },
  });

  const kycResponse = http.post(`${BASE_URL}/compliance/kyc/verify`, kycPayload, {
    headers: authHeaders,
  });
  
  const kycSuccess = check(kycResponse, {
    'submit KYC status is 201': (r) => r.status === 201,
    'submit KYC response time < 500ms': (r) => r.timings.duration < 500,
    'KYC has verification ID': (r) => JSON.parse(r.body).id !== undefined,
    'KYC status is pending': (r) => JSON.parse(r.body).status === 'pending',
  });
  
  kycSuccessRate.add(kycSuccess);
  complianceErrorRate.add(!kycSuccess);

  sleep(1);

  // Test 2: Get KYC verification status
  const kycStatusResponse = http.get(`${BASE_URL}/compliance/kyc/user/${data.userId}`, {
    headers: authHeaders,
  });
  
  check(kycStatusResponse, {
    'get KYC status status is 200': (r) => r.status === 200,
    'get KYC status response time < 200ms': (r) => r.timings.duration < 200,
    'KYC status returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 3: Get trading limits
  const tradingLimitsResponse = http.get(`${BASE_URL}/compliance/kyc/${data.userId}/trading-limits`, {
    headers: authHeaders,
  });
  
  check(tradingLimitsResponse, {
    'get trading limits status is 200': (r) => r.status === 200,
    'get trading limits response time < 150ms': (r) => r.timings.duration < 150,
    'trading limits have daily limit': (r) => JSON.parse(r.body).dailyLimit !== undefined,
    'trading limits have monthly limit': (r) => JSON.parse(r.body).monthlyLimit !== undefined,
  });

  // Test 4: Create sanctions check
  const sanctionsPayload = JSON.stringify({
    userId: data.userId,
    listSource: 'ofac',
    searchCriteria: {
      fullName: 'Test User',
      dateOfBirth: '1990-01-01',
      nationality: 'US',
      address: '123 Test St',
    },
  });

  const sanctionsResponse = http.post(`${BASE_URL}/compliance/sanctions/check`, sanctionsPayload, {
    headers: authHeaders,
  });
  
  const sanctionsSuccess = check(sanctionsResponse, {
    'create sanctions check status is 201': (r) => r.status === 201,
    'create sanctions check response time < 400ms': (r) => r.timings.duration < 400,
    'sanctions check has ID': (r) => JSON.parse(r.body).id !== undefined,
    'sanctions check status is pending': (r) => JSON.parse(r.body).status === 'pending',
  });
  
  sanctionsSuccessRate.add(sanctionsSuccess);
  complianceErrorRate.add(!sanctionsSuccess);

  sleep(1);

  // Test 5: Get user sanctions checks
  const sanctionsHistoryResponse = http.get(`${BASE_URL}/compliance/sanctions/user/${data.userId}`, {
    headers: authHeaders,
  });
  
  check(sanctionsHistoryResponse, {
    'get sanctions history status is 200': (r) => r.status === 200,
    'get sanctions history response time < 200ms': (r) => r.timings.duration < 200,
    'sanctions history returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 6: Create risk assessment
  const riskPayload = JSON.stringify({
    userId: data.userId,
    kycVerificationId: 'test-kyc-id',
    riskFactors: {
      kycTier: 0.2,
      sanctionsRisk: 0.1,
      transactionPattern: 0.15,
      geographicRisk: 0.05,
    },
  });

  const riskResponse = http.post(`${BASE_URL}/compliance/risk/assess`, riskPayload, {
    headers: authHeaders,
  });
  
  check(riskResponse, {
    'create risk assessment status is 201': (r) => r.status === 201,
    'create risk assessment response time < 300ms': (r) => r.timings.duration < 300,
    'risk assessment has ID': (r) => JSON.parse(r.body).id !== undefined,
    'risk assessment has risk score': (r) => JSON.parse(r.body).riskScore !== undefined,
  });

  sleep(1);

  // Test 7: Get user risk assessments
  const riskHistoryResponse = http.get(`${BASE_URL}/compliance/risk/user/${data.userId}`, {
    headers: authHeaders,
  });
  
  check(riskHistoryResponse, {
    'get risk history status is 200': (r) => r.status === 200,
    'get risk history response time < 200ms': (r) => r.timings.duration < 200,
    'risk history returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 8: Get latest risk assessment
  const latestRiskResponse = http.get(`${BASE_URL}/compliance/risk/user/${data.userId}/latest`, {
    headers: authHeaders,
  });
  
  check(latestRiskResponse, {
    'get latest risk status is 200': (r) => r.status === 200,
    'get latest risk response time < 150ms': (r) => r.timings.duration < 150,
    'latest risk has data': (r) => JSON.parse(r.body).id !== undefined,
  });

  // Test 9: Generate compliance report
  const reportPayload = JSON.stringify({
    reportType: 'kyc_summary',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
  });

  const reportResponse = http.post(`${BASE_URL}/compliance/reports/generate`, reportPayload, {
    headers: authHeaders,
  });
  
  check(reportResponse, {
    'generate report status is 201': (r) => r.status === 201,
    'generate report response time < 600ms': (r) => r.timings.duration < 600,
    'report has ID': (r) => JSON.parse(r.body).id !== undefined,
    'report has content': (r) => JSON.parse(r.body).content !== undefined,
  });

  sleep(1);

  // Test 10: Get compliance reports
  const reportsResponse = http.get(`${BASE_URL}/compliance/reports`, {
    headers: authHeaders,
  });
  
  check(reportsResponse, {
    'get reports status is 200': (r) => r.status === 200,
    'get reports response time < 300ms': (r) => r.timings.duration < 300,
    'reports returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 11: Get compliance dashboard summary
  const dashboardResponse = http.get(`${BASE_URL}/compliance/dashboard/summary`, {
    headers: authHeaders,
  });
  
  check(dashboardResponse, {
    'get dashboard status is 200': (r) => r.status === 200,
    'get dashboard response time < 400ms': (r) => r.timings.duration < 400,
    'dashboard has KYC data': (r) => JSON.parse(r.body).kyc !== undefined,
    'dashboard has sanctions data': (r) => JSON.parse(r.body).sanctions !== undefined,
    'dashboard has risk data': (r) => JSON.parse(r.body).risk !== undefined,
  });

  // Test 12: Process webhook (simulated)
  const webhookPayload = JSON.stringify({
    event: 'verification_completed',
    payload: {
      verification_id: 'test-verification-id',
      status: 'approved',
      user_id: data.userId,
    },
  });

  const webhookResponse = http.post(`${BASE_URL}/compliance/kyc/webhook/onfido`, webhookPayload, {
    headers: authHeaders,
  });
  
  check(webhookResponse, {
    'process webhook status is 200': (r) => r.status === 200,
    'process webhook response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.5); // Brief pause between iterations
}

export function teardown(data) {
  console.log('Compliance load test completed.');
}

export function handleSummary(data) {
  return {
    'compliance-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
