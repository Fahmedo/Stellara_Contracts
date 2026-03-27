import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggingModule } from './logging.module';
import { StructuredLoggerService } from './services/structured-logger.service';
import { AsyncContextService } from './services/async-context.service';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { RequestLoggingInterceptor } from './interceptors/request-logging.interceptor';

describe('LoggingModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              LOG_LEVEL: 'debug',
              LOG_PRETTY_PRINT: false,
              SERVICE_NAME: 'test-service',
            }),
          ],
        }),
        LoggingModule.forRoot({
          enableRequestLogging: true,
          enablePerformanceTracing: true,
        }),
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide StructuredLoggerService', () => {
    const logger = module.get<StructuredLoggerService>(StructuredLoggerService);
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(StructuredLoggerService);
  });

  it('should provide AsyncContextService', () => {
    const asyncContext = module.get<AsyncContextService>(AsyncContextService);
    expect(asyncContext).toBeDefined();
    expect(asyncContext).toBeInstanceOf(AsyncContextService);
  });

  it('should provide CorrelationIdMiddleware', () => {
    const middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
    expect(middleware).toBeDefined();
    expect(middleware).toBeInstanceOf(CorrelationIdMiddleware);
  });

  it('should provide RequestLoggingInterceptor', () => {
    const interceptor = module.get<RequestLoggingInterceptor>(RequestLoggingInterceptor);
    expect(interceptor).toBeDefined();
    expect(interceptor).toBeInstanceOf(RequestLoggingInterceptor);
  });
});

describe('StructuredLoggerService', () => {
  let logger: StructuredLoggerService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              LOG_LEVEL: 'debug',
              LOG_PRETTY_PRINT: false,
              SERVICE_NAME: 'test-service',
            }),
          ],
        }),
        LoggingModule.forRoot(),
      ],
    }).compile();

    logger = module.get<StructuredLoggerService>(StructuredLoggerService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(logger['pino'], 'info');
    logger.log('Test message', 'TestContext');
    expect(spy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(logger['pino'], 'error');
    logger.error('Test error', 'Test trace', 'TestContext');
    expect(spy).toHaveBeenCalled();
  });

  it('should log warning messages', () => {
    const spy = jest.spyOn(logger['pino'], 'warn');
    logger.warn('Test warning', 'TestContext');
    expect(spy).toHaveBeenCalled();
  });

  it('should log debug messages', () => {
    const spy = jest.spyOn(logger['pino'], 'debug');
    logger.debug('Test debug', 'TestContext');
    expect(spy).toHaveBeenCalled();
  });

  it('should set context', () => {
    logger.setContext('NewContext');
    expect(logger['context']).toBe('NewContext');
  });

  it('should create performance traces', () => {
    const trace = logger.startTrace('test-operation', { key: 'value' });
    expect(trace).toBeDefined();
    expect(trace.end).toBeDefined();
  });
});

describe('AsyncContextService', () => {
  let asyncContext: AsyncContextService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [AsyncContextService],
    }).compile();

    asyncContext = module.get<AsyncContextService>(AsyncContextService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should run within context', () => {
    asyncContext.run(() => {
      // When inside a run(), the namespace should have an active context
      expect(asyncContext.getNamespace()).toBeDefined();
    });
  });

  it('should set and get correlation ID', () => {
    asyncContext.run(() => {
      asyncContext.setCorrelationId('test-correlation-id');
      expect(asyncContext.getCorrelationId()).toBe('test-correlation-id');
    });
  });

  it('should set and get user ID', () => {
    asyncContext.run(() => {
      asyncContext.setUserId('test-user-id');
      expect(asyncContext.getUserId()).toBe('test-user-id');
    });
  });

  it('should set and get tenant ID', () => {
    asyncContext.run(() => {
      asyncContext.setTenantId('test-tenant-id');
      expect(asyncContext.getTenantId()).toBe('test-tenant-id');
    });
  });

  it('should generate and set correlation ID', () => {
    asyncContext.run(() => {
      const id = asyncContext.generateAndSetCorrelationId();
      expect(id).toBeDefined();
      expect(asyncContext.getCorrelationId()).toBe(id);
    });
  });

  it('should get full context', () => {
    asyncContext.run(() => {
      asyncContext.setCorrelationId('corr-id');
      asyncContext.setUserId('user-id');
      asyncContext.setTenantId('tenant-id');

      const context = asyncContext.getContext();
      expect(context).toEqual({
        correlationId: 'corr-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        requestId: undefined,
      });
    });
  });
});
