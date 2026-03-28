import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LiquidityProvisioningService } from './liquidity-provisioning.service';

@ApiTags('Liquidity Provisioning')
@Controller('liquidity-provisioning')
export class LiquidityProvisioningController {
  constructor(private readonly provisioningService: LiquidityProvisioningService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current liquidity provisioning status' })
  @ApiResponse({ status: 200, description: 'Liquidity provisioning status retrieved successfully' })
  async getStatus() {
    return this.provisioningService.getProvisioningStatus();
  }

  @Get('quote/:symbol')
  @ApiOperation({ summary: 'Generate a market making quote for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol to quote (e.g., BTC/USDT)' })
  @ApiResponse({ status: 200, description: 'Quote generated successfully' })
  async getQuote(@Param('symbol') symbol: string) {
    return this.provisioningService.getQuote(symbol);
  }

  @Post('rebalance/:symbol')
  @ApiOperation({ summary: 'Execute inventory rebalancing for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading symbol to rebalance' })
  @ApiResponse({ status: 200, description: 'Rebalance executed successfully' })
  async rebalanceSymbol(@Param('symbol') symbol: string) {
    return this.provisioningService.rebalance(symbol);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get current provisioning positions' })
  @ApiResponse({ status: 200, description: 'Provisioning positions retrieved successfully' })
  async getPositions() {
    return this.provisioningService.getPositions();
  }

  @Get('pnl')
  @ApiOperation({ summary: 'Get P&L history for provisioning positions' })
  @ApiQuery({ name: 'symbol', required: false, description: 'Filter by symbol' })
  @ApiResponse({ status: 200, description: 'Provisioning P&L history retrieved successfully' })
  async getPnl(@Query('symbol') symbol?: string) {
    return this.provisioningService.getPnlHistory(symbol);
  }
}
