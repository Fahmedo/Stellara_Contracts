import * as cookieParser from 'cookie-parser';

import { ClsMiddleware, CorrelationIdMiddleware, RequestLoggingInterceptor, StructuredLoggerService } from './logging';

import { AppModule } from './app.module';
import { AuditInterceptor } from './audit';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap () {
  // Create app with buffer logs to ensure we can use our custom logger
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(StructuredLoggerService);
  const clsMiddleware = app.get(ClsMiddleware);
  const correlationIdMiddleware = app.get(CorrelationIdMiddleware);

  // Use structured logger
  app.useLogger(logger);

  // CLS middleware must be first to set up async context
  app.use(clsMiddleware.getMiddleware());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Global middleware
  app.use(cookieParser());

  // Correlation ID middleware for all routes
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global rate limiting guard (user/IP-based)
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new UserThrottlerGuard(reflector));

  // Global request logging interceptor
  const requestLoggingInterceptor = app.get(RequestLoggingInterceptor);
  app.useGlobalInterceptors(requestLoggingInterceptor);

  // Global audit interceptor for comprehensive action logging
  const auditInterceptor = app.get(AuditInterceptor);
  app.useGlobalInterceptors(auditInterceptor);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  logger.log(`Environment: ${configService.get<string>('NODE_ENV', 'development')}`, 'Bootstrap');
  logger.log(`Log level: ${configService.get<string>('LOG_LEVEL', 'info')}`, 'Bootstrap');
  logger.log(`Audit logging: enabled`, 'Bootstrap');
}

bootstrap();
