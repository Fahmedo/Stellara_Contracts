import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DunningService } from '../dunning.service';

@Injectable()
export class DunningTask {
  private readonly logger = new Logger(DunningTask.name);

  constructor(private readonly dunningService: DunningService) {}

  /**
   * Process dunning retries every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processRetries(): Promise<void> {
    this.logger.log('Processing dunning retries');

    try {
      const processed = await this.dunningService.processDunningRetries();
      this.logger.log(`Processed ${processed} dunning retries`);
    } catch (error) {
      this.logger.error(`Failed to process dunning retries: ${error.message}`);
    }
  }

  /**
   * Send reminder emails for pending dunning attempts daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDunningReminders(): Promise<void> {
    this.logger.log('Sending dunning reminders');

    try {
      const pendingAttempts = await this.dunningService.getPendingDunningAttempts();

      for (const attempt of pendingAttempts) {
        // Skip if email was already sent recently
        if (attempt.emailSentAt) {
          const hoursSinceEmail =
            (Date.now() - attempt.emailSentAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceEmail < 24) continue;
        }

        // TODO: Send email notification via notification service
        // This would integrate with the existing notification module
        this.logger.log(
          `Would send dunning reminder for invoice ${attempt.invoiceId} (attempt ${attempt.attemptNumber})`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send dunning reminders: ${error.message}`);
    }
  }
}
