import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class WebhookDeliveryTask {
  private readonly logger = new Logger(WebhookDeliveryTask.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const processed = await this.webhooksService.processDueDeliveries(50);
    if (processed > 0) {
      this.logger.log(`Processed ${processed} webhook deliveries`);
    }
  }
}
