import { Injectable, Logger } from '@nestjs/common';
import {
  RoutingDecision,
  PaymentExecutionResult,
  PaymentRailConfig,
  PaymentRailType,
} from '../types/payment-routing.types';
import { PaymentRoutingEngine } from './payment-routing-engine.service';

/**
 * Fallback Routing Service
 * Handles automatic retry logic with alternative rails on failure
 */
@Injectable()
export class FallbackRoutingService {
  private readonly logger = new Logger(FallbackRoutingService.name);

  // Retry configuration
  private readonly maxRetryAttempts = 3;
  private readonly retryDelayMs = 5000; // 5 seconds between retries
  
  // Failure tracking for circuit breaker pattern
  private failureCounts = new Map<string, number>();
  private lastFailureTime = new Map<string, Date>();

  constructor(
    private routingEngine: PaymentRoutingEngine,
  ) {}

  /**
   * Execute payment with automatic fallback
   */
  async executeWithFallback(
    decision: RoutingDecision,
    executePayment: (rail: PaymentRailConfig) => Promise<PaymentExecutionResult>,
  ): Promise<PaymentExecutionResult> {
    const attemptedRails: PaymentRailType[] = [];
    let lastError: Error | null = null;

    // Try primary rail first
    const result = await this.tryRail(
      decision.selectedRail,
      attemptedRails,
      executePayment,
      decision.decisionId,
    );

    if (result.success) {
      return result;
    }

    lastError = new Error(result.statusMessage || 'Primary rail failed');
    this.logger.warn(
      `Primary rail ${decision.selectedRail.railType}/${decision.selectedRail.provider} failed: ${result.statusMessage}`,
    );

    // Try alternatives in order of score
    for (const alternative of decision.alternatives) {
      if (attemptedRails.includes(alternative.rail.railType)) {
        continue; // Already tried
      }

      this.logger.log(`Attempting fallback to ${alternative.rail.railType}/${alternative.rail.provider}`);
      
      const fallbackResult = await this.tryRail(
        alternative.rail,
        attemptedRails,
        executePayment,
        decision.decisionId,
      );

      if (fallbackResult.success) {
        this.logger.log(
          `Fallback successful: ${alternative.rail.railType}/${alternative.rail.provider}`,
        );
        return fallbackResult;
      }

      lastError = new Error(fallbackResult.statusMessage || 'Fallback rail failed');
    }

    // All rails failed
    this.logger.error('All payment rails failed', lastError);
    
    return {
      success: false,
      railType: decision.selectedRail.railType,
      provider: decision.selectedRail.provider,
      transactionId: '',
      amount: 0n,
      fee: 0n,
      currency: '',
      initiatedAt: new Date(),
      expectedSettlement: new Date(),
      status: 'FAILED',
      statusMessage: `All ${attemptedRails.length} payment rails failed. Last error: ${lastError.message}`,
      retryable: false,
      retryAttempts: attemptedRails.length,
      routingDecisionId: decision.decisionId,
      executedBy: 'system',
    };
  }

  /**
   * Try a specific rail with circuit breaker check
   */
  private async tryRail(
    rail: PaymentRailConfig,
    attemptedRails: PaymentRailType[],
    executePayment: (rail: PaymentRailConfig) => Promise<PaymentExecutionResult>,
    decisionId: string,
  ): Promise<PaymentExecutionResult> {
    attemptedRails.push(rail.railType);

    // Check circuit breaker
    if (this.isCircuitOpen(rail)) {
      this.logger.warn(`Circuit breaker open for ${rail.railType}/${rail.provider}, skipping`);
      
      return {
        success: false,
        railType: rail.railType,
        provider: rail.provider,
        transactionId: '',
        amount: 0n,
        fee: 0n,
        currency: '',
        initiatedAt: new Date(),
        expectedSettlement: new Date(),
        status: 'FAILED',
        statusMessage: 'Circuit breaker open - too many failures',
        retryable: false,
        retryAttempts: 0,
        routingDecisionId: decisionId,
        executedBy: 'system',
      };
    }

    try {
      // Add small delay before retry (not for first attempt)
      if (attemptedRails.length > 1) {
        await this.delay(this.retryDelayMs);
      }

      const result = await executePayment(rail);
      
      // Update failure tracking
      if (result.success) {
        this.resetFailureCount(rail);
      } else {
        this.recordFailure(rail);
      }

      result.retryAttempts = attemptedRails.length - 1;
      return result;
    } catch (error) {
      this.recordFailure(rail);
      throw error;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(rail: PaymentRailConfig): void {
    const key = this.getRailKey(rail);
    const count = this.failureCounts.get(key) || 0;
    this.failureCounts.set(key, count + 1);
    this.lastFailureTime.set(key, new Date());
    
    this.logger.warn(
      `Recorded failure for ${key}, total: ${count + 1}`,
    );
  }

  /**
   * Reset failure count after success
   */
  private resetFailureCount(rail: PaymentRailConfig): void {
    const key = this.getRailKey(rail);
    this.failureCounts.delete(key);
    this.lastFailureTime.delete(key);
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(rail: PaymentRailConfig): boolean {
    const key = this.getRailKey(rail);
    const failureCount = this.failureCounts.get(key) || 0;
    const lastFailure = this.lastFailureTime.get(key);

    // Circuit opens after 5 consecutive failures
    if (failureCount >= 5) {
      // Check if enough time has passed to try again (5 minutes)
      if (lastFailure) {
        const timeSinceLastFailure = Date.now() - lastFailure.getTime();
        if (timeSinceLastFailure < 5 * 60 * 1000) { // 5 minutes
          return true;
        }
      }
      
      // Reset after timeout
      this.failureCounts.set(key, 0);
    }

    return false;
  }

  /**
   * Get unique rail key
   */
  private getRailKey(rail: PaymentRailConfig): string {
    return `${rail.railType}_${rail.provider}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual retry endpoint (for user-initiated retries)
   */
  async manualRetry(
    originalDecision: RoutingDecision,
    executePayment: (rail: PaymentRailConfig) => Promise<PaymentExecutionResult>,
    preferredRail?: PaymentRailType,
  ): Promise<PaymentExecutionResult> {
    this.logger.log(`Manual retry requested, preferred rail: ${preferredRail || 'none'}`);

    // If preferred rail specified, use it
    if (preferredRail) {
      const preferredRailConfig = originalDecision.alternatives.find(
        alt => alt.rail.railType === preferredRail,
      );

      if (preferredRailConfig) {
        return await this.tryRail(
          preferredRailConfig.rail,
          [originalDecision.selectedRail.railType],
          executePayment,
          originalDecision.decisionId,
        );
      }
    }

    // Otherwise, use best alternative
    const bestAlternative = originalDecision.alternatives[0];
    if (!bestAlternative) {
      throw new Error('No alternatives available for retry');
    }

    return await this.tryRail(
      bestAlternative.rail,
      [originalDecision.selectedRail.railType],
      executePayment,
      originalDecision.decisionId,
    );
  }
}
