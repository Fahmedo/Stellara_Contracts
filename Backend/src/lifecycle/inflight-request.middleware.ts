import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ApplicationStateService } from './application-state.service';

@Injectable()
export class InflightRequestMiddleware implements NestMiddleware {
  constructor(private readonly appState: ApplicationStateService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.appState.shouldRejectIncomingRequest(req.path)) {
      res.status(503).json({
        message: 'Service is draining requests for shutdown',
        ...this.appState.getReadinessSnapshot(),
      });
      return;
    }

    this.appState.incrementActiveRequests();

    let settled = false;
    const finalize = () => {
      if (settled) {
        return;
      }

      settled = true;
      this.appState.decrementActiveRequests();
    };

    res.on('finish', finalize);
    res.on('close', finalize);

    next();
  }
}
