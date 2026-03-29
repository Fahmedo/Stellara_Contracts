import { Injectable, Logger } from '@nestjs/common';
import { FXRate } from '../types/payment-routing.types';

/**
 * FX Rate Service
 * Provides real-time foreign exchange rate comparison across providers
 */
@Injectable()
export class FXRateService {
  private readonly logger = new Logger(FXRateService.name);

  // In-memory cache of FX rates (in production, use Redis)
  private fxRates = new Map<string, FXRate>();

  // FX providers
  private readonly providers = [
    'Wise',
    'XE',
    'OANDA',
    'Fixer.io',
    'CurrencyLayer',
  ];

  constructor() {
    // Initialize with some default rates
    this.initializeDefaultRates();
    
    // Refresh rates every minute
    setInterval(() => this.refreshRates(), 60_000);
  }

  /**
   * Initialize default FX rates (mock data)
   */
  private initializeDefaultRates(): void {
    const defaultRates: Array<[string, number]> = [
      ['EUR/USD', 1.0850],
      ['GBP/USD', 1.2650],
      ['USD/JPY', 149.50],
      ['USD/CHF', 0.8850],
      ['AUD/USD', 0.6550],
      ['USD/CAD', 1.3550],
      ['NZD/USD', 0.6150],
      ['EUR/GBP', 0.8580],
      ['EUR/JPY', 162.20],
      ['GBP/JPY', 189.10],
    ];

    const now = new Date();
    const validUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    for (const [pair, rate] of defaultRates) {
      const [from, to] = pair.split('/');
      this.setRate(from, to, rate, 'Market', now, validUntil);
    }

    this.logger.log(`Initialized ${defaultRates.length} default FX rates`);
  }

  /**
   * Get best FX rate for currency pair
   */
  getBestRate(fromCurrency: string, toCurrency: string): FXRate | null {
    if (fromCurrency === toCurrency) {
      return this.createSameCurrencyRate(fromCurrency);
    }

    const key = this.getRateKey(fromCurrency, toCurrency);
    let rate = this.fxRates.get(key);

    // Try inverse if direct rate not available
    if (!rate) {
      const inverseKey = this.getRateKey(toCurrency, fromCurrency);
      const inverseRate = this.fxRates.get(inverseKey);
      
      if (inverseRate) {
        rate = this.createInverseRate(inverseRate);
      }
    }

    return rate || null;
  }

  /**
   * Convert amount using current FX rate
   */
  convertAmount(
    amount: bigint,
    fromCurrency: string,
    toCurrency: string,
  ): { convertedAmount: bigint; rate: FXRate; fee: bigint } {
    const rate = this.getBestRate(fromCurrency, toCurrency);
    
    if (!rate) {
      throw new Error(`No FX rate available for ${fromCurrency}/${toCurrency}`);
    }

    // Calculate conversion
    const convertedNumber = Number(amount) * rate.rate;
    const convertedAmount = BigInt(Math.round(convertedNumber));

    // FX fee (spread) - typically 0.5-2%
    const feePercentage = rate.spread || 0.01; // Default 1%
    const fee = BigInt(Math.round(Number(convertedAmount) * feePercentage));

    return {
      convertedAmount: convertedAmount - fee,
      rate,
      fee,
    };
  }

  /**
   * Compare rates across multiple providers
   */
  compareRates(fromCurrency: string, toCurrency: string): Array<{
    provider: string;
    rate: number;
    spread: number;
    effectiveRate: number;
  }> {
    const comparisons: Array<{
      provider: string;
      rate: number;
      spread: number;
      effectiveRate: number;
    }> = [];

    // In production, fetch from all providers
    // For now, simulate with slight variations
    const baseRate = this.getBestRate(fromCurrency, toCurrency);
    
    if (!baseRate) {
      return [];
    }

    for (const provider of this.providers) {
      // Simulate provider variation (±0.5%)
      const variation = (Math.random() - 0.5) * 0.01;
      const providerRate = baseRate.rate * (1 + variation);
      const providerSpread = baseRate.spread + (Math.random() * 0.005);

      comparisons.push({
        provider,
        rate: providerRate,
        spread: providerSpread,
        effectiveRate: providerRate * (1 - providerSpread),
      });
    }

    // Sort by effective rate (best first)
    return comparisons.sort((a, b) => b.effectiveRate - a.effectiveRate);
  }

  /**
   * Update FX rate from provider
   */
  updateRate(params: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    provider: string;
    spread?: number;
  }): FXRate {
    const { fromCurrency, toCurrency, rate, provider, spread } = params;
    
    const now = new Date();
    const validUntil = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    return this.setRate(fromCurrency, toCurrency, rate, provider, now, validUntil, spread);
  }

  /**
   * Get historical rate trend (simplified)
   */
  getRateTrend(fromCurrency: string, toCurrency: string, days: number): {
    averageRate: number;
    highRate: number;
    lowRate: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  } {
    // In production, query historical database
    // For now, return mock data
    const currentRate = this.getBestRate(fromCurrency, toCurrency);
    
    if (!currentRate) {
      return {
        averageRate: 0,
        highRate: 0,
        lowRate: 0,
        trend: 'STABLE',
      };
    }

    const volatility = 0.02; // 2% volatility
    const avgRate = currentRate.rate;
    
    return {
      averageRate: avgRate,
      highRate: avgRate * (1 + volatility),
      lowRate: avgRate * (1 - volatility),
      trend: 'STABLE',
    };
  }

  /**
   * Check if rate is favorable compared to historical average
   */
  isFavorableRate(
    fromCurrency: string,
    toCurrency: string,
    threshold: number = 0.01, // 1% threshold
  ): boolean {
    const currentRate = this.getBestRate(fromCurrency, toCurrency);
    if (!currentRate) return false;

    const trend = this.getRateTrend(fromCurrency, toCurrency, 7);
    const deviation = Math.abs(currentRate.rate - trend.averageRate) / trend.averageRate;

    return deviation <= threshold;
  }

  /**
   * Refresh all rates (called periodically)
   */
  private refreshRates(): void {
    this.logger.debug('Refreshing FX rates...');
    // In production, call external APIs here
    
    // Update timestamp on existing rates
    const now = new Date();
    const validUntil = new Date(now.getTime() + 5 * 60 * 1000);

    for (const [key, rate] of this.fxRates.entries()) {
      rate.timestamp = now;
      rate.validUntil = validUntil;
      this.fxRates.set(key, rate);
    }
  }

  /**
   * Set or update a rate
   */
  private setRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    provider: string,
    timestamp: Date,
    validUntil: Date,
    spread: number = 0.01,
  ): FXRate {
    const inverseRate = 1 / rate;
    
    const fxRate: FXRate = {
      fromCurrency,
      toCurrency,
      rate,
      inverseRate,
      spread,
      provider,
      timestamp,
      validUntil,
    };

    const key = this.getRateKey(fromCurrency, toCurrency);
    this.fxRates.set(key, fxRate);

    return fxRate;
  }

  /**
   * Create inverse rate from existing rate
   */
  private createInverseRate(originalRate: FXRate): FXRate {
    return {
      fromCurrency: originalRate.toCurrency,
      toCurrency: originalRate.fromCurrency,
      rate: originalRate.inverseRate,
      inverseRate: originalRate.rate,
      spread: originalRate.spread,
      provider: originalRate.provider,
      timestamp: originalRate.timestamp,
      validUntil: originalRate.validUntil,
    };
  }

  /**
   * Create same-currency "rate"
   */
  private createSameCurrencyRate(currency: string): FXRate {
    const now = new Date();
    return {
      fromCurrency: currency,
      toCurrency: currency,
      rate: 1.0,
      inverseRate: 1.0,
      spread: 0,
      provider: 'System',
      timestamp: now,
      validUntil: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
    };
  }

  /**
   * Generate rate cache key
   */
  private getRateKey(fromCurrency: string, toCurrency: string): string {
    return `${fromCurrency}/${toCurrency}`;
  }
}
