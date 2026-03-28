import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PriceData } from './interfaces/synthetic-assets.interface';

@Injectable()
export class SyntheticOracleService {
  private readonly logger = new Logger(SyntheticOracleService.name);

  // Mock prices for real-world assets tracked by synthetic tokens
  private readonly mockPrices: Record<string, number> = {
    XAU: 2350.00,     // Gold (USD/oz)
    SPX: 5200.00,     // S&P 500 index
    EURUSD: 1.085,    // EUR/USD forex
    CRUDE: 82.50,     // Crude oil (USD/barrel)
    TSLA: 175.00,     // Tesla stock
    NVDA: 850.00,     // Nvidia stock
  };

  // In-memory TWAP window (last 8 price samples)
  private readonly priceHistory: Record<string, number[]> = {};

  constructor(private readonly prisma: PrismaService) {}

  async getPrice(oracleSymbol: string): Promise<number> {
    const price = this.mockPrices[oracleSymbol.toUpperCase()];
    if (!price) {
      this.logger.warn(`No price found for oracle symbol: ${oracleSymbol}`);
      return 0;
    }
    return price;
  }

  async updatePrice(
    syntheticAssetId: string,
    oracleSymbol: string,
    price: number,
    source: string,
    confidence = 1.0,
  ): Promise<PriceData> {
    // Persist price feed record
    await this.prisma.oraclePriceFeed.create({
      data: { syntheticAssetId, source, price, confidence },
    });

    // Update mock cache
    this.mockPrices[oracleSymbol.toUpperCase()] = price;

    // Maintain TWAP history (sliding window of 8)
    if (!this.priceHistory[oracleSymbol]) this.priceHistory[oracleSymbol] = [];
    this.priceHistory[oracleSymbol].push(price);
    if (this.priceHistory[oracleSymbol].length > 8) {
      this.priceHistory[oracleSymbol].shift();
    }

    const twap = this.calculateTWAP(oracleSymbol);
    const deviation = twap > 0 ? Math.abs(price - twap) / twap : 0;

    // Update synthetic asset's current price and TWAP
    await this.prisma.syntheticAsset.update({
      where: { id: syntheticAssetId },
      data: { currentPrice: price, twapPrice: twap, pegDeviation: deviation },
    });

    this.logger.log(`Oracle update: ${oracleSymbol} = $${price} (TWAP: $${twap.toFixed(4)}) via ${source}`);

    return {
      symbol: oracleSymbol,
      price,
      twap,
      deviation,
      lastUpdated: new Date(),
      sources: [{ source, price, confidence }],
    };
  }

  async aggregatePrices(syntheticAssetId: string, oracleSymbol: string): Promise<number> {
    // Fetch the last 5 price feeds from multiple sources and compute median
    const feeds = await this.prisma.oraclePriceFeed.findMany({
      where: { syntheticAssetId, isValid: true },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    if (feeds.length === 0) return this.mockPrices[oracleSymbol.toUpperCase()] ?? 0;

    const prices = feeds.map(f => Number(f.price)).sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }

  async getAllPrices(): Promise<Record<string, number>> {
    return { ...this.mockPrices };
  }

  private calculateTWAP(symbol: string): number {
    const history = this.priceHistory[symbol];
    if (!history || history.length === 0) return this.mockPrices[symbol] ?? 0;
    return history.reduce((sum, p) => sum + p, 0) / history.length;
  }
}
