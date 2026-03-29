import { Module } from '@nestjs/common';
import { SyntheticAssetsController } from './synthetic-assets.controller';
import { SyntheticAssetsService } from './synthetic-assets.service';
import { SyntheticOracleService } from './oracle.service';
import { SyntheticLiquidationService } from './liquidation.service';
import { PegService } from './peg.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyntheticAssetsController],
  providers: [
    SyntheticAssetsService,
    SyntheticOracleService,
    SyntheticLiquidationService,
    PegService,
  ],
  exports: [SyntheticAssetsService, SyntheticOracleService],
})
export class SyntheticAssetsModule {}
