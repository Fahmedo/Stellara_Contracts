import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { UsageService } from './usage.service';
import { InvoiceService } from './invoice.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { DunningService } from './dunning.service';
import { BillingTask } from './tasks/billing.task';
import { DunningTask } from './tasks/dunning.task';
import { DatabaseModule } from '../database.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    NotificationModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [
    PaymentService,
    StripeService,
    SubscriptionService,
    UsageService,
    InvoiceService,
    WebhookService,
    DunningService,
    BillingTask,
    DunningTask,
  ],
  exports: [PaymentService, SubscriptionService, UsageService, StripeService],
})
export class PaymentModule {}
