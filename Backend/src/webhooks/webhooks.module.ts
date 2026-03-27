import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryTask } from './webhook-delivery.task';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryTask],
  exports: [WebhooksService],
})
export class WebhooksModule {}
