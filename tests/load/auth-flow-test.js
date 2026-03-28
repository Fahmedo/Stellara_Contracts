// Authentication Flow Load Test
// Tests the authentication endpoints under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let authErrorRate = new Rate('auth_errors');
export let loginSuccessRate = new Rate('login_success');
export let registerSuccessRate = new Rate('register_success');

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
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    auth_errors: ['rate<0.02'],
    login_success: ['rate>0.95'],
    register_success: ['rate>0.90'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

// Test data
const testUsers = [
  {
    email: 'loadtest1@example.com',
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test1',
  },
  {
    email: 'loadtest2@example.com',
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test2',
  },
  {
    email: 'loadtest3@example.com',
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test3',
  },
  {
    email: 'loadtest4@example.com',
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test4',
  },
  {
    email: 'loadtest5@example.com',
    password: 'LoadTest123!',
    firstName: 'Load',
    lastName: 'Test5',
  },
];

export default function () {
  // Randomly select a test user
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const uniqueEmail = `${Date.now()}-${Math.random()}@loadtest.com`;

  // Test user registration
  const registerPayload = JSON.stringify({
    email: uniqueEmail,
    password: user.password,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  const registerParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const registerResponse = http.post(`${BASE_URL}/auth/register`, registerPayload, registerParams);
  
  const registerSuccess = check(registerResponse, {
    'registration status is 201': (r) => r.status === 201,
    'registration response time < 500ms': (r) => r.timings.duration < 500,
    'registration has token': (r) => JSON.parse(r.body).access_token !== undefined,
  });

  registerSuccessRate.add(registerSuccess);
  authErrorRate.add(!registerSuccess);

  sleep(1);

  // Test user login
  const loginPayload = JSON.stringify({
    email: uniqueEmail,
    password: user.password,
  });

  const loginResponse = http.post(`${BASE_URL}/auth/login`, loginPayload, registerParams);
  
  const loginSuccess = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 300ms': (r) => r.timings.duration < 300,
    'login has token': (r) => JSON.parse(r.body).access_token !== undefined,
    'login has user info': (r) => JSON.parse(r.body).user !== undefined,
  });

  loginSuccessRate.add(loginSuccess);
  authErrorRate.add(!loginSuccess);

  if (loginSuccess) {
    const loginData = JSON.parse(loginResponse.body);
    const token = loginData.access_token;

    // Test token validation
    const validateParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    const validateResponse = http.get(`${BASE_URL}/auth/validate`, validateParams);
    
    check(validateResponse, {
      'token validation status is 200': (r) => r.status === 200,
      'token validation response time < 200ms': (r) => r.timings.duration < 200,
      'token is valid': (r) => JSON.parse(r.body).valid === true,
    });

    // Test user profile fetch
    const profileResponse = http.get(`${BASE_URL}/auth/profile`, validateParams);
    
    check(profileResponse, {
      'profile fetch status is 200': (r) => r.status === 200,
      'profile fetch response time < 300ms': (r) => r.timings.duration < 300,
      'profile has user data': (r) => JSON.parse(r.body).email !== undefined,
    });

    // Test token refresh
    const refreshResponse = http.post(`${BASE_URL}/auth/refresh`, null, validateParams);
    
    check(refreshResponse, {
      'token refresh status is 200': (r) => r.status === 200,
      'token refresh response time < 300ms': (r) => r.timings.duration < 300,
      'refresh has new token': (r) => JSON.parse(r.body).access_token !== undefined,
    });

    // Test logout
    const logoutResponse = http.post(`${BASE_URL}/auth/logout`, null, validateParams);
    
    check(logoutResponse, {
      'logout status is 200': (r) => r.status === 200,
      'logout response time < 200ms': (r) => r.timings.duration < 200,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'auth-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
