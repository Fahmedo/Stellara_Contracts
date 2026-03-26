import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StripeService } from './stripe.service';
import { InvoiceStatus } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async syncInvoiceFromStripe(stripeInvoiceId: string) {
    const stripeInvoice = await this.stripeService.getInvoice(stripeInvoiceId);

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeInvoice.subscription as string },
    });

    if (!subscription) {
      this.logger.warn(`Subscription not found for invoice ${stripeInvoiceId}`);
      return null;
    }

    const invoiceData = {
      subscriptionId: subscription.id,
      tenantId: subscription.tenantId,
      stripeInvoiceId: stripeInvoice.id,
      status: this.mapStripeInvoiceStatus(stripeInvoice.status),
      amountDue: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency,
      pdfUrl: stripeInvoice.invoice_pdf,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url,
      invoiceNumber: stripeInvoice.number,
      dueDate: stripeInvoice.due_date
        ? new Date(stripeInvoice.due_date * 1000)
        : null,
      paidAt: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
        : null,
    };

    const existing = await this.prisma.invoice.findUnique({
      where: { stripeInvoiceId },
    });

    if (existing) {
      return this.prisma.invoice.update({
        where: { id: existing.id },
        data: invoiceData,
      });
    }

    return this.prisma.invoice.create({
      data: invoiceData,
    });
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async getInvoiceByStripeId(stripeInvoiceId: string) {
    return this.prisma.invoice.findUnique({
      where: { stripeInvoiceId },
    });
  }

  async listInvoices(tenantId: string, limit: number = 12, offset: number = 0) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getUpcomingInvoice(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    try {
      const upcomingInvoice = await this.stripeService
        .getClient()
        .invoices.retrieveUpcoming({
          customer: subscription.stripeCustomerId,
          subscription: subscription.stripeSubscriptionId,
        });

      return {
        amountDue: upcomingInvoice.amount_due,
        currency: upcomingInvoice.currency,
        dueDate: upcomingInvoice.due_date
          ? new Date(upcomingInvoice.due_date * 1000)
          : null,
        periodStart: new Date(upcomingInvoice.period_start * 1000),
        periodEnd: new Date(upcomingInvoice.period_end * 1000),
        lines: upcomingInvoice.lines.data.map((line) => ({
          description: line.description,
          amount: line.amount,
          quantity: line.quantity,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve upcoming invoice: ${error.message}`);
      throw new NotFoundException('Could not retrieve upcoming invoice');
    }
  }

  async getInvoiceStats(tenantId: string) {
    const [totalInvoices, paidInvoices, unpaidInvoices, totalRevenue] = await Promise.all([
      this.prisma.invoice.count({
        where: { tenantId },
      }),
      this.prisma.invoice.count({
        where: { tenantId, status: InvoiceStatus.PAID },
      }),
      this.prisma.invoice.count({
        where: {
          tenantId,
          status: {
            in: [InvoiceStatus.OPEN, InvoiceStatus.DRAFT],
          },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: InvoiceStatus.PAID,
        },
        _sum: {
          amountPaid: true,
        },
      }),
    ]);

    return {
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      totalRevenue: totalRevenue._sum.amountPaid || 0,
    };
  }

  private mapStripeInvoiceStatus(
    stripeStatus: Stripe.Invoice.Status | null,
  ): InvoiceStatus {
    if (!stripeStatus) return InvoiceStatus.DRAFT;

    const statusMap: Record<string, InvoiceStatus> = {
      draft: InvoiceStatus.DRAFT,
      open: InvoiceStatus.OPEN,
      paid: InvoiceStatus.PAID,
      uncollectible: InvoiceStatus.UNCOLLECTIBLE,
      void: InvoiceStatus.VOID,
    };

    return statusMap[stripeStatus] || InvoiceStatus.DRAFT;
  }
}
