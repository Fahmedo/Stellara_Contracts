import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionService } from './subscription.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { DunningService } from './dunning.service';
import { PaymentEventType, SubscriptionStatus, InvoiceStatus } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly dunningService: DunningService,
  ) {}

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'invoice.created':
        await this.handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const syncedInvoice = await this.invoiceService.syncInvoiceFromStripe(invoice.id);

    if (syncedInvoice) {
      await this.paymentService.logPaymentEvent(
        syncedInvoice.tenantId,
        PaymentEventType.INVOICE_PAID,
        syncedInvoice.subscriptionId,
        {
          invoiceId: syncedInvoice.id,
          amountPaid: syncedInvoice.amountPaid,
        },
        invoice.id,
      );

      // Check if this resolves any dunning attempts
      await this.dunningService.resolveDunningForInvoice(syncedInvoice.id);
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const syncedInvoice = await this.invoiceService.syncInvoiceFromStripe(invoice.id);

    if (syncedInvoice) {
      await this.paymentService.logPaymentEvent(
        syncedInvoice.tenantId,
        PaymentEventType.INVOICE_PAYMENT_FAILED,
        syncedInvoice.subscriptionId,
        {
          invoiceId: syncedInvoice.id,
          amountDue: syncedInvoice.amountDue,
        },
        invoice.id,
      );

      // Start dunning process
      await this.dunningService.startDunning(
        syncedInvoice.subscriptionId,
        syncedInvoice.tenantId,
        syncedInvoice.id,
      );
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const updated = await this.subscriptionService.syncSubscriptionFromStripe(
      subscription.id,
    );

    if (updated) {
      await this.paymentService.logPaymentEvent(
        updated.tenantId,
        PaymentEventType.SUBSCRIPTION_UPDATED,
        updated.id,
        {
          status: updated.status,
          cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        },
        subscription.id,
      );
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const localSubscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (localSubscription) {
      await this.prisma.subscription.update({
        where: { id: localSubscription.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          canceledAt: new Date(),
        },
      });

      await this.paymentService.logPaymentEvent(
        localSubscription.tenantId,
        PaymentEventType.SUBSCRIPTION_CANCELLED,
        localSubscription.id,
        { reason: 'stripe_deleted' },
        subscription.id,
      );
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.warn(
      `Payment intent failed: ${paymentIntent.id}, error: ${paymentIntent.last_payment_error?.message}`,
    );
  }

  private async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const syncedInvoice = await this.invoiceService.syncInvoiceFromStripe(invoice.id);

    if (syncedInvoice) {
      await this.paymentService.logPaymentEvent(
        syncedInvoice.tenantId,
        PaymentEventType.INVOICE_CREATED,
        syncedInvoice.subscriptionId,
        {
          invoiceId: syncedInvoice.id,
          amountDue: syncedInvoice.amountDue,
        },
        invoice.id,
      );
    }
  }
}
