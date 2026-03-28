// Trading API Load Test
// Tests the trading endpoints under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let tradingErrorRate = new Rate('trading_errors');
export let orderSuccessRate = new Rate('order_success');
export let querySuccessRate = new Rate('query_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Warm up
    { duration: '5m', target: 500 },   // Load test
    { duration: '2m', target: 1000 },  // Peak load
    { duration: '5m', target: 1000 },  // Sustained peak
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    trading_errors: ['rate<0.01'],
    order_success: ['rate>0.95'],
    query_success: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Test data
const tradingPairs = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'];
const orderTypes = ['market', 'limit'];
const orderSides = ['buy', 'sell'];

// Setup function to authenticate users
export function setup() {
  console.log('Setting up trading load test...');
  
  // Authenticate test users
  const credentials = {
    email: __ENV.TEST_USER_EMAIL || 'trader@example.com',
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

  // Test 1: Get trading pairs
  const pairsResponse = http.get(`${BASE_URL}/trading/pairs`, {
    headers: authHeaders,
  });
  
  const pairsSuccess = check(pairsResponse, {
    'get pairs status is 200': (r) => r.status === 200,
    'get pairs response time < 100ms': (r) => r.timings.duration < 100,
    'get pairs returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });
  
  querySuccessRate.add(pairsSuccess);
  tradingErrorRate.add(!pairsSuccess);

  // Test 2: Get market data for random pair
  const randomPair = tradingPairs[Math.floor(Math.random() * tradingPairs.length)];
  const marketDataResponse = http.get(`${BASE_URL}/trading/market/${randomPair}`, {
    headers: authHeaders,
  });
  
  check(marketDataResponse, {
    'get market data status is 200': (r) => r.status === 200,
    'get market data response time < 150ms': (r) => r.timings.duration < 150,
    'get market data has price': (r) => JSON.parse(r.body).price !== undefined,
    'get market data has volume': (r) => JSON.parse(r.body).volume !== undefined,
  });

  // Test 3: Get order book
  const orderBookResponse = http.get(`${BASE_URL}/trading/orderbook/${randomPair}`, {
    headers: authHeaders,
  });
  
  check(orderBookResponse, {
    'get order book status is 200': (r) => r.status === 200,
    'get order book response time < 200ms': (r) => r.timings.duration < 200,
    'get order book has bids': (r) => Array.isArray(JSON.parse(r.body).bids),
    'get order book has asks': (r) => Array.isArray(JSON.parse(r.body).asks),
  });

  // Test 4: Get user balances
  const balancesResponse = http.get(`${BASE_URL}/trading/balances`, {
    headers: authHeaders,
  });
  
  check(balancesResponse, {
    'get balances status is 200': (r) => r.status === 200,
    'get balances response time < 150ms': (r) => r.timings.duration < 150,
    'get balances returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 5: Place a limit order (70% probability)
  if (Math.random() < 0.7) {
    const orderPayload = JSON.stringify({
      pair: randomPair,
      type: orderTypes[Math.floor(Math.random() * orderTypes.length)],
      side: orderSides[Math.floor(Math.random() * orderSides.length)],
      amount: Math.random() * 10 + 0.1, // 0.1 to 10.1
      price: Math.random() * 1000 + 100, // 100 to 1100
    });

    const orderResponse = http.post(`${BASE_URL}/trading/orders`, orderPayload, {
      headers: authHeaders,
    });
    
    const orderSuccess = check(orderResponse, {
      'place order status is 201': (r) => r.status === 201,
      'place order response time < 300ms': (r) => r.timings.duration < 300,
      'place order has order ID': (r) => JSON.parse(r.body).id !== undefined,
      'place order has status': (r) => JSON.parse(r.body).status !== undefined,
    });
    
    orderSuccessRate.add(orderSuccess);
    tradingErrorRate.add(!orderSuccess);

    if (orderSuccess) {
      const orderData = JSON.parse(orderResponse.body);
      
      // Test 6: Cancel the order (30% probability)
      if (Math.random() < 0.3) {
        sleep(1); // Wait a bit before cancelling
        
        const cancelResponse = http.delete(`${BASE_URL}/trading/orders/${orderData.id}`, {
          headers: authHeaders,
        });
        
        check(cancelResponse, {
          'cancel order status is 200': (r) => r.status === 200,
          'cancel order response time < 200ms': (r) => r.timings.duration < 200,
        });
      }
    }
  }

  // Test 7: Get open orders
  const openOrdersResponse = http.get(`${BASE_URL}/trading/orders?status=open`, {
    headers: authHeaders,
  });
  
  check(openOrdersResponse, {
    'get open orders status is 200': (r) => r.status === 200,
    'get open orders response time < 200ms': (r) => r.timings.duration < 200,
    'get open orders returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 8: Get order history
  const orderHistoryResponse = http.get(`${BASE_URL}/trading/orders/history?limit=50`, {
    headers: authHeaders,
  });
  
  check(orderHistoryResponse, {
    'get order history status is 200': (r) => r.status === 200,
    'get order history response time < 250ms': (r) => r.timings.duration < 250,
    'get order history returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  // Test 9: Get trading statistics
  const statsResponse = http.get(`${BASE_URL}/trading/stats`, {
    headers: authHeaders,
  });
  
  check(statsResponse, {
    'get trading stats status is 200': (r) => r.status === 200,
    'get trading stats response time < 300ms': (r) => r.timings.duration < 300,
    'get trading stats has data': (r) => Object.keys(JSON.parse(r.body)).length > 0,
  });

  // Test 10: Get recent trades for pair
  const recentTradesResponse = http.get(`${BASE_URL}/trading/trades/${randomPair}?limit=20`, {
    headers: authHeaders,
  });
  
  check(recentTradesResponse, {
    'get recent trades status is 200': (r) => r.status === 200,
    'get recent trades response time < 200ms': (r) => r.timings.duration < 200,
    'get recent trades returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  sleep(0.5); // Brief pause between iterations
}

export function teardown(data) {
  console.log('Trading load test completed.');
}

export function handleSummary(data) {
  return {
    'trading-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
