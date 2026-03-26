import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StripeService } from './stripe.service';
import { PaymentService } from './payment.service';
import { PaymentEventType } from '@prisma/client';

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  // Retry schedule: 1 day, 3 days, 7 days
  private readonly retryDelays = [1, 3, 7];

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentService: PaymentService,
  ) {}

  async startDunning(
    subscriptionId: string,
    tenantId: string,
    invoiceId: string,
  ) {
    // Check if dunning already started for this invoice
    const existing = await this.prisma.dunningAttempt.findFirst({
      where: {
        subscriptionId,
        invoiceId,
        status: 'pending',
      },
    });

    if (existing) {
      this.logger.log(`Dunning already started for invoice ${invoiceId}`);
      return existing;
    }

    const dunningAttempt = await this.prisma.dunningAttempt.create({
      data: {
        subscriptionId,
        tenantId,
        invoiceId,
        attemptNumber: 1,
        status: 'pending',
        nextRetryAt: this.calculateNextRetry(1),
      },
    });

    await this.paymentService.logPaymentEvent(
      tenantId,
      PaymentEventType.DUNNING_STARTED,
      subscriptionId,
      { invoiceId, attemptNumber: 1 },
    );

    this.logger.log(`Started dunning for invoice ${invoiceId}`);
    return dunningAttempt;
  }

  async processDunningRetries(): Promise<number> {
    const now = new Date();
    const pendingRetries = await this.prisma.dunningAttempt.findMany({
      where: {
        status: 'pending',
        nextRetryAt: {
          lte: now,
        },
      },
      include: {
        subscription: true,
      },
    });

    let processed = 0;

    for (const attempt of pendingRetries) {
      try {
        await this.processRetry(attempt);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process dunning retry ${attempt.id}: ${error.message}`,
        );
      }
    }

    return processed;
  }

  private async processRetry(attempt: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: attempt.invoiceId },
    });

    if (!invoice || invoice.status === 'PAID') {
      // Invoice paid or deleted, resolve dunning
      await this.resolveDunning(attempt.id, 'succeeded');
      return;
    }

    // Attempt to retry payment via Stripe
    try {
      await this.stripeService.retryInvoicePayment(invoice.stripeInvoiceId);
      // If successful, Stripe will send a webhook and we'll resolve there
      this.logger.log(`Retry payment succeeded for invoice ${invoice.id}`);
    } catch (error) {
      this.logger.warn(`Retry payment failed for invoice ${invoice.id}: ${error.message}`);

      // Schedule next retry or mark as failed
      if (attempt.attemptNumber >= this.retryDelays.length) {
        await this.finalizeDunningFailure(attempt);
      } else {
        await this.scheduleNextRetry(attempt);
      }
    }
  }

  private async scheduleNextRetry(attempt: any) {
    const nextAttemptNumber = attempt.attemptNumber + 1;
    const nextRetryAt = this.calculateNextRetry(nextAttemptNumber);

    await this.prisma.dunningAttempt.update({
      where: { id: attempt.id },
      data: {
        attemptNumber: nextAttemptNumber,
        nextRetryAt,
      },
    });

    this.logger.log(
      `Scheduled retry ${nextAttemptNumber} for invoice ${attempt.invoiceId} at ${nextRetryAt}`,
    );
  }

  private async finalizeDunningFailure(attempt: any) {
    await this.prisma.dunningAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'failed',
        resolvedAt: new Date(),
      },
    });

    await this.paymentService.logPaymentEvent(
      attempt.tenantId,
      PaymentEventType.DUNNING_FAILED,
      attempt.subscriptionId,
      { invoiceId: attempt.invoiceId, totalAttempts: attempt.attemptNumber },
    );

    // Optionally suspend the tenant's subscription
    await this.suspendSubscription(attempt.subscriptionId);

    this.logger.warn(
      `Dunning failed for invoice ${attempt.invoiceId} after ${attempt.attemptNumber} attempts`,
    );
  }

  async resolveDunning(attemptId: string, status: 'succeeded' | 'failed') {
    const attempt = await this.prisma.dunningAttempt.update({
      where: { id: attemptId },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });

    if (status === 'succeeded') {
      await this.paymentService.logPaymentEvent(
        attempt.tenantId,
        PaymentEventType.DUNNING_RESOLVED,
        attempt.subscriptionId,
        { invoiceId: attempt.invoiceId },
      );
    }

    return attempt;
  }

  async resolveDunningForInvoice(invoiceId: string) {
    const attempts = await this.prisma.dunningAttempt.findMany({
      where: {
        invoiceId,
        status: 'pending',
      },
    });

    for (const attempt of attempts) {
      await this.resolveDunning(attempt.id, 'succeeded');
    }

    return attempts.length;
  }

  private async suspendSubscription(subscriptionId: string) {
    // Update subscription status to suspended/unpaid
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'UNPAID',
      },
    });

    // Note: Actual suspension logic (disabling tenant access) would be handled
    // by a separate service or webhook
  }

  private calculateNextRetry(attemptNumber: number): Date {
    const delayDays = this.retryDelays[attemptNumber - 1] || 7;
    const nextRetry = new Date();
    nextRetry.setDate(nextRetry.getDate() + delayDays);
    return nextRetry;
  }

  async getDunningStats(tenantId: string) {
    const [active, resolved, failed] = await Promise.all([
      this.prisma.dunningAttempt.count({
        where: { tenantId, status: 'pending' },
      }),
      this.prisma.dunningAttempt.count({
        where: { tenantId, status: 'succeeded' },
      }),
      this.prisma.dunningAttempt.count({
        where: { tenantId, status: 'failed' },
      }),
    ]);

    return { active, resolved, failed };
  }

  async getPendingDunningAttempts(tenantId?: string) {
    return this.prisma.dunningAttempt.findMany({
      where: {
        status: 'pending',
        ...(tenantId && { tenantId }),
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { nextRetryAt: 'asc' },
    });
  }
}
