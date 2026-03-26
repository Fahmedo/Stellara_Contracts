import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PaymentService } from '../payment.service';
import { REQUIRE_SUBSCRIPTION_KEY } from '../decorators/require-subscription.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly paymentService: PaymentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireSubscription = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireSubscription) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.body?.tenantId || request.params?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    const isActive = await this.paymentService.isSubscriptionActive(tenantId);

    if (!isActive) {
      throw new ForbiddenException(
        'Active subscription required to access this resource',
      );
    }

    return true;
  }
}
