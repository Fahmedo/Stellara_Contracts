import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { SyntheticOracleService } from './oracle.service';
import { LiquidationResult } from './interfaces/synthetic-assets.interface';

@Injectable()
export class SyntheticLiquidationService {
  private readonly logger = new Logger(SyntheticLiquidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracle: SyntheticOracleService,
  ) {}

  /**
   * Scan all CDPs every minute and liquidate unhealthy ones
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorCDPs() {
    const atRisk = await this.prisma.syntheticCDP.findMany({
      where: { status: { in: ['ACTIVE', 'AT_RISK'] } },
      include: { syntheticAsset: true },
    });

    for (const cdp of atRisk) {
      const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
      const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

      const collateralUsd = Number(cdp.collateralAmount) * collateralPrice;
      const debtUsd = Number(cdp.mintedAmount) * syntheticPrice;
      const cratio = debtUsd > 0 ? collateralUsd / debtUsd : 999;
      const healthFactor = debtUsd > 0 ? collateralUsd / (debtUsd * Number(cdp.syntheticAsset.liqCratio)) : 999;

      const liqCratio = Number(cdp.syntheticAsset.liqCratio);

      if (cratio < liqCratio) {
        this.logger.warn(`CDP ${cdp.id} eligible for liquidation. CRatio: ${(cratio * 100).toFixed(2)}%`);
        await this.liquidateCDP(cdp.id, null);
      } else if (cratio < Number(cdp.syntheticAsset.minCratio)) {
        await this.prisma.syntheticCDP.update({
          where: { id: cdp.id },
          data: { status: 'AT_RISK', collateralRatio: cratio, healthFactor },
        });
      } else {
        if (cdp.status === 'AT_RISK') {
          await this.prisma.syntheticCDP.update({
            where: { id: cdp.id },
            data: { status: 'ACTIVE', collateralRatio: cratio, healthFactor },
          });
        }
      }
    }
  }

  async liquidateCDP(cdpId: string, liquidatorId: string | null): Promise<LiquidationResult> {
    const cdp = await this.prisma.syntheticCDP.findUniqueOrThrow({
      where: { id: cdpId },
      include: { syntheticAsset: true },
    });

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    const collateralUsd = Number(cdp.collateralAmount) * collateralPrice;
    const debtUsd = Number(cdp.mintedAmount) * syntheticPrice;
    const healthBefore = debtUsd > 0 ? collateralUsd / (debtUsd * Number(cdp.syntheticAsset.liqCratio)) : 999;

    const penalty = Number(cdp.syntheticAsset.liqPenalty);
    // Seize collateral = debt_usd * (1 + penalty) / collateral_price
    const seizedUsd = Math.min(debtUsd * (1 + penalty), collateralUsd);
    const collateralSeized = seizedUsd / collateralPrice;
    const penaltyAmount = (debtUsd * penalty) / collateralPrice;

    await this.prisma.$transaction(async (tx) => {
      await tx.syntheticCDP.update({
        where: { id: cdpId },
        data: {
          status: 'LIQUIDATED',
          collateralAmount: { decrement: collateralSeized },
          mintedAmount: 0,
          healthFactor: 0,
        },
      });

      await tx.syntheticLiquidation.create({
        data: {
          cdpId,
          liquidatorId,
          collateralSeized,
          collateralSymbol: cdp.collateralSymbol,
          debtRepaid: Number(cdp.mintedAmount),
          liquidationFee: penaltyAmount * 0.5,
          penaltyAmount,
          isPartial: false,
          healthBefore,
          healthAfter: 0,
        },
      });

      await tx.syntheticAsset.update({
        where: { id: cdp.syntheticAssetId },
        data: { totalMinted: { decrement: Number(cdp.mintedAmount) } },
      });
    });

    this.logger.log(`CDP ${cdpId} liquidated. Collateral seized: ${collateralSeized.toFixed(6)} ${cdp.collateralSymbol}`);

    return {
      cdpId,
      liquidatorId,
      collateralSeized,
      debtRepaid: Number(cdp.mintedAmount),
      penalty: penaltyAmount,
      isPartial: false,
      newHealthFactor: 0,
    };
  }
}
