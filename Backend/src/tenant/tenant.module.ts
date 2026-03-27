import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { DatabaseModule } from '../database.module';
import { NotificationModule } from '../notification/notification.module';
import { QuotaModule } from '../quota/quota.module';
import { AdvancedCacheModule } from '../cache/advanced-cache.module';
import { RabbitmqModule } from '../messaging/rabbitmq/rabbitmq.module';

@Module({
  imports: [DatabaseModule, NotificationModule, QuotaModule, AdvancedCacheModule, RabbitmqModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
