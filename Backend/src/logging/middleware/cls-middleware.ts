import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cls from 'cls-hooked';

const NAMESPACE_NAME = 'stellara-logging-context';

/**
 * Express middleware for async context using cls-hooked
 * This should be registered BEFORE any other middleware that needs context
 */
@Injectable()
export class ClsMiddleware implements OnModuleInit, OnModuleDestroy {
  private namespace: cls.Namespace;

  constructor(private readonly configService: ConfigService) {
    this.namespace = cls.getNamespace(NAMESPACE_NAME) || cls.createNamespace(NAMESPACE_NAME);
  }

  onModuleInit() {
    // Ensure namespace is created
    if (!cls.getNamespace(NAMESPACE_NAME)) {
      cls.createNamespace(NAMESPACE_NAME);
    }
  }

  onModuleDestroy() {
    // Clean up namespace if needed
  }

  /**
   * Get the Express middleware function
   */
  getMiddleware() {
    return (req: any, res: any, next: any) => {
      this.namespace.run(() => {
        next();
      });
    };
  }

  /**
   * Get the namespace for use in other services
   */
  getNamespace(): cls.Namespace {
    return this.namespace;
  }
}
