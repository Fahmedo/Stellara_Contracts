import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ConfigAuditEntry } from '../interfaces/config.interfaces';

@Injectable()
export class ConfigAuditService {
  private readonly logger = new Logger(ConfigAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: ConfigAuditEntry): Promise<void> {
    try {
      await (this.prisma as any).configAuditLog.create({
        data: {
          key: entry.key,
          oldValue: entry.oldValue ?? null,
          newValue: entry.newValue ?? null,
          scope: entry.scope,
          tenantId: entry.tenantId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write config audit log for key "${entry.key}"`, err);
    }
  }

  async getAuditTrail(key: string, tenantId?: string) {
    return (this.prisma as any).configAuditLog.findMany({
      where: { key, ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
