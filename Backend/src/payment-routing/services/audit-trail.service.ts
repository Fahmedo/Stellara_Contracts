import { Injectable, Logger } from '@nestjs/common';
import {
  RoutingHistory,
  PaymentRoutingRequest,
  RoutingDecision,
  PaymentExecutionResult,
} from '../types/payment-routing.types';

/**
 * Audit Trail Service
 * Logs and tracks all routing decisions for compliance and optimization
 */
@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  // In-memory storage (in production, use database)
  private auditLogs = new Map<string, RoutingHistory>();
  
  // Indexes for efficient queries
  private userIndex = new Map<string, string[]>(); // userId -> decisionIds
  private railIndex = new Map<string, string[]>(); // railType -> decisionIds
  private dateIndex = new Map<string, string[]>(); // date -> decisionIds

  /**
   * Log routing decision
   */
  async logDecision(
    request: PaymentRoutingRequest,
    decision: RoutingDecision,
    execution: PaymentExecutionResult,
  ): Promise<void> {
    const history: RoutingHistory = {
      decisionId: decision.decisionId,
      request,
      decision,
      execution,
      wasOptimal: this.evaluateOptimality(decision, execution),
      createdAt: new Date(),
    };

    // Store in database
    this.auditLogs.set(decision.decisionId, history);

    // Update indexes
    this.updateIndexes(history);

    this.logger.log(
      `Audit: ${decision.selectedRail.railType} - ${execution.success ? 'SUCCESS' : 'FAILED'} ` +
      `(${request.amount} ${request.currency})`,
    );
  }

  /**
   * Get routing decision by ID
   */
  getDecision(decisionId: string): RoutingHistory | null {
    return this.auditLogs.get(decisionId) || null;
  }

  /**
   * Get decisions by user
   */
  getUserDecisions(userId: string, limit: number = 50): RoutingHistory[] {
    const decisionIds = this.userIndex.get(userId) || [];
    return decisionIds
      .slice(-limit)
      .map(id => this.auditLogs.get(id))
      .filter((h): h is RoutingHistory => !!h);
  }

  /**
   * Get decisions by rail type
   */
  getRailDecisions(railType: string, limit: number = 100): RoutingHistory[] {
    const decisionIds = this.railIndex.get(railType) || [];
    return decisionIds
      .slice(-limit)
      .map(id => this.auditLogs.get(id))
      .filter((h): h is RoutingHistory => !!h);
  }

  /**
   * Get decisions by date range
   */
  getDecisionsByDateRange(startDate: Date, endDate: Date): RoutingHistory[] {
    const results: RoutingHistory[] = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = this.getDateKey(currentDate);
      const decisionIds = this.dateIndex.get(dateKey) || [];
      
      for (const id of decisionIds) {
        const history = this.auditLogs.get(id);
        if (history) {
          results.push(history);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results.sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /**
   * Get performance analytics for a rail
   */
  getRailPerformance(railType: string, days: number = 30): {
    totalTransactions: number;
    successRate: number;
    avgAmount: bigint;
    totalVolume: bigint;
    avgFee: bigint;
    avgSettlementTimeMinutes: number;
  } {
    const decisions = this.getRailDecisions(railType, 1000);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const recentDecisions = decisions.filter(d => d.createdAt >= cutoffDate);
    
    const successful = recentDecisions.filter(d => d.execution.success);
    
    const totalAmount = successful.reduce((sum, d) => sum + d.execution.amount, 0n);
    const totalFees = successful.reduce((sum, d) => sum + d.execution.fee, 0n);
    
    return {
      totalTransactions: recentDecisions.length,
      successRate: successful.length / Math.max(recentDecisions.length, 1) * 100,
      avgAmount: successful.length > 0 ? totalAmount / BigInt(successful.length) : 0n,
      totalVolume: totalAmount,
      avgFee: successful.length > 0 ? totalFees / BigInt(successful.length) : 0n,
      avgSettlementTimeMinutes: 0, // Would calculate from actual settlement times
    };
  }

  /**
   * Evaluate if the chosen rail was actually optimal
   */
  private evaluateOptimality(decision: RoutingDecision, execution: PaymentExecutionResult): boolean {
    // If successful, consider it optimal
    if (execution.success) {
      return true;
    }

    // If failed, check if any alternative would have been better
    // This is simplified - in production, would analyze alternatives
    return false;
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startDate: Date, endDate: Date): {
    period: { start: Date; end: Date };
    totalTransactions: number;
    totalVolume: bigint;
    railsUsed: Array<{
      railType: string;
      count: number;
      volume: bigint;
      successRate: number;
    }>;
    crossBorderTransactions: number;
    highValueTransactions: number;
    failedTransactions: number;
  } {
    const decisions = this.getDecisionsByDateRange(startDate, endDate);
    
    const railsMap = new Map<string, { count: number; volume: bigint; successes: number }>();
    let totalVolume = 0n;
    let crossBorder = 0;
    let highValue = 0;
    let failed = 0;

    for (const decision of decisions) {
      const { request, execution } = decision;
      
      totalVolume += execution.amount;
      
      // Rail stats
      const railKey = `${execution.railType}_${execution.provider}`;
      const existing = railsMap.get(railKey) || { count: 0, volume: 0n, successes: 0 };
      railsMap.set(railKey, {
        count: existing.count + 1,
        volume: existing.volume + execution.amount,
        successes: existing.successes + (execution.success ? 1 : 0),
      });

      // Cross-border
      if (request.recipientCountry !== 'US') {
        crossBorder++;
      }

      // High value (> $10k)
      if (Number(execution.amount) > 10_000_00n) { // $10,000 in cents
        highValue++;
      }

      // Failed
      if (!execution.success) {
        failed++;
      }
    }

    const railsUsed = Array.from(railsMap.entries()).map(([key, data]) => ({
      railType: key,
      count: data.count,
      volume: data.volume,
      successRate: data.successes / Math.max(data.count, 1) * 100,
    }));

    return {
      period: { start: startDate, end: endDate },
      totalTransactions: decisions.length,
      totalVolume,
      railsUsed,
      crossBorderTransactions: crossBorder,
      highValueTransactions: highValue,
      failedTransactions: failed,
    };
  }

  /**
   * Export audit logs for external auditor
   */
  exportAuditLogs(format: 'JSON' | 'CSV', startDate?: Date, endDate?: Date): string {
    let decisions = Array.from(this.auditLogs.values());
    
    if (startDate && endDate) {
      decisions = this.getDecisionsByDateRange(startDate, endDate);
    }

    if (format === 'JSON') {
      return JSON.stringify(decisions, null, 2);
    } else if (format === 'CSV') {
      return this.convertToCSV(decisions);
    }

    return '';
  }

  /**
   * Get decision reasoning for audit
   */
  getDecisionReasoning(decisionId: string): {
    selectedRail: string;
    reasoning: string;
    alternatives: Array<{ rail: string; score: number; reason: string }>;
    riskFactors: string[];
  } | null {
    const history = this.getDecision(decisionId);
    
    if (!history) {
      return null;
    }

    return {
      selectedRail: `${history.decision.selectedRail.railType}/${history.decision.selectedRail.provider}`,
      reasoning: history.decision.reasoning,
      alternatives: history.decision.alternatives.map(alt => ({
        rail: `${alt.rail.railType}/${alt.rail.provider}`,
        score: alt.score,
        reason: alt.reason,
      })),
      riskFactors: history.decision.riskFactors,
    };
  }

  /**
   * Update search indexes
   */
  private updateIndexes(history: RoutingHistory): void {
    // User index
    const userId = history.request.userId;
    if (!this.userIndex.has(userId)) {
      this.userIndex.set(userId, []);
    }
    this.userIndex.get(userId)!.push(history.decisionId);

    // Rail index
    const railType = history.decision.selectedRail.railType;
    if (!this.railIndex.has(railType)) {
      this.railIndex.set(railType, []);
    }
    this.railIndex.get(railType)!.push(history.decisionId);

    // Date index
    const dateKey = this.getDateKey(history.createdAt);
    if (!this.dateIndex.has(dateKey)) {
      this.dateIndex.set(dateKey, []);
    }
    this.dateIndex.get(dateKey)!.push(history.decisionId);
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(decisions: RoutingHistory[]): string {
    const headers = [
      'DecisionID',
      'Timestamp',
      'UserID',
      'Amount',
      'Currency',
      'RailType',
      'Provider',
      'Success',
      'Fee',
      'Reasoning',
    ];

    const rows = decisions.map(d => [
      d.decisionId,
      d.createdAt.toISOString(),
      d.request.userId,
      d.request.amount.toString(),
      d.request.currency,
      d.decision.selectedRail.railType,
      d.decision.selectedRail.provider,
      d.execution.success ? 'TRUE' : 'FALSE',
      d.execution.fee.toString(),
      `"${d.decision.reasoning.replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generate date key for indexing
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
