import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Entities
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagEvaluation } from './entities/feature-flag-evaluation.entity';
import { Experiment } from './entities/experiment.entity';
import { ExperimentVariant } from './entities/experiment-variant.entity';

// Services
import { FeatureFlagService } from './services/feature-flag.service';
import { ExperimentService } from './services/experiment.service';
import { EvaluationService } from './services/evaluation.service';

// Controllers
import { FeatureFlagController } from './controllers/feature-flag.controller';
import { ExperimentController } from './controllers/experiment.controller';

// Decorators
import { FeatureGuard } from './decorators/feature-guard.decorator';

// Import other modules
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeatureFlag,
      FeatureFlagEvaluation,
      Experiment,
      ExperimentVariant,
    ]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService) => ({
        timeout: configService.get('HTTP_TIMEOUT', 30000),
        maxRedirects: configService.get('HTTP_MAX_REDIRECTS', 5),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [
    FeatureFlagController,
    ExperimentController,
  ],
  providers: [
    // Services
    FeatureFlagService,
    ExperimentService,
    EvaluationService,
    
    // Decorators
    FeatureGuard,
  ],
  exports: [
    FeatureFlagService,
    ExperimentService,
    EvaluationService,
    TypeOrmModule,
  ],
})
export class FeatureFlagModule {}
