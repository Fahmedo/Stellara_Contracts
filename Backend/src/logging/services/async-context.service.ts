import { Injectable, Scope } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { v4 as uuidv4 } from 'uuid';
import { LogContext } from '../interfaces/logger.interface';

const NAMESPACE_NAME = 'stellara-logging-context';

@Injectable({ scope: Scope.DEFAULT })
export class AsyncContextService {
  private namespace: cls.Namespace;

  constructor() {
    this.namespace = cls.getNamespace(NAMESPACE_NAME) || cls.createNamespace(NAMESPACE_NAME);
  }

  /**
   * Run a function within a new async context
   */
  run<T>(callback: () => T): T {
    return this.namespace.runAndReturn(callback);
  }

  /**
   * Run a function within a new async context with a correlation ID
   */
  runWithCorrelationId<T>(correlationId: string, callback: () => T): T {
    return this.namespace.runAndReturn(() => {
      this.setCorrelationId(correlationId);
      return callback();
    });
  }

  /**
   * Get the current correlation ID from the async context
   */
  getCorrelationId(): string | undefined {
    return this.namespace.get('correlationId');
  }

  /**
   * Set the correlation ID in the async context
   */
  setCorrelationId(correlationId: string): void {
    this.namespace.set('correlationId', correlationId);
  }

  /**
   * Generate and set a new correlation ID
   */
  generateAndSetCorrelationId(): string {
    const correlationId = uuidv4();
    this.setCorrelationId(correlationId);
    return correlationId;
  }

  /**
   * Get the current user ID from the async context
   */
  getUserId(): string | undefined {
    return this.namespace.get('userId');
  }

  /**
   * Set the user ID in the async context
   */
  setUserId(userId: string): void {
    this.namespace.set('userId', userId);
  }

  /**
   * Get the current tenant ID from the async context
   */
  getTenantId(): string | undefined {
    return this.namespace.get('tenantId');
  }

  /**
   * Set the tenant ID in the async context
   */
  setTenantId(tenantId: string): void {
    this.namespace.set('tenantId', tenantId);
  }

  /**
   * Get the current request ID from the async context
   */
  getRequestId(): string | undefined {
    return this.namespace.get('requestId');
  }

  /**
   * Set the request ID in the async context
   */
  setRequestId(requestId: string): void {
    this.namespace.set('requestId', requestId);
  }

  /**
   * Get all context data from the async context
   */
  getContext(): LogContext {
    return {
      correlationId: this.getCorrelationId(),
      userId: this.getUserId(),
      tenantId: this.getTenantId(),
      requestId: this.getRequestId(),
    };
  }

  /**
   * Set multiple context values at once
   */
  setContext(context: Partial<LogContext>): void {
    if (context.correlationId) this.setCorrelationId(context.correlationId);
    if (context.userId) this.setUserId(context.userId);
    if (context.tenantId) this.setTenantId(context.tenantId);
    if (context.requestId) this.setRequestId(context.requestId);
  }

  /**
   * Get a custom value from the async context
   */
  get<T>(key: string): T | undefined {
    return this.namespace.get(key);
  }

  /**
   * Set a custom value in the async context
   */
  set<T>(key: string, value: T): void {
    this.namespace.set(key, value);
  }

  /**
   * Check if we're currently in an async context
   */
  isActive(): boolean {
    return this.namespace.active;
  }

  /**
   * Get the underlying namespace for middleware use
   */
  getNamespace(): cls.Namespace {
    return this.namespace;
  }
}
