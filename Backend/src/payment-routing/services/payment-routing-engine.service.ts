import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentRoutingRequest,
  RoutingDecision,
  OptimizationObjective,
  UserPreferenceWeights,
  PaymentRailConfig,
  SuccessPrediction,
  PaymentRailType,
  SettlementSpeed,
} from '../types/payment-routing.types';
import { PaymentRailProviderService } from './payment-rail-provider.service';

/**
 * Intelligent Payment Routing Engine
 * Core decision-making service that selects optimal payment rails
 */
@Injectable()
export class PaymentRoutingEngine {
  private readonly logger = new Logger(PaymentRoutingEngine.name);

  // Default user preference weights
  private readonly defaultWeights: UserPreferenceWeights = {
    costWeight: 0.4,
    speedWeight: 0.3,
    reliabilityWeight: 0.3,
    privacyWeight: 0.0,
  };

  constructor(
    private railProvider: PaymentRailProviderService,
  ) {}

  /**
   * Find optimal payment rail for a transaction
   */
  async findOptimalRail(request: PaymentRoutingRequest): Promise<RoutingDecision> {
    this.logger.log(
      `Finding optimal rail for ${request.amount} ${request.currency} to ${request.recipientCountry}`,
    );

    // Step 1: Filter eligible rails
    const eligibleRails = this.filterEligibleRails(request);

    if (eligibleRails.length === 0) {
      throw new Error('No eligible payment rails found for this transaction');
    }

    // Step 2: Score each rail based on optimization objective
    const scoredRails = await this.scoreRails(eligibleRails, request);

    // Step 3: Select best rail
    const bestRail = scoredRails[0];

    // Step 4: Generate decision with alternatives
    const decision = this.generateRoutingDecision(bestRail, scoredRails, request);

    this.logger.log(
      `Selected rail: ${decision.selectedRail.railType}/${decision.selectedRail.provider} ` +
      `(Success: ${(decision.predictedSuccessRate * 100).toFixed(1)}%, Cost: ${decision.estimatedCost})`,
    );

    return decision;
  }

  /**
   * Filter rails based on constraints
   */
  private filterEligibleRails(request: PaymentRoutingRequest): PaymentRailConfig[] {
    let rails = this.railProvider.getAllRails();

    // Filter by currency support
    rails = rails.filter(rail => 
      rail.supportedCurrencies.includes(request.currency) ||
      rail.supportedCurrencies.includes('*'),
    );

    // Filter by country availability
    rails = rails.filter(rail => 
      !rail.restrictedCountries.includes(request.recipientCountry) &&
      (rail.availableCountries.includes('*') || rail.availableCountries.includes(request.recipientCountry)),
    );

    // Filter by amount limits
    rails = rails.filter(rail => 
      request.amount >= rail.minAmount &&
      request.amount <= rail.maxAmount,
    );

    // Apply user preferences
    if (request.preferredRails && request.preferredRails.length > 0) {
      rails = rails.filter(rail => request.preferredRails!.includes(rail.railType));
    }

    if (request.excludedRails && request.excludedRails.length > 0) {
      rails = rails.filter(rail => !request.excludedRails!.includes(rail.railType));
    }

    // Filter by max settlement time
    if (request.maxSettlementTime) {
      const maxTimeRank = this.getSpeedRank(request.maxSettlementTime);
      rails = rails.filter(rail => this.getSpeedRank(rail.averageSettlementTime) <= maxTimeRank);
    }

    // Filter by max fee
    if (request.maxFee) {
      rails = rails.filter(rail => {
        const estimatedFee = this.railProvider.calculateFee(rail, request.amount, request.currency);
        return estimatedFee <= request.maxFee;
      });
    }

    // Only include active rails
    rails = rails.filter(rail => rail.status === 'ACTIVE');

    return rails;
  }

  /**
   * Score and rank rails based on multiple factors
   */
  private async scoreRails(
    rails: PaymentRailConfig[],
    request: PaymentRoutingRequest,
  ): Promise<Array<{ rail: PaymentRailConfig; score: number; reasons: string[] }>> {
    const userWeights = {
      ...this.defaultWeights,
      ...request.userPreferences,
    };

    const scoredRails: Array<{ rail: PaymentRailConfig; score: number; reasons: string[] }> = [];

    for (const rail of rails) {
      const reasons: string[] = [];
      
      // Calculate individual scores
      const costScore = await this.calculateCostScore(rail, request);
      const speedScore = this.calculateSpeedScore(rail, request);
      const reliabilityScore = await this.calculateReliabilityScore(rail, request);
      
      // Weighted total score
      const totalScore = 
        costScore * userWeights.costWeight +
        speedScore * userWeights.speedWeight +
        reliabilityScore * userWeights.reliabilityWeight;

      reasons.push(`Cost: ${(costScore * 100).toFixed(0)}/100`);
      reasons.push(`Speed: ${(speedScore * 100).toFixed(0)}/100`);
      reasons.push(`Reliability: ${(reliabilityScore * 100).toFixed(0)}/100`);

      scoredRails.push({
        rail,
        score: totalScore,
        reasons,
      });
    }

    // Sort by score (descending)
    return scoredRails.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate cost score (0-1)
   */
  private async calculateCostScore(
    rail: PaymentRailConfig,
    request: PaymentRoutingRequest,
  ): Promise<number> {
    const fee = this.railProvider.calculateFee(rail, request.amount, request.currency);
    
    // Normalize fee as percentage of amount
    const feePercentage = Number(fee) / Number(request.amount) * 100;
    
    // Score: lower fee = higher score
    // Assume max acceptable fee is 5%
    const maxAcceptableFee = 5.0;
    const score = Math.max(0, 1 - (feePercentage / maxAcceptableFee));
    
    return score;
  }

  /**
   * Calculate speed score (0-1)
   */
  private calculateSpeedScore(rail: PaymentRailConfig, request: PaymentRoutingRequest): number {
    const speedRank = this.getSpeedRank(rail.averageSettlementTime);
    
    // Urgent payments weight speed more heavily
    if (request.isUrgent) {
      return speedRank / 6; // Normalize to 0-1
    }
    
    // For non-urgent, all speeds are acceptable
    return 0.8 + (speedRank / 6) * 0.2;
  }

  /**
   * Calculate reliability score based on ML predictions
   */
  private async calculateReliabilityScore(
    rail: PaymentRailConfig,
    request: PaymentRoutingRequest,
  ): Promise<number> {
    // Get ML-based success prediction
    const prediction = await this.predictSuccessProbability(rail, request);
    
    return prediction.probability;
  }

  /**
   * ML-based success probability prediction
   */
  private predictSuccessProbability(
    rail: PaymentRailConfig,
    request: PaymentRoutingRequest,
  ): SuccessPrediction {
    // In production, this would call an ML model
    // For now, use heuristic-based estimation
    
    const metrics = this.railProvider.getPerformanceMetrics(rail.railType, rail.provider);
    
    const baseSuccessRate = metrics ? metrics.successRate24h / 100 : 0.95;
    
    // Adjust for current rail status
    const statusFactor = rail.status === 'ACTIVE' ? 1.0 : 0.7;
    
    // Adjust for time of day (simplified)
    const hour = new Date().getHours();
    const timeFactor = hour >= 9 && hour <= 17 ? 1.0 : 0.95; // Business hours better
    
    // Adjust for amount (large amounts slightly riskier)
    const amountFactor = Number(request.amount) > 1_000_000_000 ? 0.98 : 1.0;
    
    const probability = baseSuccessRate * statusFactor * timeFactor * amountFactor;
    
    return {
      railType: rail.railType,
      provider: rail.provider,
      probability: Math.min(probability, 0.999), // Cap at 99.9%
      factors: {
        historicalSuccessRate: baseSuccessRate,
        currentRailStatus: statusFactor,
        timeOfDayFactor: timeFactor,
        dayOfWeekFactor: 1.0,
        amountFactor,
        userHistoryFactor: 1.0,
        currencyPairFactor: 1.0,
        countryRiskFactor: 1.0,
      },
      confidence: 0.85,
      modelVersion: 'heuristic-v1.0',
    };
  }

  /**
   * Generate final routing decision
   */
  private generateRoutingDecision(
    bestRail: { rail: PaymentRailConfig; score: number; reasons: string[] },
    allScoredRails: Array<{ rail: PaymentRailConfig; score: number; reasons: string[] }>,
    request: PaymentRoutingRequest,
  ): RoutingDecision {
    const fee = this.railProvider.calculateFee(bestRail.rail, request.amount, request.currency);
    const settlement = this.railProvider.estimateSettlementTime(bestRail.rail);
    
    const prediction = this.predictSuccessProbability(bestRail.rail, request);
    
    // Generate alternatives (top 3 excluding the winner)
    const alternatives = allScoredRails.slice(1, 4).map(scored => ({
      rail: scored.rail,
      score: scored.score,
      reason: scored.reasons.join('; '),
    }));

    return {
      selectedRail: bestRail.rail,
      predictedSuccessRate: prediction.probability,
      estimatedCost: fee,
      estimatedSettlementTime: settlement.expected,
      alternatives,
      optimizationObjective: request.optimizationObjective || OptimizationObjective.BALANCED,
      userPreferences: {
        ...this.defaultWeights,
        ...request.userPreferences,
      },
      costBreakdown: {
        railFee: fee,
        totalCost: fee,
        effectivePercentage: Number(fee) / Number(request.amount) * 100,
      },
      riskScore: this.calculateRiskScore(bestRail.rail, request),
      riskFactors: this.identifyRiskFactors(bestRail.rail, request),
      decisionId: this.generateDecisionId(),
      decisionTimestamp: new Date(),
      modelVersion: 'routing-engine-v1.0',
      reasoning: bestRail.reasons.join('; '),
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(rail: PaymentRailConfig, request: PaymentRoutingRequest): number {
    let riskScore = 0;
    
    // New rail risk
    if (!request.preferredRails?.includes(rail.railType)) {
      riskScore += 10;
    }
    
    // Cross-border risk
    if (request.recipientCountry !== 'US') {
      riskScore += 15;
    }
    
    // Large amount risk
    if (Number(request.amount) > 100_000_000) { // > $1M
      riskScore += 20;
    }
    
    // Rail type risk
    if ([PaymentRailType.SWIFT, PaymentRailType.WIRE_INTERNATIONAL].includes(rail.railType)) {
      riskScore += 10;
    }
    
    return Math.min(riskScore, 100);
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(rail: PaymentRailConfig, request: PaymentRoutingRequest): string[] {
    const factors: string[] = [];
    
    if (request.recipientCountry !== 'US') {
      factors.push('Cross-border transaction');
    }
    
    if (Number(request.amount) > 100_000_000) {
      factors.push('High-value transaction');
    }
    
    if (rail.status !== 'ACTIVE') {
      factors.push('Rail not in optimal status');
    }
    
    if (request.isRecurring) {
      factors.push('Recurring payment');
    }
    
    return factors;
  }

  /**
   * Get numeric rank for settlement speed
   */
  private getSpeedRank(speed: SettlementSpeed): number {
    const ranks: Record<SettlementSpeed, number> = {
      [SettlementSpeed.INSTANT]: 6,
      [SettlementSpeed.REAL_TIME]: 5,
      [SettlementSpeed.SAME_DAY]: 4,
      [SettlementSpeed.NEXT_DAY]: 3,
      [SettlementSpeed.STANDARD]: 2,
      [SettlementSpeed.SLOW]: 1,
    };
    return ranks[speed];
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
