import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SyntheticOracleService } from './oracle.service';
import { SyntheticLiquidationService } from './liquidation.service';
import { CDPHealth } from './interfaces/synthetic-assets.interface';
import {
  OpenCDPDto, MintSyntheticDto, BurnSyntheticDto,
  AddCollateralDto, WithdrawCollateralDto, UpdateOraclePriceDto,
} from './dto/synthetic-assets.dto';

// Default synthetic assets to seed
const DEFAULT_ASSETS = [
  { symbol: 'sGOLD', name: 'Synthetic Gold',    description: 'Tracks XAU/USD spot price',   oracleSymbol: 'XAU',    minCratio: 1.5, liqCratio: 1.2 },
  { symbol: 'sSPX',  name: 'Synthetic S&P 500', description: 'Tracks S&P 500 index',         oracleSymbol: 'SPX',    minCratio: 1.5, liqCratio: 1.2 },
  { symbol: 'sEUR',  name: 'Synthetic Euro',    description: 'Tracks EUR/USD forex rate',    oracleSymbol: 'EURUSD', minCratio: 1.3, liqCratio: 1.1 },
  { symbol: 'sOIL',  name: 'Synthetic Oil',     description: 'Tracks WTI crude oil price',   oracleSymbol: 'CRUDE',  minCratio: 1.6, liqCratio: 1.25 },
  { symbol: 'sTSLA', name: 'Synthetic Tesla',   description: 'Tracks TSLA stock price',      oracleSymbol: 'TSLA',   minCratio: 1.7, liqCratio: 1.3 },
];

@Injectable()
export class SyntheticAssetsService {
  private readonly logger = new Logger(SyntheticAssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracle: SyntheticOracleService,
    private readonly liquidation: SyntheticLiquidationService,
  ) {}

  // ── Seeding ──────────────────────────────────────────────────────────────────

  async seedDefaultAssets() {
    for (const asset of DEFAULT_ASSETS) {
      const oraclePrice = await this.oracle.getPrice(asset.oracleSymbol);
      await this.prisma.syntheticAsset.upsert({
        where: { symbol: asset.symbol },
        update: { currentPrice: oraclePrice, twapPrice: oraclePrice },
        create: {
          ...asset,
          currentPrice: oraclePrice,
          twapPrice: oraclePrice,
          stabilityFee: 0.02,
          liqPenalty: 0.13,
        },
      });
    }
    return { message: 'Default synthetic assets seeded', count: DEFAULT_ASSETS.length };
  }

  // ── CDP Management ────────────────────────────────────────────────────────────

  async openCDP(dto: OpenCDPDto) {
    const asset = await this.prisma.syntheticAsset.findUnique({
      where: { symbol: dto.syntheticSymbol.toUpperCase() },
    });
    if (!asset || !asset.isActive) {
      throw new BadRequestException(`Synthetic asset ${dto.syntheticSymbol} not found or inactive`);
    }

    // Check if CDP already exists for this user/asset/collateral combo
    const existing = await this.prisma.syntheticCDP.findUnique({
      where: {
        userId_syntheticAssetId_collateralSymbol: {
          userId: dto.userId,
          syntheticAssetId: asset.id,
          collateralSymbol: dto.collateralSymbol.toUpperCase(),
        },
      },
    });
    if (existing && existing.status === 'ACTIVE') {
      throw new BadRequestException('CDP already exists for this collateral. Use addCollateral instead.');
    }

    const collateralPrice = await this.oracle.getPrice(dto.collateralSymbol);
    const collateralValueUsd = dto.collateralAmount * collateralPrice;

    const cdp = await this.prisma.syntheticCDP.create({
      data: {
        userId: dto.userId,
        syntheticAssetId: asset.id,
        collateralSymbol: dto.collateralSymbol.toUpperCase(),
        collateralAmount: dto.collateralAmount,
        collateralValueUsd,
        mintedAmount: 0,
        debtValueUsd: 0,
        collateralRatio: 0,
        healthFactor: 999,
      },
      include: { syntheticAsset: true },
    });

    this.logger.log(`CDP opened: user=${dto.userId} asset=${dto.syntheticSymbol} collateral=${dto.collateralAmount} ${dto.collateralSymbol}`);
    return cdp;
  }

  async mintSynthetic(dto: MintSyntheticDto) {
    const cdp = await this.prisma.syntheticCDP.findUnique({
      where: { id: dto.cdpId },
      include: { syntheticAsset: true },
    });
    if (!cdp || cdp.userId !== dto.userId) throw new NotFoundException('CDP not found');
    if (cdp.status !== 'ACTIVE') throw new BadRequestException(`CDP is ${cdp.status}`);

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    if (syntheticPrice === 0) throw new BadRequestException('Oracle price unavailable');

    const collateralValueUsd = Number(cdp.collateralAmount) * collateralPrice;
    const newMinted = Number(cdp.mintedAmount) + dto.mintAmount;
    const debtValueUsd = newMinted * syntheticPrice;
    const cratio = debtValueUsd > 0 ? collateralValueUsd / debtValueUsd : 999;
    const minCratio = Number(cdp.syntheticAsset.minCratio);

    if (cratio < minCratio) {
      throw new BadRequestException(
        `Minting would breach min collateral ratio of ${minCratio * 100}%. Current would be ${(cratio * 100).toFixed(2)}%`,
      );
    }

    const healthFactor = collateralValueUsd / (debtValueUsd * Number(cdp.syntheticAsset.liqCratio));

    const [updatedCdp] = await this.prisma.$transaction([
      this.prisma.syntheticCDP.update({
        where: { id: dto.cdpId },
        data: { mintedAmount: newMinted, debtValueUsd, collateralRatio: cratio, healthFactor },
      }),
      this.prisma.syntheticAsset.update({
        where: { id: cdp.syntheticAssetId },
        data: { totalMinted: { increment: dto.mintAmount } },
      }),
    ]);

    this.logger.log(`Minted ${dto.mintAmount} ${cdp.syntheticAsset.symbol} for CDP ${dto.cdpId}`);
    return updatedCdp;
  }

  async burnSynthetic(dto: BurnSyntheticDto) {
    const cdp = await this.prisma.syntheticCDP.findUnique({
      where: { id: dto.cdpId },
      include: { syntheticAsset: true },
    });
    if (!cdp || cdp.userId !== dto.userId) throw new NotFoundException('CDP not found');
    if (Number(cdp.mintedAmount) < dto.burnAmount) {
      throw new BadRequestException('Burn amount exceeds minted balance');
    }

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    const newMinted = Number(cdp.mintedAmount) - dto.burnAmount;
    const debtValueUsd = newMinted * syntheticPrice;
    const collateralValueUsd = Number(cdp.collateralAmount) * collateralPrice;
    const cratio = debtValueUsd > 0 ? collateralValueUsd / debtValueUsd : 999;
    const healthFactor = debtValueUsd > 0
      ? collateralValueUsd / (debtValueUsd * Number(cdp.syntheticAsset.liqCratio))
      : 999;

    const [updatedCdp] = await this.prisma.$transaction([
      this.prisma.syntheticCDP.update({
        where: { id: dto.cdpId },
        data: { mintedAmount: newMinted, debtValueUsd, collateralRatio: cratio, healthFactor },
      }),
      this.prisma.syntheticAsset.update({
        where: { id: cdp.syntheticAssetId },
        data: { totalMinted: { decrement: dto.burnAmount } },
      }),
    ]);

    return updatedCdp;
  }

  async addCollateral(dto: AddCollateralDto) {
    const cdp = await this.prisma.syntheticCDP.findUnique({
      where: { id: dto.cdpId },
      include: { syntheticAsset: true },
    });
    if (!cdp || cdp.userId !== dto.userId) throw new NotFoundException('CDP not found');

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    const newCollateral = Number(cdp.collateralAmount) + dto.amount;
    const collateralValueUsd = newCollateral * collateralPrice;
    const debtValueUsd = Number(cdp.mintedAmount) * syntheticPrice;
    const cratio = debtValueUsd > 0 ? collateralValueUsd / debtValueUsd : 999;
    const healthFactor = debtValueUsd > 0
      ? collateralValueUsd / (debtValueUsd * Number(cdp.syntheticAsset.liqCratio))
      : 999;

    const newStatus = cratio >= Number(cdp.syntheticAsset.minCratio) ? 'ACTIVE' : 'AT_RISK';

    return this.prisma.syntheticCDP.update({
      where: { id: dto.cdpId },
      data: {
        collateralAmount: newCollateral,
        collateralValueUsd,
        debtValueUsd,
        collateralRatio: cratio,
        healthFactor,
        status: newStatus as any,
      },
    });
  }

  async withdrawCollateral(dto: WithdrawCollateralDto) {
    const cdp = await this.prisma.syntheticCDP.findUnique({
      where: { id: dto.cdpId },
      include: { syntheticAsset: true },
    });
    if (!cdp || cdp.userId !== dto.userId) throw new NotFoundException('CDP not found');

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    const newCollateral = Number(cdp.collateralAmount) - dto.amount;
    if (newCollateral < 0) throw new BadRequestException('Insufficient collateral');

    const collateralValueUsd = newCollateral * collateralPrice;
    const debtValueUsd = Number(cdp.mintedAmount) * syntheticPrice;
    const cratio = debtValueUsd > 0 ? collateralValueUsd / debtValueUsd : 999;

    if (debtValueUsd > 0 && cratio < Number(cdp.syntheticAsset.minCratio)) {
      throw new BadRequestException(
        `Withdrawal would breach min collateral ratio. Post-withdrawal ratio: ${(cratio * 100).toFixed(2)}%`,
      );
    }

    return this.prisma.syntheticCDP.update({
      where: { id: dto.cdpId },
      data: { collateralAmount: newCollateral, collateralValueUsd, collateralRatio: cratio },
    });
  }

  async closeCDP(userId: string, cdpId: string) {
    const cdp = await this.prisma.syntheticCDP.findUnique({ where: { id: cdpId } });
    if (!cdp || cdp.userId !== userId) throw new NotFoundException('CDP not found');
    if (Number(cdp.mintedAmount) > 0) {
      throw new BadRequestException('Burn all synthetic tokens before closing the CDP');
    }

    return this.prisma.syntheticCDP.update({
      where: { id: cdpId },
      data: { status: 'CLOSED', collateralAmount: 0 },
    });
  }

  // ── Health & Queries ──────────────────────────────────────────────────────────

  async getCDPHealth(cdpId: string): Promise<CDPHealth> {
    const cdp = await this.prisma.syntheticCDP.findUnique({
      where: { id: cdpId },
      include: { syntheticAsset: true },
    });
    if (!cdp) throw new NotFoundException('CDP not found');

    const collateralPrice = await this.oracle.getPrice(cdp.collateralSymbol);
    const syntheticPrice = await this.oracle.getPrice(cdp.syntheticAsset.oracleSymbol);

    const collateralValueUsd = Number(cdp.collateralAmount) * collateralPrice;
    const debtValueUsd = Number(cdp.mintedAmount) * syntheticPrice;
    const cratio = debtValueUsd > 0 ? collateralValueUsd / debtValueUsd : 999;
    const healthFactor = debtValueUsd > 0
      ? collateralValueUsd / (debtValueUsd * Number(cdp.syntheticAsset.liqCratio))
      : 999;

    const minCratio = Number(cdp.syntheticAsset.minCratio);
    // max minted = collateral_usd / (oracle_price * min_cratio)
    const maxMintable = syntheticPrice > 0
      ? Math.max(0, collateralValueUsd / (syntheticPrice * minCratio) - Number(cdp.mintedAmount))
      : 0;
    // safe withdrawable = collateral_usd - debt_usd * min_cratio (in collateral units)
    const safeWithdrawable = collateralPrice > 0
      ? Math.max(0, (collateralValueUsd - debtValueUsd * minCratio) / collateralPrice)
      : 0;

    return {
      cdpId,
      collateralRatio: cratio,
      healthFactor,
      collateralValueUsd,
      debtValueUsd,
      mintedAmount: Number(cdp.mintedAmount),
      status: cdp.status as any,
      maxMintable,
      safeWithdrawable,
    };
  }

  async getUserCDPs(userId: string) {
    return this.prisma.syntheticCDP.findMany({
      where: { userId },
      include: { syntheticAsset: true, liquidations: { orderBy: { timestamp: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSyntheticAssets() {
    return this.prisma.syntheticAsset.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });
  }

  async updateOraclePrice(dto: UpdateOraclePriceDto) {
    const asset = await this.prisma.syntheticAsset.findUnique({
      where: { symbol: dto.syntheticSymbol.toUpperCase() },
    });
    if (!asset) throw new NotFoundException(`Synthetic asset ${dto.syntheticSymbol} not found`);

    return this.oracle.updatePrice(asset.id, asset.oracleSymbol, dto.price, dto.source, dto.confidence);
  }

  async triggerLiquidation(cdpId: string, liquidatorId: string | null) {
    return this.liquidation.liquidateCDP(cdpId, liquidatorId);
  }
}
