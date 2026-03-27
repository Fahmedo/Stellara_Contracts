import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ContractInteractionService } from './contract-interaction.service';
import { ContractInteractionController } from './contract-interaction.controller';
import { TransactionRecord } from './entities/transaction-record.entity';
import { ContractMetadata } from './entities/contract-metadata.entity';
import { AuditModule } from '../audit/audit.module';
import { RabbitmqModule } from '../messaging/rabbitmq/rabbitmq.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionRecord, ContractMetadata]),
    ConfigModule,
    AuditModule,
    RabbitmqModule,
  ],
  controllers: [ContractInteractionController],
  providers: [ContractInteractionService],
  exports: [ContractInteractionService],
})
export class ContractInteractionModule {}
