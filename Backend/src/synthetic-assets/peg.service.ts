import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { SyntheticOracleService } from './oracle.service';
import { PegStatus } from './interfaces/synthetic-assets.interface';

const PEG_TOLERANCE = 0.005;          // 0.5% max deviation before peg considered broken
const FEE_ADJUST_STEP = 0.001;        // adjust stability fee by 0.1% per cycle
const MAX_STABILITY_FEE = 0.10;       // 10% annual max
const MIN_STABILITY_FEE = 0.005;      // 0.5% annual min

@Injectable()
export class PegService {
  private readonly logger = new Logger(PegService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracle: SyntheticOracleService,
  ) {}

  /**
   * Monitor peg and adjust stability fees every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorPegs() {
    const assets = await this.prisma.syntheticAsset.findMany({ where: { isActive: true } });

    for (const asset of assets) {
      const oraclePrice = await this.oracle.getPrice(asset.oracleSymbol);
      const currentPrice = Number(asset.currentPrice);
      if (oraclePrice === 0 || currentPrice === 0) continue;

      const deviation = Math.abs(currentPrice - oraclePrice) / oraclePrice;
      let newFee = Number(asset.stabilityFee);

      // If synthetic trades below peg → increase fee to reduce minting incentive
      if (currentPrice < oraclePrice * (1 - PEG_TOLERANCE)) {
        newFee = Math.min(newFee + FEE_ADJUST_STEP, MAX_STABILITY_FEE);
        this.logger.warn(`${asset.symbol} below peg by ${(deviation * 100).toFixed(3)}%. Raising fee to ${(newFee * 100).toFixed(2)}%`);
      }
      // If synthetic trades above peg → decrease fee to encourage minting
      else if (currentPrice > oraclePrice * (1 + PEG_TOLERANCE)) {
        newFee = Math.max(newFee - FEE_ADJUST_STEP, MIN_STABILITY_FEE);
        this.logger.log(`${asset.symbol} above peg by ${(deviation * 100).toFixed(3)}%. Lowering fee to ${(newFee * 100).toFixed(2)}%`);
      }

      await this.prisma.syntheticAsset.update({
        where: { id: asset.id },
        data: { stabilityFee: newFee, pegDeviation: deviation },
      });
    }
  }

  async getPegStatus(syntheticSymbol: string): Promise<PegStatus> {
    const asset = await this.prisma.syntheticAsset.findUniqueOrThrow({
      where: { symbol: syntheticSymbol.toUpperCase() },
    });

    const oraclePrice = await this.oracle.getPrice(asset.oracleSymbol);
    const currentPrice = Number(asset.currentPrice);
    const deviation = oraclePrice > 0 ? (currentPrice - oraclePrice) / oraclePrice : 0;

    return {
      syntheticSymbol: asset.symbol,
      currentPrice,
      oraclePrice,
      pegDeviation: deviation,
      stabilityFee: Number(asset.stabilityFee),
      isPegged: Math.abs(deviation) <= PEG_TOLERANCE,
    };
  }

  async getAllPegStatuses(): Promise<PegStatus[]> {
    const assets = await this.prisma.syntheticAsset.findMany({ where: { isActive: true } });
    return Promise.all(assets.map(a => this.getPegStatus(a.symbol)));
  }

  /**
   * Accrue stability fees on all active CDPs — runs daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async accrueStabilityFees() {
    const cdps = await this.prisma.syntheticCDP.findMany({
      where: { status: { in: ['ACTIVE', 'AT_RISK'] }, mintedAmount: { gt: 0 } },
      include: { syntheticAsset: true },
    });

    for (const cdp of cdps) {
      const dailyRate = Number(cdp.syntheticAsset.stabilityFee) / 365;
      const feeAccrued = Number(cdp.mintedAmount) * dailyRate;

      await this.prisma.syntheticCDP.update({
        where: { id: cdp.id },
        data: {
          accruedFee: { increment: feeAccrued },
          lastFeeAccrual: new Date(),
        },
      });
    }

    this.logger.log(`Stability fees accrued for ${cdps.length} CDPs`);
  }
}
