import { Module } from '@nestjs/common';
import { PaymentRoutingController } from './payment-routing.controller';
import { PaymentRoutingService } from './services/payment-routing.service';
import { PaymentRoutingEngine } from './services/payment-routing-engine.service';
import { PaymentRailProviderService } from './services/payment-rail-provider.service';
import { FallbackRoutingService } from './services/fallback-routing.service';
import { AuditTrailService } from './services/audit-trail.service';
import { FXRateService } from './services/fx-rate.service';

/**
 * Payment Routing Module
 * Intelligent payment routing with multi-rail support
 */
@Module({
  controllers: [PaymentRoutingController],
  providers: [
    PaymentRoutingService,
    PaymentRoutingEngine,
    PaymentRailProviderService,
    FallbackRoutingService,
    AuditTrailService,
    FXRateService,
  ],
  exports: [
    PaymentRoutingService,
    PaymentRoutingEngine,
    PaymentRailProviderService,
  ],
})
export class PaymentRoutingModule {}
