import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StripeService } from './stripe.service';
import { SubscriptionStatus, PaymentEventType } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createCustomer(tenantId: string, email: string, name: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (existing?.stripeCustomerId) {
      this.logger.warn(`Customer already exists for tenant ${tenantId}`);
      return existing;
    }

    const customer = await this.stripeService.createCustomer(email, name, {
      tenantId,
    });

    this.logger.log(`Created Stripe customer ${customer.id} for tenant ${tenantId}`);
    return customer;
  }

  async getOrCreateCustomer(tenantId: string, email: string, name: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId;
    }

    const customer = await this.createCustomer(tenantId, email, name);
    return customer.id;
  }

  async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatus | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: { status: true },
    });
    return subscription?.status || null;
  }

  async isSubscriptionActive(tenantId: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(tenantId);
    return status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;
  }

  async logPaymentEvent(
    tenantId: string,
    eventType: PaymentEventType,
    subscriptionId: string | null,
    metadata?: Record<string, any>,
    stripeEventId?: string,
  ) {
    return this.prisma.paymentEvent.create({
      data: {
        tenantId,
        eventType,
        subscriptionId,
        metadata,
        stripeEventId,
      },
    });
  }

  async getPaymentHistory(tenantId: string, limit: number = 50) {
    return this.prisma.paymentEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
