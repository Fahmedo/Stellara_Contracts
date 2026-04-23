import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ReputationOracleService } from './reputation-oracle.service';

@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationOracle: ReputationOracleService) {}

  @Get(':userId')
  async getReputation(@Param('userId') userId: string) {
    return this.reputationOracle.aggregateSignals(userId);
  }

  @Post('signal')
  async submitSignal(@Body() data: { userId: string, source: string, value: number, weight: number, metadata?: any }) {
    return this.reputationOracle.submitSignal(data);
  }

  @Post('endorse')
  async submitEndorsement(@Body() data: { fromUserId: string, toUserId: string, weight: number, comment?: string }) {
    return this.reputationOracle.submitEndorsement(data.fromUserId, data.toUserId, data.weight, data.comment);
  }

  @Get(':userId/proof')
  async getReputationProof(@Param('userId') userId: string, @Query('threshold') threshold: string) {
    const t = threshold ? parseInt(threshold) : 50;
    return this.reputationOracle.generateReputationProof(userId, t);
  }

  @Post('dispute/:disputeId/resolve')
  async resolveDispute(
    @Param('disputeId') disputeId: string, 
    @Body() data: { resolution: string, status: 'RESOLVED' | 'REJECTED' }
  ) {
    return this.reputationOracle.resolveDispute(disputeId, data.resolution, data.status);
  }
}
