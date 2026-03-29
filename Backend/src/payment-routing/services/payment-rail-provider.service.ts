import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentRailType,
  RailStatus,
  SettlementSpeed,
  PaymentRailConfig,
  RailPerformanceMetrics,
  RailCapacity,
} from '../types/payment-routing.types';

/**
 * Payment Rail Provider Service
 * Manages integrations with various payment rail providers
 */
@Injectable()
export class PaymentRailProviderService {
  private readonly logger = new Logger(PaymentRailProviderService.name);

  // Rail configurations (in production, load from database)
  private railConfigs = new Map<string, PaymentRailConfig>();

  // Performance metrics cache
  private performanceMetrics = new Map<string, RailPerformanceMetrics>();

  // Capacity tracking
  private railCapacities = new Map<string, RailCapacity>();

  constructor() {
    this.initializeDefaultRails();
  }

  /**
   * Initialize default payment rails
   */
  private initializeDefaultRails(): void {
    const defaultRails: PaymentRailConfig[] = [
      // ACH - US Bank Transfers
      {
        railType: PaymentRailType.ACH,
        provider: 'Plaid',
        isEnabled: true,
        priority: 10,
        fixedFee: 50n, // $0.50
        percentageFee: 0.008, // 0.8%
        minFee: 50n,
        maxFee: 500n,
        averageSettlementTime: SettlementSpeed.STANDARD,
        minAmount: 1n,
        maxAmount: 1_000_000_000n, // $10M
        dailyLimit: 10_000_000_000n,
        monthlyLimit: 100_000_000_000n,
        supportedCurrencies: ['USD'],
        availableCountries: ['US'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // Domestic Wire
      {
        railType: PaymentRailType.WIRE_DOMESTIC,
        provider: 'Fedwire',
        isEnabled: true,
        priority: 20,
        fixedFee: 2500n, // $25
        percentageFee: 0,
        minFee: 2500n,
        maxFee: 5000n,
        averageSettlementTime: SettlementSpeed.REAL_TIME,
        minAmount: 100_000n, // $1,000 minimum
        maxAmount: 100_000_000_000n,
        dailyLimit: 100_000_000_000n,
        monthlyLimit: 1_000_000_000_000n,
        supportedCurrencies: ['USD'],
        availableCountries: ['US'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // SEPA - Euro transfers
      {
        railType: PaymentRailType.SEPA,
        provider: 'Wise',
        isEnabled: true,
        priority: 15,
        fixedFee: 35n, // €0.35
        percentageFee: 0.004, // 0.4%
        minFee: 35n,
        maxFee: 700n,
        averageSettlementTime: SettlementSpeed.NEXT_DAY,
        minAmount: 1n,
        maxAmount: 100_000_000n, // €1M
        dailyLimit: 1_000_000_000n,
        monthlyLimit: 10_000_000_000n,
        supportedCurrencies: ['EUR'],
        availableCountries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // SWIFT International
      {
        railType: PaymentRailType.SWIFT,
        provider: 'SWIFT',
        isEnabled: true,
        priority: 30,
        fixedFee: 3500n, // $35
        percentageFee: 0.01, // 1%
        minFee: 3500n,
        maxFee: 15000n,
        averageSettlementTime: SettlementSpeed.STANDARD,
        minAmount: 100_000n,
        maxAmount: 1_000_000_000_000n,
        dailyLimit: 10_000_000_000_000n,
        monthlyLimit: 100_000_000_000_000n,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'],
        availableCountries: ['*'], // Global
        restrictedCountries: ['KP', 'IR', 'SY', 'CU'],
        status: RailStatus.ACTIVE,
      },

      // Visa Card
      {
        railType: PaymentRailType.VISA,
        provider: 'Stripe',
        isEnabled: true,
        priority: 5,
        fixedFee: 30n, // $0.30
        percentageFee: 0.029, // 2.9%
        minFee: 30n,
        maxFee: 100_000n,
        averageSettlementTime: SettlementSpeed.INSTANT,
        minAmount: 50n,
        maxAmount: 100_000_000n, // $1M per transaction
        dailyLimit: 1_000_000_000n,
        monthlyLimit: 10_000_000_000n,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        availableCountries: ['*'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // Mastercard
      {
        railType: PaymentRailType.MASTERCARD,
        provider: 'Stripe',
        isEnabled: true,
        priority: 6,
        fixedFee: 30n,
        percentageFee: 0.029,
        minFee: 30n,
        maxFee: 100_000n,
        averageSettlementTime: SettlementSpeed.INSTANT,
        minAmount: 50n,
        maxAmount: 100_000_000n,
        dailyLimit: 1_000_000_000n,
        monthlyLimit: 10_000_000_000n,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        availableCountries: ['*'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // USDC Stablecoin
      {
        railType: PaymentRailType.STABLECOIN_USDC,
        provider: 'Chain',
        isEnabled: true,
        priority: 3,
        fixedFee: 1n, // Network gas
        percentageFee: 0.001, // 0.1%
        minFee: 1n,
        maxFee: 100n,
        averageSettlementTime: SettlementSpeed.REAL_TIME,
        minAmount: 1n,
        maxAmount: 100_000_000_000n, // $100M
        dailyLimit: 1_000_000_000_000n,
        monthlyLimit: 10_000_000_000_000n,
        supportedCurrencies: ['USDC', 'USD'],
        availableCountries: ['*'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },

      // USDT Stablecoin
      {
        railType: PaymentRailType.STABLECOIN_USDT,
        provider: 'Chain',
        isEnabled: true,
        priority: 4,
        fixedFee: 1n,
        percentageFee: 0.001,
        minFee: 1n,
        maxFee: 100n,
        averageSettlementTime: SettlementSpeed.REAL_TIME,
        minAmount: 1n,
        maxAmount: 100_000_000_000n,
        dailyLimit: 1_000_000_000_000n,
        monthlyLimit: 10_000_000_000_000n,
        supportedCurrencies: ['USDT', 'USD'],
        availableCountries: ['*'],
        restrictedCountries: [],
        status: RailStatus.ACTIVE,
      },
    ];

    for (const rail of defaultRails) {
      const key = this.generateRailKey(rail.railType, rail.provider);
      this.railConfigs.set(key, rail);
      
      // Initialize capacity tracking
      this.initializeCapacity(rail);
    }

    this.logger.log(`Initialized ${defaultRails.length} payment rails`);
  }

  /**
   * Get all available rails
   */
  getAllRails(): PaymentRailConfig[] {
    return Array.from(this.railConfigs.values()).filter(rail => rail.isEnabled);
  }

  /**
   * Get rail by type and provider
   */
  getRail(railType: PaymentRailType, provider: string): PaymentRailConfig | null {
    const key = this.generateRailKey(railType, provider);
    return this.railConfigs.get(key) || null;
  }

  /**
   * Get rails supporting specific currency
   */
  getRailsForCurrency(currency: string): PaymentRailConfig[] {
    return this.getAllRails().filter(rail => 
      rail.supportedCurrencies.includes(currency) || rail.supportedCurrencies.includes('*'),
    );
  }

  /**
   * Get rails available for country
   */
  getRailsForCountry(country: string): PaymentRailConfig[] {
    return this.getAllRails().filter(rail => {
      if (rail.restrictedCountries.includes(country)) {
        return false;
      }
      return rail.availableCountries.includes('*') || rail.availableCountries.includes(country);
    });
  }

  /**
   * Update rail status
   */
  updateRailStatus(railType: PaymentRailType, provider: string, status: RailStatus): void {
    const rail = this.getRail(railType, provider);
    if (rail) {
      rail.status = status;
      this.logger.log(`Updated rail ${railType}/${provider} status to ${status}`);
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(metrics: RailPerformanceMetrics): void {
    const key = this.generateRailKey(metrics.railType, metrics.provider);
    this.performanceMetrics.set(key, metrics);
  }

  /**
   * Get current performance metrics for a rail
   */
  getPerformanceMetrics(railType: PaymentRailType, provider: string): RailPerformanceMetrics | null {
    const key = this.generateRailKey(railType, provider);
    return this.performanceMetrics.get(key) || null;
  }

  /**
   * Check rail capacity
   */
  checkCapacity(railType: PaymentRailType, provider: string, amount: bigint): boolean {
    const key = this.generateRailKey(railType, provider);
    const capacity = this.railCapacities.get(key);
    
    if (!capacity) {
      return true; // No capacity data, assume available
    }

    return capacity.isAvailable && 
           amount <= capacity.dailyVolumeRemaining &&
           amount <= capacity.monthlyVolumeRemaining;
  }

  /**
   * Update capacity after transaction
   */
  updateCapacity(railType: PaymentRailType, provider: string, amount: bigint): void {
    const key = this.generateRailKey(railType, provider);
    const capacity = this.railCapacities.get(key);
    
    if (capacity) {
      capacity.dailyVolumeUsed += amount;
      capacity.dailyVolumeRemaining -= amount;
      capacity.monthlyVolumeUsed += amount;
      capacity.monthlyVolumeRemaining -= amount;
      capacity.capacityUtilization = Number(capacity.dailyVolumeUsed) / Number(capacity.dailyLimit) * 100;
      
      // Mark as unavailable if over limit
      capacity.isAvailable = capacity.dailyVolumeRemaining > 0n && capacity.monthlyVolumeRemaining > 0n;
    }
  }

  /**
   * Calculate effective fee for a transaction
   */
  calculateFee(rail: PaymentRailConfig, amount: bigint, currency: string): bigint {
    // Convert amount if needed (simplified)
    let effectiveAmount = amount;
    
    // Calculate percentage fee
    const percentageFee = (effectiveAmount * BigInt(Math.round(rail.percentageFee * 1000))) / 1000n;
    
    // Total fee = fixed + percentage
    let totalFee = rail.fixedFee + percentageFee;
    
    // Apply min/max constraints
    if (totalFee < rail.minFee) {
      totalFee = rail.minFee;
    } else if (totalFee > rail.maxFee) {
      totalFee = rail.maxFee;
    }
    
    return totalFee;
  }

  /**
   * Estimate settlement time
   */
  estimateSettlementTime(rail: PaymentRailConfig): {
    expected: SettlementSpeed;
    estimatedMinutes: number;
  } {
    const timeMap: Record<SettlementSpeed, number> = {
      [SettlementSpeed.INSTANT]: 1,
      [SettlementSpeed.REAL_TIME]: 30,
      [SettlementSpeed.SAME_DAY]: 240, // 4 hours
      [SettlementSpeed.NEXT_DAY]: 1440, // 24 hours
      [SettlementSpeed.STANDARD]: 4320, // 3 days
      [SettlementSpeed.SLOW]: 10080, // 7 days
    };

    return {
      expected: rail.averageSettlementTime,
      estimatedMinutes: timeMap[rail.averageSettlementTime],
    };
  }

  /**
   * Initialize capacity tracking for a rail
   */
  private initializeCapacity(rail: PaymentRailConfig): void {
    const key = this.generateRailKey(rail.railType, rail.provider);
    
    this.railCapacities.set(key, {
      railType: rail.railType,
      provider: rail.provider,
      dailyVolumeUsed: 0n,
      dailyVolumeRemaining: rail.dailyLimit,
      monthlyVolumeUsed: 0n,
      monthlyVolumeRemaining: rail.monthlyLimit,
      dailyTransactionsUsed: 0,
      dailyTransactionsRemaining: 10000, // Assumed limit
      dailyLimit: rail.dailyLimit,
      monthlyLimit: rail.monthlyLimit,
      isAvailable: true,
      capacityUtilization: 0,
      lastUpdated: new Date(),
    });
  }

  /**
   * Generate unique rail key
   */
  private generateRailKey(railType: PaymentRailType, provider: string): string {
    return `${railType}_${provider}`;
  }
}
