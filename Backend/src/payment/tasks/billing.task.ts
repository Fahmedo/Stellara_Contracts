import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { StripeService } from '../stripe.service';
import { InvoiceService } from '../invoice.service';

@Injectable()
export class BillingTask {
  private readonly logger = new Logger(BillingTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Sync invoices from Stripe daily to ensure data consistency
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncInvoices(): Promise<void> {
    this.logger.log('Starting daily invoice sync');

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'PAST_DUE', 'TRIALING'],
        },
      },
    });

    for (const subscription of subscriptions) {
      try {
        const stripeInvoices = await this.stripeService.listInvoices(
          subscription.stripeCustomerId,
          24, // Last 24 invoices
        );

        for (const stripeInvoice of stripeInvoices.data) {
          await this.invoiceService.syncInvoiceFromStripe(stripeInvoice.id);
        }
      } catch (error) {
        this.logger.error(
          `Failed to sync invoices for subscription ${subscription.id}: ${error.message}`,
        );
      }
    }

    this.logger.log('Daily invoice sync completed');
  }

  /**
   * Generate usage reports at the end of each billing period
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateUsageReports(): Promise<void> {
    this.logger.log('Generating usage reports');

    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Within next 24 hours
        },
      },
      include: {
        plan: true,
      },
    });

    for (const subscription of subscriptions) {
      try {
        // Aggregate usage for the period
        const usageSummary = await this.prisma.usageRecord.groupBy({
          by: ['metricName'],
          where: {
            subscriptionId: subscription.id,
            timestamp: {
              gte: subscription.currentPeriodStart,
              lte: subscription.currentPeriodEnd,
            },
          },
          _sum: {
            quantity: true,
          },
        });

        this.logger.log(
          `Usage report for ${subscription.tenantId}: ${JSON.stringify(usageSummary)}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate usage report for ${subscription.tenantId}: ${error.message}`,
        );
      }
    }
  }
}
