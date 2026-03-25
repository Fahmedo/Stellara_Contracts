import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { SkipRateLimit } from '../common/decorators/skip-rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Controller('rate-limit')
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Get('status')
  @SkipRateLimit()
  async getStatus(@Req() req: Request) {
    return this.rateLimitService.getStatus(req);
  }
}
