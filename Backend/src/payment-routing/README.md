# Intelligent Payment Routing System

## Overview

A sophisticated payment routing engine that dynamically selects optimal payment rails (bank transfer, card, stablecoin) based on cost, speed, success rate, and user preferences.

## Features

### ✅ Multi-Rail Integration

**Supported Payment Rails:**
- **Bank Transfers:** ACH, Wire (Domestic/International), SEPA, SWIFT
- **Card Networks:** Visa, Mastercard, Amex
- **Stablecoins:** USDC, USDT
- **Digital Wallets:** PayPal, Stripe, Apple Pay, Google Pay

### ✅ Smart Optimization

**Optimization Objectives:**
- **Lowest Cost:** Minimize fees for cost-sensitive payments
- **Fastest Speed:** Prioritize instant settlement
- **Highest Success Rate:** Choose most reliable rails
- **Balanced:** Optimal blend of all factors

### ✅ ML-Based Success Prediction

Real-time success probability calculation considering:
- Historical success rates per rail
- Current rail status and capacity
- Time of day / day of week patterns
- Transaction amount risk scoring
- User transaction history
- Country/currency risk factors

### ✅ Automatic Fallback & Retry

Intelligent retry logic with:
- Circuit breaker pattern to prevent cascading failures
- Automatic fallback to alternative rails
- Configurable retry attempts and delays
- Manual retry capability with rail preference

### ✅ Real-Time FX Comparison

Multi-provider FX rate comparison:
- Live exchange rates from multiple providers
- Best rate selection algorithm
- Spread analysis and optimization
- Rate trend tracking

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Payment Routing Controller                  │
│                    (REST API)                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Payment Routing Service                    │
│                 (Orchestration Layer)                    │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Routing    │  │   Fallback   │  │   Audit      │
│   Engine     │  │   Service    │  │   Trail      │
│              │  │              │  │              │
│ • Filter     │  │ • Retry      │  │ • Logging    │
│ • Score      │  │ • Circuit    │  │ • Analytics  │
│ • Rank       │  │ • Failover   │  │ • Reports    │
└──────────────┘  └──────────────┘  └──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│           Payment Rail Provider Service                 │
│              (Rail Integration Layer)                   │
│                                                         │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐   │
│  │ ACH │Wire │SEPA │SWFT │VISA │MC  │USDC │USDT │   │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘   │
└─────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Payment Routing

```typescript
import { PaymentRoutingService } from './payment-routing.service';

// Inject service
constructor(
  private paymentRouter: PaymentRoutingService,
) {}

// Route a payment
async processPayment() {
  const request: PaymentRoutingRequest = {
    userId: 'user_123',
    amount: 10000n, // $100.00
    currency: 'USD',
    recipientCountry: 'US',
    optimizationObjective: OptimizationObjective.BALANCED,
  };

  const decision = await this.paymentRouter.routePayment(request);
  
  console.log(`Selected rail: ${decision.selectedRail.railType}`);
  console.log(`Expected success rate: ${decision.predictedSuccessRate * 100}%`);
  console.log(`Estimated cost: ${decision.estimatedCost}`);
}
```

### Execute with Automatic Fallback

```typescript
async executeWithFallback() {
  const request: PaymentRoutingRequest = {
    userId: 'user_456',
    amount: 50000n,
    currency: 'USD',
    recipientCountry: 'GB',
    recipientCurrency: 'GBP',
  };

  const result = await this.paymentRouter.quickPayment(
    request,
    async (railType, provider) => {
      // Your payment execution logic here
      return await this.executeActualPayment(railType, provider);
    },
  );

  if (result.execution.success) {
    console.log(`Payment successful via ${result.execution.railType}`);
  } else {
    console.log(`All rails failed: ${result.execution.statusMessage}`);
  }
}
```

### Custom User Preferences

```typescript
// User prioritizes speed over cost
const urgentPayment: PaymentRoutingRequest = {
  userId: 'user_789',
  amount: 25000n,
  currency: 'USD',
  recipientCountry: 'CA',
  isUrgent: true,
  userPreferences: {
    costWeight: 0.2,      // Low priority
    speedWeight: 0.6,     // High priority
    reliabilityWeight: 0.2,
  },
  maxSettlementTime: SettlementSpeed.SAME_DAY,
};
```

### FX Conversion

```typescript
const fxService = new FXRateService();

// Get best rate
const rate = fxService.getBestRate('USD', 'EUR');
console.log(`USD/EUR: ${rate.rate}`);

// Convert amount
const conversion = fxService.convertAmount(10000n, 'USD', 'EUR');
console.log(`$100 USD = €${conversion.convertedAmount} EUR`);
console.log(`Fee: ${conversion.fee}`);

// Compare providers
const comparisons = fxService.compareRates('USD', 'EUR');
comparisons.forEach(c => {
  console.log(`${c.provider}: ${c.rate} (spread: ${c.spread})`);
});
```

## API Endpoints

### POST `/api/payments/route`

Get optimal payment rail without executing

```bash
curl -X POST http://localhost:3000/api/payments/route \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "amount": "10000",
    "currency": "USD",
    "recipientCountry": "US"
  }'
```

### POST `/api/payments/execute`

Route and execute payment with automatic fallback

```bash
curl -X POST http://localhost:3000/api/payments/execute \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_456",
    "amount": "50000",
    "currency": "USD",
    "recipientCountry": "GB",
    "recipientCurrency": "GBP"
  }'
```

### GET `/api/payments/rails`

List available payment rails

```bash
curl http://localhost:3000/api/payments/rails?currency=USD&country=US
```

### POST `/api/payments/preferences/:userId`

Update user preferences

```bash
curl -X POST http://localhost:3000/api/payments/preferences/user_123 \
  -H "Content-Type: application/json" \
  -d '{
    "costWeight": 0.3,
    "speedWeight": 0.5,
    "reliabilityWeight": 0.2
  }'
```

### GET `/api/payments/analytics`

Get routing analytics

```bash
curl "http://localhost:3000/api/payments/analytics?startDate=2024-01-01&endDate=2024-01-31"
```

### POST `/api/payments/retry/:decisionId`

Retry failed payment

```bash
curl -X POST http://localhost:3000/api/payments/retry/route_12345?rail=ACH
```

### GET `/api/payments/fx/:from/:to`

Get FX rate

```bash
curl http://localhost:3000/api/payments/fx/USD/EUR
```

### GET `/api/payments/fx/compare/:from/:to`

Compare FX rates across providers

```bash
curl http://localhost:3000/api/payments/fx/compare/USD/EUR
```

## Default Payment Rails

### Bank Transfers

| Rail | Provider | Fee | Settlement | Limits |
|------|----------|-----|------------|--------|
| ACH | Plaid | $0.50 + 0.8% | 3-5 days | $10M/day |
| Wire Domestic | Fedwire | $25 | Real-time | $100M/day |
| SEPA | Wise | €0.35 + 0.4% | Next day | €1M/day |
| SWIFT | SWIFT | $35 + 1% | 3-5 days | Global |

### Card Networks

| Rail | Provider | Fee | Settlement | Limits |
|------|----------|-----|------------|--------|
| Visa | Stripe | $0.30 + 2.9% | Instant | $1M txn |
| Mastercard | Stripe | $0.30 + 2.9% | Instant | $1M txn |

### Stablecoins

| Rail | Provider | Fee | Settlement | Limits |
|------|----------|-----|------------|--------|
| USDC | Chain | $0.01 + 0.1% | < 1 hour | $100M/day |
| USDT | Chain | $0.01 + 0.1% | < 1 hour | $100M/day |

## Decision Factors

### Cost Calculation

```
Total Fee = Fixed Fee + (Amount × Percentage Fee)
Subject to: Min Fee ≤ Total Fee ≤ Max Fee
```

### Success Rate Prediction

```
Probability = BaseRate × StatusFactor × TimeFactor × AmountFactor
Where:
- BaseRate: Historical 24h success rate
- StatusFactor: 1.0 (ACTIVE), 0.7 (DEGRADED)
- TimeFactor: 1.0 (business hours), 0.95 (off-hours)
- AmountFactor: 1.0 (<$10k), 0.98 (>$10k)
```

### Risk Scoring

Risk factors tracked:
- Cross-border transactions (+15 points)
- High-value (> $1M) (+20 points)
- New rail for user (+10 points)
- International wire/SWIFT (+10 points)

## Audit Trail

Every routing decision is logged with:

- **Decision metadata:** Timestamp, model version, reasoning
- **Alternatives considered:** Top 3 rejected options with scores
- **Execution outcome:** Success/failure, actual settlement time
- **Optimality analysis:** Whether chosen rail was actually best
- **Compliance data:** Risk factors, cross-border flags

### Export Formats

- JSON: Full audit logs for system integration
- CSV: Spreadsheet-compatible for manual review
- Compliance reports: Regulatory reporting format

## Circuit Breaker Pattern

Automatic protection against cascading failures:

```
Failure Count ≥ 5 → Circuit OPENS
Wait 5 minutes → Circuit HALF-OPEN
Success → Circuit CLOSES
Failure → Circuit re-OPENS
```

## Performance Metrics

Tracked per rail:
- Success rate (24h, 7d, 30d)
- Transaction count and volume
- Average settlement time
- P95 settlement time
- Effective fee percentage
- Recent failure reasons

## Configuration

### Environment Variables

```bash
# FX Rate Providers
FX_PROVIDER_PRIMARY=Wise
FX_PROVIDER_SECONDARY=XE

# Retry Configuration
PAYMENT_RETRY_MAX_ATTEMPTS=3
PAYMENT_RETRY_DELAY_MS=5000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MINUTES=5

# Capacity Limits
DAILY_VOLUME_LIMIT_USD=10000000000
MONTHLY_VOLUME_LIMIT_USD=100000000000
```

## Testing

```typescript
describe('Payment Routing', () => {
  it('should select lowest cost rail when cost-optimized', async () => {
    const request: PaymentRoutingRequest = {
      userId: 'test_user',
      amount: 10000n,
      currency: 'USD',
      recipientCountry: 'US',
      optimizationObjective: OptimizationObjective.LOWEST_COST,
    };

    const decision = await router.routePayment(request);
    
    expect(decision.selectedRail.railType).toBe(PaymentRailType.ACH);
    expect(decision.predictedSuccessRate).toBeGreaterThan(0.9);
  });

  it('should fallback to alternative on failure', async () => {
    const result = await router.quickPayment(
      request,
      async (rail, provider) => {
        if (rail === 'VISA') {
          throw new Error('Simulated failure');
        }
        return mockSuccess;
      },
    );

    expect(result.execution.retryAttempts).toBeGreaterThan(0);
    expect(result.execution.success).toBe(true);
  });
});
```

## Production Considerations

### Database Integration

Replace in-memory storage with:
- PostgreSQL for audit logs
- Redis for rate caching
- TimescaleDB for metrics

### Monitoring

Key metrics to track:
- Routing decision latency
- Success rate per rail
- Fallback frequency
- Circuit breaker status
- FX spread optimization

### Security

- Encrypt sensitive payment data
- Implement rate limiting
- Add fraud detection hooks
- Maintain PCI DSS compliance

### Scalability

- Horizontal scaling of routing engine
- Sharded audit log storage
- CDN for FX rate distribution
- Message queue for async processing
