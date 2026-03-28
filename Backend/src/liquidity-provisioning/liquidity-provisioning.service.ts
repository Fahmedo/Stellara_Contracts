import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { LiquidityAggregationService } from '../liquidity-aggregation/services/liquidity-aggregation.service';
import {
  AggregatedOrderBook,
  OrderRequest,
  TradeExecution,
} from '../liquidity-aggregation/interfaces/liquidity-aggregation.interface';

interface ProvisioningPosition {
  symbol: string;
  baseBalance: number;
  quoteBalance: number;
  averageCost: number;
  realizedPnl: number;
  unrealizedPnl: number;
  lastUpdated: number;
}

interface LiquidityProvisionQuote {
  symbol: string;
  bid: number;
  ask: number;
  midPrice: number;
  spread: number;
  volatility: number;
  depthScore: number;
  skew: number;
  enabled: boolean;
  reason: string;
}

@Injectable()
export class LiquidityProvisioningService {
  private readonly logger = new Logger(LiquidityProvisioningService.name);
  private readonly recentQuotes: Record<string, LiquidityProvisionQuote> = {};
  private readonly positions: Record<string, ProvisioningPosition> = {};

  private readonly config = {
    maxSymbolsPerCycle: 10,
    minDepthScore: 0.15,
    maxInventorySkew: 0.2,
    maxSpread: 0.0045,
    minSpread: 0.0009,
    volatilityDisableThreshold: 0.68,
    orderSizeUsd: 2500,
    minRebalanceSize: 0.01,
    maxRebalanceSize: 10,
    maxSlippage: 0.02,
  };

  constructor(
    private readonly liquidityAggregationService: LiquidityAggregationService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.loadPersistedPositions();
  }

  @Interval('liquidityProvisioningCycle', 20000)
  async runLiquidityProvisioning(): Promise<void> {
    try {
      const supportedSymbols = await this.liquidityAggregationService.getSupportedSymbols();
      const symbols = supportedSymbols.slice(0, this.config.maxSymbolsPerCycle);

      for (const symbol of symbols) {
        try {
          const orderBook = await this.liquidityAggregationService.getAggregatedOrderBook(symbol);
          const quote = this.generateQuote(symbol, orderBook);
          this.recentQuotes[symbol] = quote;

          if (quote.enabled && Math.abs(quote.skew) > this.config.maxInventorySkew) {
            await this.executeRebalance(symbol, orderBook, quote);
          }
        } catch (error) {
          this.logger.warn(`Liquidity provisioning skipped for ${symbol}: ${error?.message || error}`);
        }
      }
    } catch (error) {
      this.logger.error('Liquidity provisioning cycle failed', error);
    }
  }

  async getProvisioningStatus() {
    return Object.values(this.recentQuotes).map((quote) => ({
      quote,
      position: this.positions[quote.symbol] || null,
    }));
  }

  async getQuote(symbol: string) {
    const orderBook = await this.liquidityAggregationService.getAggregatedOrderBook(symbol);
    const quote = this.generateQuote(symbol, orderBook);
    this.recentQuotes[symbol] = quote;
    return quote;
  }

  async rebalance(symbol: string) {
    const orderBook = await this.liquidityAggregationService.getAggregatedOrderBook(symbol);
    const quote = this.generateQuote(symbol, orderBook);
    this.recentQuotes[symbol] = quote;
    return this.executeRebalance(symbol, orderBook, quote);
  }

  async getPositions() {
    return Object.values(this.positions);
  }

  async getPnlHistory(symbol?: string) {
    const where = symbol ? { symbol } : undefined;
    return (this.prisma as any).liquidityProvisioningPnl.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  private async loadPersistedPositions() {
    const persisted = await (this.prisma as any).liquidityProvisioningPosition.findMany();
    for (const record of persisted) {
      this.positions[record.symbol] = {
        symbol: record.symbol,
        baseBalance: Number(record.baseBalance),
        quoteBalance: Number(record.quoteBalance),
        averageCost: Number(record.averageCost),
        realizedPnl: Number(record.realizedPnl),
        unrealizedPnl: Number(record.unrealizedPnl),
        lastUpdated: record.lastUpdated.getTime(),
      };
    }
  }

  private generateQuote(symbol: string, orderBook: AggregatedOrderBook): LiquidityProvisionQuote {
    const bestBid = parseFloat(orderBook.bids[0]?.price || '0');
    const bestAsk = parseFloat(orderBook.asks[0]?.price || '0');
    const midPrice = (bestBid + bestAsk) / 2;
    const depthScore = this.calculateDepthScore(orderBook, midPrice);
    const volatility = this.calculateVolatility(orderBook, midPrice);
    const spread = this.calculateDynamicSpread(volatility, depthScore);
    const skew = this.calculateInventorySkew(symbol, midPrice);

    const enabled =
      bestBid > 0 &&
      bestAsk > 0 &&
      midPrice > 0 &&
      depthScore >= this.config.minDepthScore &&
      volatility <= this.config.volatilityDisableThreshold;

    const reason = enabled
      ? Math.abs(skew) > this.config.maxInventorySkew
        ? 'Skew exceeds risk threshold, rebalancing will be triggered'
        : 'Quote is healthy and ready for deployment'
      : 'Market conditions do not support safe quoting';

    return {
      symbol,
      bid: Number((midPrice * (1 - spread / 2)).toFixed(8)),
      ask: Number((midPrice * (1 + spread / 2)).toFixed(8)),
      midPrice: Number(midPrice.toFixed(8)),
      spread: Number(spread.toFixed(8)),
      volatility: Number(volatility.toFixed(4)),
      depthScore: Number(depthScore.toFixed(4)),
      skew: Number(skew.toFixed(4)),
      enabled,
      reason,
    };
  }

  private calculateDepthScore(orderBook: AggregatedOrderBook, midPrice: number): number {
    const topLevels = [...orderBook.bids.slice(0, 3), ...orderBook.asks.slice(0, 3)];
    const totalDepth = topLevels.reduce((sum, level) => {
      const price = parseFloat(level.price);
      const amount = parseFloat(level.amount);
      return sum + price * amount;
    }, 0);

    return Math.min(1, totalDepth / Math.max(1, this.config.orderSizeUsd));
  }

  private calculateVolatility(orderBook: AggregatedOrderBook, midPrice: number): number {
    if (midPrice <= 0) {
      return 1;
    }

    const spread = (parseFloat(orderBook.asks[0]?.price || '0') - parseFloat(orderBook.bids[0]?.price || '0')) / midPrice;
    const weightedDepth = this.calculateDepthScore(orderBook, midPrice);
    return Math.min(1, spread * 3 + (1 - weightedDepth) * 0.4);
  }

  private calculateDynamicSpread(volatility: number, depthScore: number): number {
    const baseSpread = 0.0012;
    const dynamicSpread = baseSpread + volatility * 0.0018 + (1 - depthScore) * 0.0009;
    return Math.min(this.config.maxSpread, Math.max(this.config.minSpread, dynamicSpread));
  }

  private calculateInventorySkew(symbol: string, midPrice: number): number {
    const position = this.positions[symbol];
    if (!position || midPrice === 0) {
      return 0;
    }

    const totalValue = position.baseBalance * midPrice + position.quoteBalance;
    const targetBase = totalValue * 0.5 / Math.max(1, midPrice);
    if (targetBase === 0) {
      return 0;
    }

    return (position.baseBalance - targetBase) / targetBase;
  }

  private async executeRebalance(
    symbol: string,
    orderBook: AggregatedOrderBook,
    quote: LiquidityProvisionQuote,
  ) {
    if (!quote.enabled) {
      return {
        symbol,
        rebalance: false,
        reason: quote.reason,
      };
    }

    const position = this.positions[symbol] || {
      symbol,
      baseBalance: 0,
      quoteBalance: 0,
      averageCost: quote.midPrice,
      realizedPnl: 0,
      unrealizedPnl: 0,
      lastUpdated: Date.now(),
    };

    const totalValue = position.baseBalance * quote.midPrice + position.quoteBalance;
    const targetBase = totalValue * 0.5 / Math.max(1, quote.midPrice);
    const excessBase = position.baseBalance - targetBase;
    const orderAmount = Math.min(this.config.maxRebalanceSize, Math.abs(excessBase));

    if (orderAmount < this.config.minRebalanceSize) {
      return {
        symbol,
        rebalance: false,
        reason: 'Existing skew is below the minimum rebalance threshold',
      };
    }

    const side = excessBase > 0 ? 'sell' : 'buy';
    const price = side === 'buy' ? quote.ask : quote.bid;
    const order: OrderRequest = {
      id: `liquidity-provisioning-${symbol}-${Date.now()}`,
      symbol,
      side,
      amount: orderAmount.toFixed(8),
      type: 'limit',
      price: price.toFixed(8),
      userId: 'liquidity-provisioning',
      maxSlippage: this.config.maxSlippage,
    };

    const plan = await this.liquidityAggregationService.createExecutionPlan(order);
    if (plan.confidence < 0.5) {
      this.logger.warn(`Rebalance plan confidence too low for ${symbol}: ${plan.confidence}`);
      return {
        symbol,
        rebalance: false,
        reason: 'Execution confidence too low to place rebalance orders',
      };
    }

    const executions = await this.liquidityAggregationService.executeOrder(order);
    const result = await this.applyExecutions(symbol, executions, quote.midPrice);
    return {
      symbol,
      rebalance: executions.length > 0,
      order,
      executions,
      result,
    };
  }

  private async applyExecutions(symbol: string, executions: TradeExecution[], midPrice: number) {
    const position = this.positions[symbol] || {
      symbol,
      baseBalance: 0,
      quoteBalance: 0,
      averageCost: midPrice,
      realizedPnl: 0,
      unrealizedPnl: 0,
      lastUpdated: Date.now(),
    };

    for (const execution of executions) {
      const filledAmount = Number(execution.filledAmount || execution.amount || '0');
      const executionPrice = Number(execution.price);

      if (execution.side === 'buy') {
        const previousValue = position.baseBalance * position.averageCost;
        position.baseBalance += filledAmount;
        position.quoteBalance -= filledAmount * executionPrice;
        position.averageCost = position.baseBalance > 0 ? (previousValue + filledAmount * executionPrice) / position.baseBalance : 0;
      } else {
        position.baseBalance -= filledAmount;
        position.quoteBalance += filledAmount * executionPrice;
        const realized = position.averageCost > 0 ? filledAmount * (executionPrice - position.averageCost) : 0;
        position.realizedPnl += realized;
      }
    }

    position.unrealizedPnl = position.baseBalance * midPrice - position.baseBalance * position.averageCost;
    position.lastUpdated = Date.now();
    this.positions[symbol] = position;

    const persistedPosition = await this.persistPosition(position);
    await Promise.all(
      executions.map((execution) =>
        (this.prisma as any).liquidityProvisioningPnl.create({
          data: {
            positionId: persistedPosition.id,
            symbol,
            side: execution.side,
            amount: execution.filledAmount || execution.amount,
            price: execution.price,
            realizedPnl: Number(
              execution.side === 'sell'
                ? Math.max(0, Number(execution.amount) * (Number(execution.price) - position.averageCost))
                : 0,
            ).toString(),
          },
        }),
      ),
    );

    return position;
  }

  private async persistPosition(position: ProvisioningPosition) {
    return (this.prisma as any).liquidityProvisioningPosition.upsert({
      where: { symbol: position.symbol },
      create: {
        symbol: position.symbol,
        baseBalance: position.baseBalance.toString(),
        quoteBalance: position.quoteBalance.toString(),
        averageCost: position.averageCost.toString(),
        realizedPnl: position.realizedPnl.toString(),
        unrealizedPnl: position.unrealizedPnl.toString(),
        lastUpdated: new Date(position.lastUpdated),
      },
      update: {
        baseBalance: position.baseBalance.toString(),
        quoteBalance: position.quoteBalance.toString(),
        averageCost: position.averageCost.toString(),
        realizedPnl: position.realizedPnl.toString(),
        unrealizedPnl: position.unrealizedPnl.toString(),
        lastUpdated: new Date(position.lastUpdated),
      },
    });
  }
}
