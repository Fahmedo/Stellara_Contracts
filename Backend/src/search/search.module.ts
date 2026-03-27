import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { TransactionRecord } from '../contract-interaction/entities/transaction-record.entity';
import { ContractMetadata } from '../contract-interaction/entities/contract-metadata.entity';
import { Workflow } from '../workflow/entities/workflow.entity';
import { AuditLog } from '../audit/audit.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, TransactionRecord, ContractMetadata, Workflow, AuditLog]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
