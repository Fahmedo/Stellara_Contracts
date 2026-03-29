import { Controller, Get, Query, Post } from '@nestjs/common';
import { MarketSentimentService } from './market-sentiment.service';

@Controller('market-sentiment')
export class MarketSentimentController {
  constructor(private readonly sentimentService: MarketSentimentService) {}

  @Post('ingest')
  async ingestSources() {
    const records = await this.sentimentService.ingestSources();
    return { status: 'ok', added: records.length };
  }

  @Get('score')
  async getLatestScore(@Query('asset') asset?: string) {
    return this.sentimentService.getLatestSentiment(asset);
  }

  @Get('signals')
  async getTradingSignals() {
    return this.sentimentService.getTradingSignals();
  }

  @Get('backtest')
  async backtestAsset(@Query('asset') asset: string) {
    return this.sentimentService.backtestAsset(asset);
  }
}
