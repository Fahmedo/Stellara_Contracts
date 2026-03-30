import { Module } from '@nestjs/common';
import { InstitutionalCustodyController } from './institutional-custody.controller';
import { CustodyService } from './services/custody.service';
import { InsuranceFundService } from './services/insurance-fund.service';
import { BeneficiaryService } from './services/beneficiary.service';

@Module({
  controllers: [InstitutionalCustodyController],
  providers: [CustodyService, InsuranceFundService, BeneficiaryService],
  exports: [CustodyService, InsuranceFundService, BeneficiaryService],
})
export class InstitutionalCustodyModule {}
