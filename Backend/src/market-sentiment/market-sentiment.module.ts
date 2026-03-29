import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MarketSentimentController } from './market-sentiment.controller';
import { MarketSentimentService } from './market-sentiment.service';

@Module({
  imports: [HttpModule],
  controllers: [MarketSentimentController],
  providers: [MarketSentimentService, PrismaService],
  exports: [MarketSentimentService],
})
export class MarketSentimentModule {}
