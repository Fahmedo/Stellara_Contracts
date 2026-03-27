import { LoggerService } from '@nestjs/common';

export interface LoggingModuleOptions {
  /**
   * Custom logger service implementation
   */
  loggerService?: new (...args: any[]) => LoggerService;

  /**
   * Default context for logs
   */
  defaultContext?: string;

  /**
   * Enable request/response logging
   */
  enableRequestLogging?: boolean;

  /**
   * Enable performance tracing
   */
  enablePerformanceTracing?: boolean;

  /**
   * Exclude certain routes from logging
   */
  excludeRoutes?: string[];

  /**
   * Include request body in logs (use with caution)
   */
  includeRequestBody?: boolean;

  /**
   * Include response body in logs (use with caution)
   */
  includeResponseBody?: boolean;

  /**
   * Redact sensitive fields from logs
   */
  redactFields?: string[];

  /**
   * External logging configuration
   */
  externalLogging?: {
    enabled: boolean;
    type: 'elk' | 'datadog' | 'newrelic' | 'custom';
    endpoint?: string;
    apiKey?: string;
  };
}
