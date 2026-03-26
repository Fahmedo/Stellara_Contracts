import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StripeService } from './stripe.service';
import { PaymentService } from './payment.service';
import { SubscriptionStatus, PaymentEventType } from '@prisma/client';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentService: PaymentService,
  ) {}

  async recordUsage(
    tenantId: string,
    metricName: string,
    quantity: number,
    timestamp?: Date,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for tenant ${tenantId}`);
      return null;
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      this.logger.warn(`Subscription not active for tenant ${tenantId}`);
      return null;
    }

    // Create local usage record
    const usageRecord = await this.prisma.usageRecord.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        metricName,
        quantity,
        timestamp: timestamp || new Date(),
      },
    });

    // Report to Stripe if the plan has metered billing
    try {
      const stripeSubscription = await this.stripeService
        .getClient()
        .subscriptions.retrieve(subscription.stripeSubscriptionId);

      const meteredItem = stripeSubscription.items.data.find(
        (item) => item.price.recurring?.usage_type === 'metered',
      );

      if (meteredItem) {
        const stripeUsageRecord = await this.stripeService.createUsageRecord(
          meteredItem.id,
          quantity,
          timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
        );

        // Update local record with Stripe usage record ID
        await this.prisma.usageRecord.update({
          where: { id: usageRecord.id },
          data: { stripeUsageRecordId: stripeUsageRecord.id },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to report usage to Stripe: ${error.message}`);
      // Don't throw - we still want to track usage locally
    }

    await this.paymentService.logPaymentEvent(
      tenantId,
      PaymentEventType.USAGE_RECORDED,
      subscription.id,
      { metricName, quantity },
    );

    return usageRecord;
  }

  async getUsageSummary(tenantId: string, startDate: Date, endDate: Date) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return null;
    }

    const usageRecords = await this.prisma.usageRecord.groupBy({
      by: ['metricName'],
      where: {
        subscriptionId: subscription.id,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
      },
      _count: {
        id: true,
      },
    });

    return usageRecords.map((record) => ({
      metricName: record.metricName,
      totalQuantity: record._sum.quantity || 0,
      recordCount: record._count.id,
    }));
  }

  async getUsageHistory(
    tenantId: string,
    metricName?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return [];
    }

    return this.prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        ...(metricName && { metricName }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getCurrentPeriodUsage(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return null;
    }

    return this.getUsageSummary(
      tenantId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
  }

  async checkUsageLimit(
    tenantId: string,
    metricName: string,
    limit: number,
  ): Promise<{ withinLimit: boolean; currentUsage: number; remaining: number }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return { withinLimit: false, currentUsage: 0, remaining: 0 };
    }

    const currentUsage = await this.prisma.usageRecord.aggregate({
      where: {
        subscriptionId: subscription.id,
        metricName,
        timestamp: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const totalUsage = currentUsage._sum.quantity || 0;
    const remaining = Math.max(0, limit - totalUsage);

    return {
      withinLimit: totalUsage < limit,
      currentUsage: totalUsage,
      remaining,
    };
  }
}
