import { Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(@Inject('CACHE_MANAGER') private cacheManager: Cache) {}

  async getUserById(id: string) {
    const cached = await this.cacheManager.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    await this.cacheManager.set(`user:${id}`, user, { ttl: 300 }); // 5 min TTL
    return user;
  }

  async invalidateUserCache(id: string) {
    await this.cacheManager.del(`user:${id}`);
  }
}
