import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentRoutingRequest,
  RoutingDecision,
  PaymentExecutionResult,
  UserPreferenceWeights,
} from '../types/payment-routing.types';
import { PaymentRoutingEngine } from './payment-routing-engine.service';
import { FallbackRoutingService } from './fallback-routing.service';
import { AuditTrailService } from './audit-trail.service';
import { FXRateService } from './fx-rate.service';

/**
 * Payment Routing Service
 * Main orchestrator for intelligent payment routing
 */
@Injectable()
export class PaymentRoutingService {
  private readonly logger = new Logger(PaymentRoutingService.name);

  constructor(
    private routingEngine: PaymentRoutingEngine,
    private fallbackService: FallbackRoutingService,
    private auditTrail: AuditTrailService,
    private fxService: FXRateService,
  ) {}

  /**
   * Route payment to optimal rail
   */
  async routePayment(request: PaymentRoutingRequest): Promise<RoutingDecision> {
    this.logger.log(
      `Routing payment: ${request.amount} ${request.currency} to ${request.recipientCountry}`,
    );

    // Validate request
    this.validateRequest(request);

    // Handle cross-border FX if needed
    if (request.recipientCurrency && request.recipientCurrency !== request.currency) {
      const fxQuote = this.fxService.convertAmount(
        request.amount,
        request.currency,
        request.recipientCurrency,
      );
      
      this.logger.log(
        `FX Conversion: ${request.amount} ${request.currency} -> ${fxQuote.convertedAmount} ${request.recipientCurrency}`,
      );
    }

    // Find optimal rail
    const decision = await this.routingEngine.findOptimalRail(request);

    // Log decision (execution will be logged after payment)
    this.logger.log(
      `Selected: ${decision.selectedRail.railType}/${decision.selectedRail.provider} ` +
      `(Success: ${(decision.predictedSuccessRate * 100).toFixed(1)}%)`,
    );

    return decision;
  }

  /**
   * Execute payment with automatic fallback
   */
  async executePayment(
    decision: RoutingDecision,
    executeOnRail: (railType: string, provider: string) => Promise<PaymentExecutionResult>,
  ): Promise<PaymentExecutionResult> {
    this.logger.log(`Executing payment via ${decision.selectedRail.railType}`);

    try {
      // Execute with fallback logic
      const result = await this.fallbackService.executeWithFallback(decision, async (rail) => {
        return await executeOnRail(rail.railType, rail.provider);
      });

      // Log to audit trail
      await this.auditTrail.logDecision(
        this.reconstructRequest(decision),
        decision,
        result,
      );

      if (!result.success) {
        this.logger.error(
          `Payment failed after ${result.retryAttempts} retries: ${result.statusMessage}`,
        );
      } else {
        this.logger.log(
          `Payment successful: ${result.transactionId} via ${result.railType}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Payment execution error', error);
      throw error;
    }
  }

  /**
   * Quick payment (route + execute in one call)
   */
  async quickPayment(
    request: PaymentRoutingRequest,
    executeOnRail: (railType: string, provider: string) => Promise<PaymentExecutionResult>,
  ): Promise<{ decision: RoutingDecision; execution: PaymentExecutionResult }> {
    this.logger.log('Processing quick payment (route + execute)');

    // Route
    const decision = await this.routePayment(request);

    // Execute
    const execution = await this.executePayment(decision, executeOnRail);

    return { decision, execution };
  }

  /**
   * Get available rails for a currency/country pair
   */
  getAvailableRails(currency: string, country: string): Array<{
    railType: string;
    provider: string;
    estimatedFee: bigint;
    settlementTime: string;
    successRate: number;
  }> {
    // This would integrate with PaymentRailProviderService
    // For now, return mock data
    return [
      {
        railType: 'VISA',
        provider: 'Stripe',
        estimatedFee: 329n, // $3.29 on $100
        settlementTime: 'Instant',
        successRate: 98.5,
      },
      {
        railType: 'ACH',
        provider: 'Plaid',
        estimatedFee: 130n, // $1.30 on $100
        settlementTime: '3-5 days',
        successRate: 96.2,
      },
      {
        railType: 'STABLECOIN_USDC',
        provider: 'Chain',
        estimatedFee: 11n, // $0.11 on $100
        settlementTime: '< 1 hour',
        successRate: 99.8,
      },
    ];
  }

  /**
   * Update user preference weights
   */
  updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferenceWeights>,
  ): UserPreferenceWeights {
    // In production, save to database
    this.logger.log(`Updated preferences for user ${userId}`);
    
    return {
      costWeight: preferences.costWeight ?? 0.4,
      speedWeight: preferences.speedWeight ?? 0.3,
      reliabilityWeight: preferences.reliabilityWeight ?? 0.3,
      privacyWeight: preferences.privacyWeight ?? 0.0,
    };
  }

  /**
   * Get routing analytics
   */
  getAnalytics(startDate: Date, endDate: Date): {
    totalPayments: number;
    totalVolume: bigint;
    avgFee: bigint;
    successRate: number;
    topRail: string;
    savingsVsBaseline: bigint;
  } {
    const report = this.auditTrail.generateComplianceReport(startDate, endDate);
    
    return {
      totalPayments: report.totalTransactions,
      totalVolume: report.totalVolume,
      avgFee: 0n, // Would calculate from detailed data
      successRate: ((report.totalTransactions - report.failedTransactions) / report.totalTransactions) * 100,
      topRail: report.railsUsed[0]?.railType || 'N/A',
      savingsVsBaseline: 0n, // Would calculate optimization savings
    };
  }

  /**
   * Manual retry of failed payment
   */
  async retryPayment(
    originalDecisionId: string,
    preferredRail?: string,
    executeOnRail?: (railType: string, provider: string) => Promise<PaymentExecutionResult>,
  ): Promise<PaymentExecutionResult> {
    const history = this.auditTrail.getDecision(originalDecisionId);
    
    if (!history) {
      throw new Error(`Decision ${originalDecisionId} not found`);
    }

    if (!executeOnRail) {
      throw new Error('Execution function required for retry');
    }

    this.logger.log(`Retrying payment ${originalDecisionId}, preferred: ${preferredRail || 'auto'}`);

    // Use fallback service to retry
    return await this.fallbackService.manualRetry(
      history.decision,
      async (rail) => await executeOnRail(rail.railType, rail.provider),
      preferredRail as any,
    );
  }

  /**
   * Validate routing request
   */
  private validateRequest(request: PaymentRoutingRequest): void {
    if (request.amount <= 0n) {
      throw new Error('Amount must be positive');
    }

    if (!request.currency) {
      throw new Error('Currency is required');
    }

    if (!request.recipientCountry) {
      throw new Error('Recipient country is required');
    }

    // Check for suspicious patterns
    if (Number(request.amount) > 1_000_000_000_000n) { // > $10B
      this.logger.warn(`Unusually large amount: ${request.amount}`);
    }
  }

  /**
   * Reconstruct request from decision (for audit logging)
   */
  private reconstructRequest(decision: RoutingDecision): PaymentRoutingRequest {
    // Simplified reconstruction
    return {
      userId: 'unknown',
      amount: 0n,
      currency: '',
      recipientCountry: '',
    };
  }
}
