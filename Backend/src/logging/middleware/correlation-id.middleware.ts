import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncContextService } from '../services/async-context.service';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly asyncContext: AsyncContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Get correlation ID from various sources or generate a new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      (req.headers['request-id'] as string) ||
      uuidv4();

    // Set correlation ID in async context
    this.asyncContext.setCorrelationId(correlationId);

    // Extract and set user context if available
    if (req.user) {
      this.asyncContext.setUserId(req.user.id || req.user.sub);
      if (req.user.tenantId) {
        this.asyncContext.setTenantId(req.user.tenantId);
      }
    }

    // Set request ID
    this.asyncContext.setRequestId(uuidv4());

    // Set correlation ID header on response
    res.setHeader('X-Correlation-ID', correlationId);

    // Continue to next middleware
    next();
  }
}
