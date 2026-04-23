import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';
import { ActivityLoggingService } from './services/activity-logging.service';
import { ReputationAccessService } from './services/reputation-access.service';
import { APP_GUARD } from '@nestjs/core';
import { ReputationGuard } from './guards/reputation.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [ReputationController],
  providers: [
    ReputationService,
    ActivityLoggingService,
    ReputationAccessService,
    {
      provide: APP_GUARD,
      useClass: ReputationGuard,
    },
  ],
  exports: [ReputationService, ActivityLoggingService, ReputationAccessService],
})
export class ReputationModule {}
