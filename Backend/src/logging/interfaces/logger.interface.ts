import { LogLevel } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

export interface PerformanceTrace {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  prettyPrint: boolean;
  colorize: boolean;
  timestamp: boolean;
  includeContext: boolean;
  redactFields: string[];
  serializers: Record<string, (value: any) => any>;
}

export interface StructuredLogEntry {
  level: string;
  time: string;
  msg: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  service?: string;
  env?: string;
  [key: string]: any;
}

export interface ExternalLoggerConfig {
  enabled: boolean;
  type: 'elk' | 'datadog' | 'newrelic' | 'custom';
  endpoint?: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
}
