import { Module } from '@nestjs/common';
import { LiquidityAggregationModule } from '../liquidity-aggregation/liquidity-aggregation.module';
import { LiquidityProvisioningController } from './liquidity-provisioning.controller';
import { LiquidityProvisioningService } from './liquidity-provisioning.service';

@Module({
  imports: [LiquidityAggregationModule],
  controllers: [LiquidityProvisioningController],
  providers: [LiquidityProvisioningService],
})
export class LiquidityProvisioningModule {}
