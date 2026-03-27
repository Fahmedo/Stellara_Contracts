export enum ConfigScope {
  GLOBAL = 'GLOBAL',
  TENANT = 'TENANT',
  USER = 'USER',
}

export interface ConfigEntry {
  key: string;
  value: string;
  scope: ConfigScope;
  tenantId?: string;
  userId?: string;
  encrypted?: boolean;
}

export interface FeatureFlagEntry {
  key: string;
  enabled: boolean;
  tenantId?: string;
  rolloutPct: number;
  metadata?: Record<string, unknown>;
}

export interface ConfigAuditEntry {
  key: string;
  oldValue?: string;
  newValue?: string;
  scope: ConfigScope;
  tenantId?: string;
  actorId?: string;
  action: 'SET' | 'DELETE' | 'ROTATE_SECRET';
}
