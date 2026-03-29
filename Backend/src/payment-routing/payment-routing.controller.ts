import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { PaymentRoutingService } from './services/payment-routing.service';
import {
  PaymentRoutingRequest,
  OptimizationObjective,
  UserPreferenceWeights,
} from '../types/payment-routing.types';

/**
 * Payment Routing Controller
 * REST API for intelligent payment routing
 */
@Controller('api/payments')
export class PaymentRoutingController {
  private readonly logger = new Logger(PaymentRoutingController.name);

  constructor(
    private paymentRoutingService: PaymentRoutingService,
  ) {}

  /**
   * Get optimal payment rail for a transaction
   */
  @Post('route')
  async routePayment(@Body() request: PaymentRoutingRequest) {
    this.logger.log(`Routing request: ${request.amount} ${request.currency}`);
    
    const decision = await this.paymentRoutingService.routePayment(request);
    
    return {
      success: true,
      data: {
        selectedRail: {
          type: decision.selectedRail.railType,
          provider: decision.selectedRail.provider,
        },
        predictedSuccessRate: decision.predictedSuccessRate,
        estimatedCost: decision.estimatedCost.toString(),
        estimatedSettlementTime: decision.estimatedSettlementTime,
        reasoning: decision.reasoning,
        alternatives: decision.alternatives.map(alt => ({
          rail: `${alt.rail.railType}/${alt.rail.provider}`,
          score: alt.score,
          reason: alt.reason,
        })),
      },
    };
  }

  /**
   * Execute payment with intelligent routing
   */
  @Post('execute')
  async executePayment(
    @Body() request: PaymentRoutingRequest,
    // In production, would have execution logic here
  ) {
    this.logger.log(`Executing payment: ${request.amount} ${request.currency}`);
    
    // Route and execute (mock execution for now)
    const decision = await this.paymentRoutingService.routePayment(request);
    
    // Mock execution - in production, would call actual payment providers
    const mockExecution = {
      success: true,
      transactionId: `txn_${Date.now()}`,
      railType: decision.selectedRail.railType,
      provider: decision.selectedRail.provider,
      amount: request.amount,
      fee: decision.estimatedCost,
      status: 'PROCESSING',
      expectedSettlement: new Date(Date.now() + 3600000), // 1 hour
    };

    return {
      success: true,
      data: mockExecution,
    };
  }

  /**
   * Get available payment rails
   */
  @Get('rails')
  getAvailableRails(
    @Query('currency') currency?: string,
    @Query('country') country?: string,
  ) {
    const rails = this.paymentRoutingService.getAvailableRails(
      currency || 'USD',
      country || 'US',
    );

    return {
      success: true,
      data: rails,
    };
  }

  /**
   * Update user preferences
   */
  @Post('preferences/:userId')
  updatePreferences(
    @Param('userId') userId: string,
    @Body() preferences: Partial<UserPreferenceWeights>,
  ) {
    const updated = this.paymentRoutingService.updateUserPreferences(
      userId,
      preferences,
    );

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Get payment analytics
   */
  @Get('analytics')
  getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = this.paymentRoutingService.getAnalytics(start, end);

    return {
      success: true,
      data: analytics,
    };
  }

  /**
   * Retry failed payment
   */
  @Post('retry/:decisionId')
  async retryPayment(
    @Param('decisionId') decisionId: string,
    @Query('rail') preferredRail?: string,
  ) {
    this.logger.log(`Retrying payment ${decisionId}, preferred: ${preferredRail}`);

    const result = await this.paymentRoutingService.retryPayment(
      decisionId,
      preferredRail,
    );

    return {
      success: result.success,
      data: result,
    };
  }

  /**
   * Get FX rate for currency pair
   */
  @Get('fx/:from/:to')
  getFXRate(
    @Param('from') from: string,
    @Param('to') to: string,
  ) {
    // Would integrate with FX service
    return {
      success: true,
      data: {
        fromCurrency: from,
        toCurrency: to,
        rate: from === to ? 1.0 : 1.0850, // Mock rate
        spread: 0.01,
        provider: 'Market',
      },
    };
  }

  /**
   * Compare FX rates across providers
   */
  @Get('fx/compare/:from/:to')
  compareFXRates(
    @Param('from') from: string,
    @Param('to') to: string,
  ) {
    // Would integrate with FX service
    return {
      success: true,
      data: [
        { provider: 'Wise', rate: 1.0850, spread: 0.005 },
        { provider: 'XE', rate: 1.0845, spread: 0.008 },
        { provider: 'OANDA', rate: 1.0840, spread: 0.010 },
      ],
    };
  }
}
