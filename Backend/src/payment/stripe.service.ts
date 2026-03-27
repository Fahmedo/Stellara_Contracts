import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  getClient(): Stripe {
    return this.stripe;
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const idempotencyKey = `customer-${email}-${Date.now()}`;
    return this.stripe.customers.create(
      {
        email,
        name,
        metadata,
      },
      { idempotencyKey },
    );
  }

  async updateCustomer(
    customerId: string,
    data: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, data);
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    return this.stripe.customers.del(customerId);
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Subscription> {
    const idempotencyKey = `sub-${customerId}-${priceId}-${Date.now()}`;
    return this.stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
        collection_method: 'charge_automatically',
      },
      { idempotencyKey },
    );
  }

  async updateSubscription(
    subscriptionId: string,
    data: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, data);
  }

  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = true,
  ): Promise<Stripe.Subscription> {
    if (atPeriodEnd) {
      return this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number,
  ): Promise<Stripe.UsageRecord> {
    const idempotencyKey = `usage-${subscriptionItemId}-${timestamp || Date.now()}`;
    return this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'increment',
      },
      { idempotencyKey },
    );
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await this.stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId },
    );
    return paymentMethod;
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieve(invoiceId);
  }

  async listInvoices(
    customerId: string,
    limit: number = 10,
  ): Promise<Stripe.ApiList<Stripe.Invoice>> {
    return this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
  }

  async constructEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async retryInvoicePayment(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.pay(invoiceId);
  }

  async getPrice(priceId: string): Promise<Stripe.Price> {
    return this.stripe.prices.retrieve(priceId);
  }

  async listPrices(): Promise<Stripe.ApiList<Stripe.Price>> {
    return this.stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });
  }
}
