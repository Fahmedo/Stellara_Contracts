import { Controller, Get, Post } from '@nestjs/common';
import { SkipRateLimit } from '../common/decorators/skip-rate-limit.decorator';
import { IndexAnalysisService } from './index-analysis.service';

@Controller('index-analysis')
@SkipRateLimit()
export class IndexAnalysisController {
  constructor(private readonly indexAnalysisService: IndexAnalysisService) {}

  @Get('status')
  async getStatus(): Promise<any> {
    return this.indexAnalysisService.getStatus();
  }

  @Get('report')
  async getLatestReport(): Promise<any> {
    return this.indexAnalysisService.getLatestReport();
  }

  @Post('report')
  async generateReport(): Promise<any> {
    return this.indexAnalysisService.generateReport();
  }

  @Post('migration')
  async generateMigrationScript(): Promise<any> {
    return this.indexAnalysisService.generateMigrationScript();
  }
}
