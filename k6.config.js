// k6 Configuration File
// This file configures k6 for load testing and performance benchmarking

import { Rate } from 'k6/metrics';

// Custom metrics for tracking
export let errorRate = new Rate('errors');
export let authErrorRate = new Rate('auth_errors');
export let apiErrorRate = new Rate('api_errors');

// Test configuration
export const options = {
  // Basic configuration
  vus: 100, // Virtual users
  duration: '5m', // Test duration
  
  // Stages for gradual ramp-up
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 500 }, // Ramp up to 500 users
    { duration: '5m', target: 1000 }, // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '5m', target: 500 },  // Ramp down to 500 users
    { duration: '2m', target: 100 },  // Ramp down to 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],

  // Thresholds for performance targets
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<200', 'p(99)<500'], // 95% under 200ms, 99% under 500ms
    http_req_waiting: ['p(95)<150', 'p(99)<400'],   // Waiting time thresholds
    http_req_connecting: ['p(95)<50'],               // Connection time threshold
    
    // Error rate thresholds
    errors: ['rate<0.01'],                           // Error rate under 1%
    auth_errors: ['rate<0.005'],                      // Auth error rate under 0.5%
    api_errors: ['rate<0.01'],                        // API error rate under 1%
    
    // Request rate thresholds
    http_reqs: ['rate>100'],                          // At least 100 requests per second
    http_req_failed: ['rate<0.01'],                   // Failed requests under 1%
  },

  // Cloud configuration (if using k6 Cloud)
  ext: {
    loadimpact: {
      projectID: 123456, // Replace with your project ID
      name: 'Stellara Load Test',
    },
  },
};

// Default function for setup
export function setup() {
  console.log('Setting up load test environment...');
  
  // Initialize test data
  const testData = {
    baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
    apiBaseUrl: __ENV.API_BASE_URL || 'http://localhost:3001',
    testUsers: generateTestUsers(1000),
    testTokens: [],
  };
  
  // Authenticate test users
  for (const user of testData.testUsers) {
    try {
      const token = authenticateUser(user);
      if (token) {
        testData.testTokens.push({
          userId: user.id,
          token: token,
          email: user.email,
        });
      }
    } catch (error) {
      console.error(`Failed to authenticate user ${user.email}:`, error);
    }
  }
  
  console.log(`Setup complete. Authenticated ${testData.testTokens.length} users.`);
  return testData;
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed. Cleaning up...');
  
  // Clean up test data if needed
  if (__ENV.CLEANUP === 'true') {
    cleanupTestData(data);
  }
  
  console.log('Cleanup complete.');
}

// Helper functions
function generateTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      id: `test-user-${i}`,
      email: `testuser${i}@example.com`,
      password: 'TestPassword123!',
      firstName: `Test${i}`,
      lastName: `User${i}`,
    });
  }
  return users;
}

function authenticateUser(user) {
  const response = http.post(`${data.apiBaseUrl}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (response.status === 200) {
    const result = JSON.parse(response.body);
    return result.access_token;
  }
  
  return null;
}

function cleanupTestData(data) {
  // Implement cleanup logic here
  console.log('Cleaning up test data...');
}
