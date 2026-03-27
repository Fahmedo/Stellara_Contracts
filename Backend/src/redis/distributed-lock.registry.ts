import type { DistributedLockService } from './distributed-lock.service';

export class DistributedLockRegistry {
  private static instance: DistributedLockService | null = null;

  static setInstance(instance: DistributedLockService): void {
    DistributedLockRegistry.instance = instance;
  }

  static getInstance(): DistributedLockService {
    if (!DistributedLockRegistry.instance) {
      throw new Error(
        'DistributedLockService is not initialized. Ensure RedisModule is loaded before using @distributedlock().',
      );
    }

    return DistributedLockRegistry.instance;
  }
}
