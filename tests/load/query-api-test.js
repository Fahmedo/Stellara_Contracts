// Query API Load Test
// Tests the query endpoints under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let queryErrorRate = new Rate('query_errors');
export let querySuccessRate = new Rate('query_success');
export let dataIntegrityRate = new Rate('data_integrity');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 200 },   // Warm up
    { duration: '5m', target: 800 },   // Load test
    { duration: '2m', target: 1500 },  // Peak load
    { duration: '5m', target: 1500 },  // Sustained peak
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<300'],
    query_errors: ['rate<0.005'],
    query_success: ['rate>0.99'],
    data_integrity: ['rate>0.999'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Setup function to authenticate users
export function setup() {
  console.log('Setting up query load test...');
  
  // Authenticate test users
  const credentials = {
    email: __ENV.TEST_USER_EMAIL || 'queryuser@example.com',
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

  // Test 1: Get user profile
  const profileResponse = http.get(`${BASE_URL}/users/profile`, {
    headers: authHeaders,
  });
  
  const profileSuccess = check(profileResponse, {
    'get profile status is 200': (r) => r.status === 200,
    'get profile response time < 100ms': (r) => r.timings.duration < 100,
    'profile has email': (r) => JSON.parse(r.body).email !== undefined,
    'profile has id': (r) => JSON.parse(r.body).id !== undefined,
  });
  
  querySuccessRate.add(profileSuccess);
  queryErrorRate.add(!profileSuccess);

  // Test 2: Get user transactions
  const transactionsResponse = http.get(`${BASE_URL}/users/transactions?limit=50`, {
    headers: authHeaders,
  });
  
  check(transactionsResponse, {
    'get transactions status is 200': (r) => r.status === 200,
    'get transactions response time < 200ms': (r) => r.timings.duration < 200,
    'transactions returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 3: Get user trading history
  const tradingHistoryResponse = http.get(`${BASE_URL}/users/trading-history?limit=100`, {
    headers: authHeaders,
  });
  
  check(tradingHistoryResponse, {
    'get trading history status is 200': (r) => r.status === 200,
    'get trading history response time < 250ms': (r) => r.timings.duration < 250,
    'trading history returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 4: Get user portfolio
  const portfolioResponse = http.get(`${BASE_URL}/users/portfolio`, {
    headers: authHeaders,
  });
  
  check(portfolioResponse, {
    'get portfolio status is 200': (r) => r.status === 200,
    'get portfolio response time < 150ms': (r) => r.timings.duration < 150,
    'portfolio has total value': (r) => JSON.parse(r.body).totalValue !== undefined,
    'portfolio has assets': (r) => Array.isArray(JSON.parse(r.body).assets),
  });

  // Test 5: Get market data for multiple pairs
  const pairs = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
  for (const pair of pairs) {
    const marketDataResponse = http.get(`${BASE_URL}/market/${pair}`, {
      headers: authHeaders,
    });
    
    const marketSuccess = check(marketDataResponse, {
      [`get market data ${pair} status is 200`]: (r) => r.status === 200,
      [`get market data ${pair} response time < 100ms`]: (r) => r.timings.duration < 100,
      [`market data ${pair} has price`]: (r) => JSON.parse(r.body).price !== undefined,
      [`market data ${pair} has volume`]: (r) => JSON.parse(r.body).volume !== undefined,
    });
    
    querySuccessRate.add(marketSuccess);
    queryErrorRate.add(!marketSuccess);
  }

  // Test 6: Get order book depth
  const orderBookResponse = http.get(`${BASE_URL}/market/orderbook/BTC/USD?depth=20`, {
    headers: authHeaders,
  });
  
  check(orderBookResponse, {
    'get order book status is 200': (r) => r.status === 200,
    'get order book response time < 150ms': (r) => r.timings.duration < 150,
    'order book has bids': (r) => Array.isArray(JSON.parse(r.body).bids),
    'order book has asks': (r) => Array.isArray(JSON.parse(r.body).asks),
    'order book depth is correct': (r) => JSON.parse(r.body).bids.length <= 20,
  });

  // Test 7: Get recent trades
  const recentTradesResponse = http.get(`${BASE_URL}/market/trades/BTC/USD?limit=50`, {
    headers: authHeaders,
  });
  
  check(recentTradesResponse, {
    'get recent trades status is 200': (r) => r.status === 200,
    'get recent trades response time < 120ms': (r) => r.timings.duration < 120,
    'recent trades returns array': (r) => Array.isArray(JSON.parse(r.body)),
    'recent trades limit respected': (r) => JSON.parse(r.body).length <= 50,
  });

  // Test 8: Get market statistics
  const marketStatsResponse = http.get(`${BASE_URL}/market/stats`, {
    headers: authHeaders,
  });
  
  check(marketStatsResponse, {
    'get market stats status is 200': (r) => r.status === 200,
    'get market stats response time < 200ms': (r) => r.timings.duration < 200,
    'market stats has data': (r) => Object.keys(JSON.parse(r.body)).length > 0,
  });

  // Test 9: Search functionality
  const searchResponse = http.get(`${BASE_URL}/search?q=BTC&type=market`, {
    headers: authHeaders,
  });
  
  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 300ms': (r) => r.timings.duration < 300,
    'search returns results': (r) => Array.isArray(JSON.parse(r.body).results),
  });

  // Test 10: Get notifications
  const notificationsResponse = http.get(`${BASE_URL}/users/notifications?limit=20`, {
    headers: authHeaders,
  });
  
  check(notificationsResponse, {
    'get notifications status is 200': (r) => r.status === 200,
    'get notifications response time < 150ms': (r) => r.timings.duration < 150,
    'notifications returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 11: Get API health status
  const healthResponse = http.get(`${BASE_URL}/health`, {
    headers: authHeaders,
  });
  
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 50ms': (r) => r.timings.duration < 50,
    'health check has status': (r) => JSON.parse(r.body).status !== undefined,
  });

  // Test 12: Get system metrics
  const metricsResponse = http.get(`${BASE_URL}/metrics`, {
    headers: authHeaders,
  });
  
  check(metricsResponse, {
    'get metrics status is 200': (r) => r.status === 200,
    'get metrics response time < 100ms': (r) => r.timings.duration < 100,
    'metrics has data': (r) => Object.keys(JSON.parse(r.body)).length > 0,
  });

  // Test 13: Data integrity check - verify consistency
  const consistencyResponse = http.get(`${BASE_URL}/users/balances`, {
    headers: authHeaders,
  });
  
  if (consistencyResponse.status === 200) {
    const balances = JSON.parse(consistencyResponse.body);
    const hasValidBalances = balances.every(balance => 
      balance.amount !== undefined && 
      balance.currency !== undefined &&
      typeof balance.amount === 'number'
    );
    
    dataIntegrityRate.add(hasValidBalances);
    
    check(consistencyResponse, {
      'balances data is consistent': () => hasValidBalances,
    });
  }

  sleep(0.3); // Brief pause between iterations
}

export function teardown(data) {
  console.log('Query load test completed.');
}

export function handleSummary(data) {
  return {
    'query-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
