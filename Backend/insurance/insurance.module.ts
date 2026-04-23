import { Module } from '@nestjs/common';
import { DatabaseModule } from '../src/database.module';

import { InsuranceController } from './insurance.controller';

import { InsuranceService } from './insurance.service';
import { PoolService } from './pool.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { PricingService } from './pricing.service';
import { InsuranceAnalyticsService } from './insurance-analytics.service';
import { FraudDetectionService } from './fraud-detection.service';
import { InsuranceContractService } from './insurance-contract.service';

@Module({
  imports: [DatabaseModule],
  controllers: [InsuranceController],
  providers: [
    InsuranceService,
    PoolService,
    ClaimService,
    ReinsuranceService,
    PricingService,
    InsuranceAnalyticsService,
    FraudDetectionService,
    InsuranceContractService,
  ],
  exports: [
    InsuranceService,
    PoolService,
    ClaimService,
    ReinsuranceService,
    PricingService,
    InsuranceAnalyticsService,
    FraudDetectionService,
    InsuranceContractService,
  ],
})
export class InsuranceModule {}
