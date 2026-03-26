import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UsageService } from './usage.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateUsageRecordDto } from './dto/create-usage-record.dto';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireSubscription } from './decorators/require-subscription.decorator';

@Controller('api/v1/payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageService: UsageService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  // Subscription endpoints
  @Post('subscriptions')
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.createSubscription(
      dto.tenantId,
      dto.planId,
      dto.email || '',
      dto.name || '',
      dto.paymentMethodId,
    );
  }

  @Get('subscriptions/:id')
  async getSubscription(@Param('id') id: string) {
    return this.subscriptionService.getSubscription(id);
  }

  @Get('subscriptions/tenant/:tenantId')
  async getSubscriptionByTenant(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.getSubscriptionByTenant(tenantId);
  }

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(
      id,
      dto.planId,
      dto.cancelAtPeriodEnd,
    );
  }

  @Delete('subscriptions/:id')
  async cancelSubscription(
    @Param('id') id: string,
    @Query('immediate') immediate?: string,
  ) {
    return this.subscriptionService.cancelSubscription(
      id,
      immediate === 'true',
    );
  }

  @Get('plans')
  async listPlans() {
    return this.subscriptionService.listSubscriptionPlans();
  }

  // Usage endpoints
  @Post('usage')
  @RequireSubscription()
  async recordUsage(@Body() dto: CreateUsageRecordDto) {
    return this.usageService.recordUsage(
      dto.tenantId,
      dto.metricName,
      dto.quantity,
      dto.timestamp ? new Date(dto.timestamp * 1000) : undefined,
    );
  }

  @Get('usage/tenant/:tenantId')
  async getUsageHistory(
    @Param('tenantId') tenantId: string,
    @Query('metric') metric?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.usageService.getUsageHistory(
      tenantId,
      metric,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('usage/tenant/:tenantId/current')
  async getCurrentPeriodUsage(@Param('tenantId') tenantId: string) {
    return this.usageService.getCurrentPeriodUsage(tenantId);
  }

  @Get('usage/tenant/:tenantId/summary')
  async getUsageSummary(
    @Param('tenantId') tenantId: string,
    @Query('start') startDate: string,
    @Query('end') endDate: string,
  ) {
    return this.usageService.getUsageSummary(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  // Invoice endpoints
  @Get('invoices/tenant/:tenantId')
  async listInvoices(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.invoiceService.listInvoices(
      tenantId,
      limit ? parseInt(limit, 10) : 12,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    return this.invoiceService.getInvoice(id);
  }

  @Get('invoices/tenant/:tenantId/upcoming')
  async getUpcomingInvoice(@Param('tenantId') tenantId: string) {
    return this.invoiceService.getUpcomingInvoice(tenantId);
  }

  @Get('invoices/tenant/:tenantId/stats')
  async getInvoiceStats(@Param('tenantId') tenantId: string) {
    return this.invoiceService.getInvoiceStats(tenantId);
  }

  // Payment methods
  @Post('payment-methods')
  async attachPaymentMethod(@Body() dto: AttachPaymentMethodDto) {
    const subscription = await this.subscriptionService.getSubscriptionByTenant(
      dto.tenantId,
    );

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await this.stripeService.attachPaymentMethod(
      subscription.stripeCustomerId,
      dto.paymentMethodId,
    );

    if (dto.setAsDefault !== false) {
      await this.stripeService.setDefaultPaymentMethod(
        subscription.stripeCustomerId,
        dto.paymentMethodId,
      );
    }

    return { success: true };
  }

  // Payment history
  @Get('history/tenant/:tenantId')
  async getPaymentHistory(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentService.getPaymentHistory(
      tenantId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
