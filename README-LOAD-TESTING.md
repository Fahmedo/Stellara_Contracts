# Load Testing & Performance Benchmarking

This directory contains comprehensive load testing and performance benchmarking tools for the Stellara platform using k6.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- k6 installed locally or via Docker
- Access to the Stellara API endpoints

### Installation

1. Install k6:
```bash
# On macOS
brew install k6

# On Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or download from https://k6.io/
```

2. Set up environment variables:
```bash
export API_BASE_URL="https://api.stellara.io"
export TEST_USER_EMAIL="your-test-user@example.com"
export TEST_USER_PASSWORD="your-test-password"
```

### Running Tests

#### Smoke Test (Quick Health Check)
```bash
npm run test:load:smoke
```

#### Full Load Test Suite
```bash
npm run test:load:all
```

#### Individual Test Suites
```bash
npm run test:load:auth          # Authentication flow
npm run test:load:trading        # Trading API endpoints
npm run test:load:query          # Query and data retrieval
npm run test:load:compliance     # Compliance and KYC endpoints
npm run test:load:feature-flags  # Feature flags and A/B testing
```

#### Advanced Test Types
```bash
npm run test:load:stress         # High-intensity stress test
npm run test:load:spike          # Spike test (sudden load increase)
npm run test:load:soak           # Long-duration soak test
```

## 📊 Test Suites

### 1. Authentication Flow Test (`auth-flow-test.js`)
Tests the authentication endpoints under load:
- User registration
- Login/logout
- Token validation and refresh
- Profile management

**Targets:**
- 1000 concurrent users
- Response time < 300ms (p95)
- Error rate < 2%

### 2. Trading API Test (`trading-api-test.js`)
Tests trading functionality:
- Market data retrieval
- Order placement/cancellation
- Order book queries
- Trading history
- Portfolio management

**Targets:**
- 1000 concurrent users
- Response time < 200ms (p95)
- Error rate < 1%

### 3. Query API Test (`query-api-test.js`)
Tests data retrieval endpoints:
- User profiles and history
- Market statistics
- Search functionality
- Notifications
- System metrics

**Targets:**
- 1500 concurrent users
- Response time < 150ms (p95)
- Error rate < 0.5%

### 4. Compliance API Test (`compliance-api-test.js`)
Tests compliance and KYC endpoints:
- KYC verification submission
- Sanctions screening
- Risk assessment
- Compliance reporting
- Dashboard data

**Targets:**
- 400 concurrent users
- Response time < 400ms (p95)
- Error rate < 2%

### 5. Feature Flags Test (`feature-flags-test.js`)
Tests feature flag and A/B testing:
- Flag evaluation
- Batch evaluation
- Experiment assignment
- Conversion tracking
- Analytics endpoints

**Targets:**
- 2000 concurrent users
- Response time < 100ms (p95)
- Error rate < 0.5%

## 🎯 Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| Response Time (p95) | < 200ms | 95th percentile response time |
| Response Time (p99) | < 500ms | 99th percentile response time |
| Error Rate | < 1% | Overall error rate |
| Throughput | > 100 req/s | Minimum requests per second |
| Concurrent Users | 1000 | Target concurrent user load |

## 📈 CI/CD Integration

The load tests are integrated into GitHub Actions and run automatically:

### Triggers
- **Pull Requests**: Smoke tests on staging environment
- **Push to main/develop**: Full test suite on staging
- **Daily Schedule**: Full test suite at 2 AM UTC
- **Manual Dispatch**: Custom test types and environments

### Performance Thresholds
The CI pipeline checks against defined performance thresholds and fails if:
- P95 response time exceeds 200ms
- P99 response time exceeds 500ms
- Error rate exceeds 1%

### Results and Reporting
- Test results are uploaded as GitHub artifacts
- Performance reports are generated in PR summaries
- Degradation notifications are sent on threshold violations

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_BASE_URL` | Base URL for the API | `http://localhost:3001` |
| `TEST_USER_EMAIL` | Test user email | Required |
| `TEST_USER_PASSWORD` | Test user password | Required |
| `CLEANUP` | Clean up test data after run | `false` |

### k6 Configuration

The main configuration is in `k6.config.js`:
- Virtual user stages for gradual ramp-up
- Performance thresholds
- Custom metrics
- Cloud configuration (optional)

### Customizing Tests

#### Modifying Load Patterns
Edit the `stages` in each test file:
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 500 },   // Sustain
    { duration: '2m', target: 0 },     // Ramp down
  ],
};
```

#### Adding New Endpoints
Add new test scenarios in the default function:
```javascript
export default function (data) {
  const response = http.get(`${BASE_URL}/new-endpoint`, {
    headers: authHeaders,
  });
  
  check(response, {
    'new endpoint status is 200': (r) => r.status === 200,
    'new endpoint response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## 📊 Monitoring and Analytics

### Metrics Collection
- Response times (avg, p95, p99)
- Error rates
- Throughput (requests per second)
- Custom business metrics

### Result Analysis
Results are saved as JSON files for analysis:
```bash
# Generate HTML report
k6 run --out json=results.json tests/load/trading-api-test.js
k6 report results.json --out report.html
```

### Benchmarking
Compare performance over time:
```bash
# Run baseline test
npm run test:benchmark:baseline

# Run comparison test
npm run test:benchmark:compare
```

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify test user credentials
   - Check API endpoint URLs
   - Ensure user has required permissions

2. **High Error Rates**
   - Check server logs for errors
   - Verify database connections
   - Monitor resource utilization

3. **Slow Response Times**
   - Check database query performance
   - Monitor network latency
   - Review application logs

### Debug Mode
Run tests with verbose output:
```bash
k6 run --verbose tests/load/trading-api-test.js
```

### Environment Setup
For local testing, ensure:
- Backend services are running
- Database is accessible
- Network connectivity to API endpoints

## 📝 Best Practices

1. **Test Regularly**: Run smoke tests on every PR
2. **Monitor Trends**: Track performance over time
3. **Set Realistic Targets**: Base thresholds on business requirements
4. **Test Different Scenarios**: Cover various user behaviors
5. **Clean Up Resources**: Remove test data after runs
6. **Document Results**: Keep performance records for analysis

## 🔗 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/test-types/load-testing/)
- [k6 Cloud](https://k6.io/cloud/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 📞 Support

For questions or issues with load testing:
- Check the [GitHub Issues](https://github.com/stellara-network/Stellara_Contracts/issues)
- Review the test logs and error messages
- Consult the k6 documentation for advanced configurations

---

**Note**: Always run load tests against staging or test environments. Never run performance tests against production without proper coordination.
