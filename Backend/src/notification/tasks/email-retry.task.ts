import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import * as sgMail from '@sendgrid/mail';
import { EmailService } from '../services/email.service';

@Injectable()
export class EmailRetryTask {
  private readonly logger = new Logger(EmailRetryTask.name);
  private readonly maxAttempts = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.debug('Checking email outbox for failed messages...');

    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!sendGridApiKey) {
      this.logger.error('SENDGRID_API_KEY not set during retry. Failed emails will remain in outbox.');
      await this.emailService.checkOutboxAlertThreshold();
      return;
    }

    sgMail.setApiKey(sendGridApiKey);

    const failedEmails = await this.prisma.emailOutbox.findMany({
      where: {
        status: 'FAILED',
        attempts: {
          lt: this.maxAttempts,
        },
      },
      take: 50,
    });

    for (const email of failedEmails) {
      try {
        this.logger.log(
          `Retrying email to ${email.to} (attempt ${email.attempts + 1}/${this.maxAttempts})`,
        );

        await sgMail.send({
          to: email.to,
          from: this.configService.get<string>('SENDGRID_FROM_EMAIL', 'noreply@novafund.xyz'),
          subject: email.subject,
          html: email.html,
        });

        await this.prisma.emailOutbox.update({
          where: { id: email.id },
          data: {
            status: 'SENT',
            attempts: email.attempts + 1,
            lastError: null,
          },
        });

        this.logger.log(`Successfully sent retried email to ${email.to}`);
      } catch (error) {
        this.logger.error(`Retry failed for email ${email.id}: ${error.message}`);
        await this.prisma.emailOutbox.update({
          where: { id: email.id },
          data: {
            attempts: email.attempts + 1,
            lastError: error.message,
          },
        });
      }
    }

    await this.emailService.checkOutboxAlertThreshold();
  }
}
