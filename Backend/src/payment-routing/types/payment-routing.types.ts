/**
 * Payment rail types for multi-rail routing
 */
export enum PaymentRailType {
  // Bank Transfers
  ACH = 'ACH',                    // Automated Clearing House (US)
  WIRE_DOMESTIC = 'WIRE_DOMESTIC', // Domestic Wire Transfer
  WIRE_INTERNATIONAL = 'WIRE_INTL', // International Wire
  SEPA = 'SEPA',                   // Single Euro Payments Area
  SWIFT = 'SWIFT',                 // Society for Worldwide Interbank Financial Telecommunication
  
  // Card Networks
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  AMEX = 'AMEX',
  
  // Stablecoin/Crypto
  STABLECOIN_USDT = 'STABLECOIN_USDT',
  STABLECOIN_USDC = 'STABLECOIN_USDC',
  CRYPTO_BTC = 'CRYPTO_BTC',
  CRYPTO_ETH = 'CRYPTO_ETH',
  
  // Digital Wallets
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIPE',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
}

/**
 * Payment rail status
 */
export enum RailStatus {
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',      // Higher failure rates
  DOWN = 'DOWN',              // Temporarily unavailable
  MAINTENANCE = 'MAINTENANCE', // Scheduled maintenance
}

/**
 * Settlement speed classification
 */
export enum SettlementSpeed {
  INSTANT = 'INSTANT',         // < 1 minute
  REAL_TIME = 'REAL_TIME',     // < 1 hour
  SAME_DAY = 'SAME_DAY',       // Same business day
  NEXT_DAY = 'NEXT_DAY',       // Next business day
  STANDARD = 'STANDARD',       // 2-3 business days
  SLOW = 'SLOW',               // 3-5 business days
}

/**
 * Optimization objective
 */
export enum OptimizationObjective {
  LOWEST_COST = 'LOWEST_COST',
  FASTEST_SPEED = 'FASTEST_SPEED',
  HIGHEST_SUCCESS_RATE = 'HIGHEST_SUCCESS_RATE',
  BALANCED = 'BALANCED',
}

/**
 * User preference weights
 */
export interface UserPreferenceWeights {
  costWeight: number;      // 0-1, importance of low fees
  speedWeight: number;     // 0-1, importance of fast settlement
  reliabilityWeight: number; // 0-1, importance of success rate
  privacyWeight: number;   // 0-1, importance of privacy
}

/**
 * Payment rail configuration
 */
export interface PaymentRailConfig {
  railType: PaymentRailType;
  provider: string; // e.g., "Stripe", "Plaid", "Chain"
  isEnabled: boolean;
  priority: number; // Lower = higher priority
  
  // Cost structure
  fixedFee: bigint; // In smallest currency unit
  percentageFee: number; // Percentage of amount
  minFee: bigint;
  maxFee: bigint;
  
  // Speed characteristics
  averageSettlementTime: SettlementSpeed;
  guaranteedSettlementTime?: SettlementSpeed;
  
  // Limits
  minAmount: bigint;
  maxAmount: bigint;
  dailyLimit: bigint;
  monthlyLimit: bigint;
  
  // Supported currencies
  supportedCurrencies: string[];
  
  // Geographic availability
  availableCountries: string[];
  restrictedCountries: string[];
  
  // Current status
  status: RailStatus;
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Real-time rail performance metrics
 */
export interface RailPerformanceMetrics {
  railType: PaymentRailType;
  provider: string;
  
  // Success rates
  successRate24h: number; // Percentage (0-100)
  successRate7d: number;
  successRate30d: number;
  
  // Volume metrics
  transactionCount24h: number;
  totalVolume24h: bigint;
  avgTransactionSize: bigint;
  
  // Timing metrics
  avgSettlementTimeMinutes: number;
  p95SettlementTimeMinutes: number;
  
  // Cost metrics
  avgEffectiveFeePercentage: number;
  
  // Recent failures
  recentFailures: number; // Last hour
  failureReasons: Array<{
    reason: string;
    count: number;
  }>;
  
  timestamp: Date;
}

/**
 * ML-based success prediction
 */
export interface SuccessPrediction {
  railType: PaymentRailType;
  provider: string;
  probability: number; // 0-1
  
  // Contributing factors
  factors: {
    historicalSuccessRate: number;
    currentRailStatus: number;
    timeOfDayFactor: number;
    dayOfWeekFactor: number;
    amountFactor: number;
    userHistoryFactor: number;
    currencyPairFactor: number;
    countryRiskFactor: number;
  };
  
  confidence: number; // Model confidence (0-1)
  modelVersion: string;
}

/**
 * FX Rate for cross-border payments
 */
export interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  inverseRate: number;
  spread: number; // Markup over mid-market rate
  provider: string;
  timestamp: Date;
  validUntil: Date;
}

/**
 * Routing decision result
 */
export interface RoutingDecision {
  // Primary choice
  selectedRail: PaymentRailConfig;
  predictedSuccessRate: number;
  estimatedCost: bigint;
  estimatedSettlementTime: SettlementSpeed;
  
  // Alternatives considered
  alternatives: Array<{
    rail: PaymentRailConfig;
    score: number;
    reason: string;
  }>;
  
  // Decision factors
  optimizationObjective: OptimizationObjective;
  userPreferences: UserPreferenceWeights;
  
  // Cost breakdown
  costBreakdown: {
    railFee: bigint;
    fxFee?: bigint;
    totalCost: bigint;
    effectivePercentage: number;
  };
  
  // Risk assessment
  riskScore: number; // 0-100
  riskFactors: string[];
  
  // Audit trail
  decisionId: string;
  decisionTimestamp: Date;
  modelVersion: string;
  reasoning: string;
}

/**
 * Payment routing request
 */
export interface PaymentRoutingRequest {
  userId: string;
  amount: bigint;
  currency: string;
  
  // Counterparty details
  recipientCountry: string;
  recipientCurrency?: string; // For cross-border
  
  // Optional constraints
  preferredRails?: PaymentRailType[];
  excludedRails?: PaymentRailType[];
  maxSettlementTime?: SettlementSpeed;
  maxFee?: bigint;
  
  // Optimization preference
  optimizationObjective?: OptimizationObjective;
  userPreferences?: Partial<UserPreferenceWeights>;
  
  // Context
  paymentPurpose?: string; // e.g., "invoice", "salary", "refund"
  isRecurring?: boolean;
  isUrgent?: boolean;
  
  metadata?: Record<string, any>;
}

/**
 * Payment execution result
 */
export interface PaymentExecutionResult {
  success: boolean;
  railType: PaymentRailType;
  provider: string;
  transactionId: string;
  amount: bigint;
  fee: bigint;
  currency: string;
  
  // Timing
  initiatedAt: Date;
  settledAt?: Date;
  expectedSettlement: Date;
  
  // Status
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  statusMessage?: string;
  
  // Failure handling
  failureReason?: string;
  retryable: boolean;
  retryAttempts: number;
  
  // Audit
  routingDecisionId: string;
  executedBy: string;
  
  metadata?: Record<string, any>;
}

/**
 * Historical routing performance
 */
export interface RoutingHistory {
  decisionId: string;
  request: PaymentRoutingRequest;
  decision: RoutingDecision;
  execution: PaymentExecutionResult;
  
  // Outcome analysis
  wasOptimal: boolean; // Did we choose the best rail?
  alternativeOutcome?: {
    railType: PaymentRailType;
    wouldHaveSucceeded: boolean;
    wouldHaveCost: bigint;
    wouldHaveSettledAt: Date;
  };
  
  createdAt: Date;
}

/**
 * Rail capacity and limits tracking
 */
export interface RailCapacity {
  railType: PaymentRailType;
  provider: string;
  
  // Current utilization
  dailyVolumeUsed: bigint;
  dailyVolumeRemaining: bigint;
  monthlyVolumeUsed: bigint;
  monthlyVolumeRemaining: bigint;
  
  // Transaction counts
  dailyTransactionsUsed: number;
  dailyTransactionsRemaining: number;
  
  // Limits (needed for calculations)
  dailyLimit: bigint;
  monthlyLimit: bigint;
  
  // Status
  isAvailable: boolean;
  capacityUtilization: number; // Percentage (0-100)
  
  lastUpdated: Date;
}
