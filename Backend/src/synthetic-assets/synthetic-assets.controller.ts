import {
  Controller, Get, Post, Body, Param, Query, Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyntheticAssetsService } from './synthetic-assets.service';
import { PegService } from './peg.service';
import {
  OpenCDPDto, MintSyntheticDto, BurnSyntheticDto,
  AddCollateralDto, WithdrawCollateralDto, UpdateOraclePriceDto,
} from './dto/synthetic-assets.dto';

@ApiTags('Synthetic Assets')
@Controller('synthetic-assets')
export class SyntheticAssetsController {
  constructor(
    private readonly service: SyntheticAssetsService,
    private readonly pegService: PegService,
  ) {}

  // ── Setup ────────────────────────────────────────────────────────────────────

  @Post('seed')
  @ApiOperation({ summary: 'Seed default synthetic assets (sGOLD, sSPX, sEUR, sOIL, sTSLA)' })
  seedAssets() {
    return this.service.seedDefaultAssets();
  }

  @Get()
  @ApiOperation({ summary: 'List all active synthetic assets' })
  listAssets() {
    return this.service.listSyntheticAssets();
  }

  // ── CDP Lifecycle ─────────────────────────────────────────────────────────────

  @Post('cdp/open')
  @ApiOperation({ summary: 'Open a new CDP by depositing collateral' })
  @ApiResponse({ status: 201, description: 'CDP opened successfully' })
  openCDP(@Body() dto: OpenCDPDto) {
    return this.service.openCDP(dto);
  }

  @Post('cdp/mint')
  @ApiOperation({ summary: 'Mint synthetic tokens against CDP collateral' })
  mintSynthetic(@Body() dto: MintSyntheticDto) {
    return this.service.mintSynthetic(dto);
  }

  @Post('cdp/burn')
  @ApiOperation({ summary: 'Burn synthetic tokens to reduce CDP debt' })
  burnSynthetic(@Body() dto: BurnSyntheticDto) {
    return this.service.burnSynthetic(dto);
  }

  @Post('cdp/add-collateral')
  @ApiOperation({ summary: 'Add collateral to an existing CDP' })
  addCollateral(@Body() dto: AddCollateralDto) {
    return this.service.addCollateral(dto);
  }

  @Post('cdp/withdraw-collateral')
  @ApiOperation({ summary: 'Withdraw excess collateral from CDP' })
  withdrawCollateral(@Body() dto: WithdrawCollateralDto) {
    return this.service.withdrawCollateral(dto);
  }

  @Delete('cdp/:cdpId/close')
  @ApiOperation({ summary: 'Close a CDP (requires zero debt)' })
  closeCDP(@Param('cdpId') cdpId: string, @Query('userId') userId: string) {
    return this.service.closeCDP(userId, cdpId);
  }

  // ── Health & Views ────────────────────────────────────────────────────────────

  @Get('cdp/:cdpId/health')
  @ApiOperation({ summary: 'Get CDP health: collateral ratio, health factor, max mintable' })
  getCDPHealth(@Param('cdpId') cdpId: string) {
    return this.service.getCDPHealth(cdpId);
  }

  @Get('cdp/user/:userId')
  @ApiOperation({ summary: 'List all CDPs for a user' })
  getUserCDPs(@Param('userId') userId: string) {
    return this.service.getUserCDPs(userId);
  }

  // ── Oracle ────────────────────────────────────────────────────────────────────

  @Post('oracle/price')
  @ApiOperation({ summary: 'Submit oracle price update for a synthetic asset' })
  updatePrice(@Body() dto: UpdateOraclePriceDto) {
    return this.service.updateOraclePrice(dto);
  }

  // ── Peg ───────────────────────────────────────────────────────────────────────

  @Get('peg')
  @ApiOperation({ summary: 'Get peg status for all synthetic assets' })
  getAllPegStatuses() {
    return this.pegService.getAllPegStatuses();
  }

  @Get('peg/:symbol')
  @ApiOperation({ summary: 'Get peg status for a specific synthetic asset' })
  getPegStatus(@Param('symbol') symbol: string) {
    return this.pegService.getPegStatus(symbol);
  }

  // ── Liquidation ───────────────────────────────────────────────────────────────

  @Post('cdp/:cdpId/liquidate')
  @ApiOperation({ summary: 'Manually trigger liquidation for an eligible CDP' })
  liquidateCDP(
    @Param('cdpId') cdpId: string,
    @Query('liquidatorId') liquidatorId?: string,
  ) {
    return this.service.triggerLiquidation(cdpId, liquidatorId ?? null);
  }
}
