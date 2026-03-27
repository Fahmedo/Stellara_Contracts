import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { ExportJob } from './entities/export-job.entity';
import { User } from '../auth/entities/user.entity';
import { TransactionRecord } from '../contract-interaction/entities/transaction-record.entity';
import { ContractMetadata } from '../contract-interaction/entities/contract-metadata.entity';
import { Workflow } from '../workflow/entities/workflow.entity';
import { AuditLog } from '../audit/audit.entity';
import { Consent } from '../gdpr/entities/consent.entity';
import { VoiceJob } from '../voice/entities/voice-job.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExportJob,
      User,
      TransactionRecord,
      ContractMetadata,
      Workflow,
      AuditLog,
      Consent,
      VoiceJob,
    ]),
    ConfigModule,
    AuditModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class DataExportModule {}
