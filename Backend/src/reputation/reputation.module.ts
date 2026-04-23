import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationService } from './reputation.service';
import { ReputationOracleService } from './reputation-oracle.service';
import { ReputationController } from './reputation.controller';

@Module({
  imports: [DatabaseModule],
  providers: [ReputationService, ReputationOracleService],
  controllers: [ReputationController],
  exports: [ReputationService, ReputationOracleService],
})
export class ReputationModule {}
