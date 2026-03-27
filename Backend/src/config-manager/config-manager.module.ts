import { Module } from '@nestjs/common';
import { ConfigManagerController } from './config-manager.controller';
import { ConfigManagerService } from './services/config-manager.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { SecretsService } from './services/secrets.service';
import { ConfigAuditService } from './services/config-audit.service';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ConfigManagerController],
  providers: [ConfigManagerService, FeatureFlagService, SecretsService, ConfigAuditService],
  exports: [ConfigManagerService, FeatureFlagService],
})
export class ConfigManagerModule {}
