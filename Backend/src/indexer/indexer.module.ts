import { Module } from '@nestjs/common';
import { AbiRegistryModule } from '../abi-registry/abi-registry.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { IndexerService } from './indexer.service';
import { EventListenerService } from './events/event-listener.service';
import { EventProcessorService } from './processors/event-processor.service';
import { StorageService } from './storage/storage.service';
import { HealthCheckService } from './health/health-check.service';
import { LedgerTrackerService } from './services/ledger-tracker.service';
import { EventHandlerService } from './services/event-handler.service';
import { DatabaseModule } from '../database.module';
import stellarConfig, { indexerConfig } from '../config/stellar.config';

/**
 * Blockchain Indexer Module
 *
 * This module provides background indexing of Stellar blockchain events
 * to synchronize on-chain state with local database.
 */
@Module({
  imports: [
    // Enable scheduled tasks
    ScheduleModule.forRoot(),
    // Database access
    DatabaseModule,
    AbiRegistryModule,
    // Configuration
    ConfigModule.forFeature(stellarConfig),
    ConfigModule.forFeature(indexerConfig),
  ],
  providers: [
    // Core indexer service
    IndexerService,
    // Event processing
    EventListenerService,
    EventProcessorService,
    StorageService,
    HealthCheckService,
    // Ledger state tracking
    LedgerTrackerService,
    EventHandlerService,
  ],
  exports: [
    // Export services for potential external use
    IndexerService,
    EventListenerService,
    EventProcessorService,
    StorageService,
    HealthCheckService,
    LedgerTrackerService,
    EventHandlerService,
  ],
})
export class IndexerModule {}
