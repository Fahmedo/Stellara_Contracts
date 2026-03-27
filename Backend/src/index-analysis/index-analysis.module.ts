import { Module } from '@nestjs/common';
import { IndexAnalysisService } from './index-analysis.service';
import { IndexAnalysisController } from './index-analysis.controller';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  providers: [IndexAnalysisService],
  controllers: [IndexAnalysisController],
  exports: [IndexAnalysisService],
})
export class IndexAnalysisModule {}
