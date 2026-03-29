import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { PrismaService } from '../prisma.service';
import { ENTITY_TYPES, IdentityEvidenceDto, IdentityEntityType } from './dto/identity-graph.dto';

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
}

export interface LinkGraphResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  confidenceScore: number;
}

const ENTITY_TYPE_SET = new Set<IdentityEntityType>(ENTITY_TYPES as readonly IdentityEntityType[]);

@Injectable()
export class CustomerIdentityGraphService implements OnModuleDestroy {
  private readonly logger = new Logger(CustomerIdentityGraphService.name);
  private readonly driver: Driver;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const uri = this.config.get<string>('NEO4J_URI') || 'neo4j://localhost:7687';
    const user = this.config.get<string>('NEO4J_USER') || 'neo4j';
    const password = this.config.get<string>('NEO4J_PASSWORD') || 'neo4j';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  async ingestIdentityEvidence(payload: IdentityEvidenceDto) {
    const source = payload.source || 'identity-service';
    const confidenceScore = this.calculateConfidence(payload);
    const session = this.driver.session();

    try {
      await session.executeWrite(async (tx) => {
        await this.mergeIdentityNodes(tx, payload, source);
        await this.mergeIdentityRelationships(tx, payload, source, confidenceScore);
        await this.createHouseholdOrganizationLinks(tx, payload, source, confidenceScore);
        await this.createAuditEntry(tx, payload.userId || payload.deviceId || 'anonymous', source, confidenceScore);
      });

      return {
        status: 'success',
        confidenceScore,
        message: 'Identity evidence ingested and graph updated.',
      };
    } catch (error) {
      this.logger.error('Failed to ingest identity evidence', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getLinkGraph(entityType: string, entityValue: string, depth = 2): Promise<LinkGraphResult> {
    const normalizedType = this.normalizeEntityType(entityType);
    const { label, property } = this.getEntityMapping(normalizedType);
    const session = this.driver.session();

    try {
      const result = await session.executeRead((tx) =>
        tx.run(
          `MATCH path=(root:${label} {${property}: $value})-[*1..$depth]-(neighbor)
           RETURN nodes(path) AS nodes, relationships(path) AS rels
           LIMIT 300`,
          { value: entityValue, depth: neo4j.int(depth) },
        ),
      );

      const records = result.records || [];
      const nodes: Record<string, GraphNode> = {};
      const relationships: Record<string, GraphRelationship> = {};

      records.forEach((record) => {
        const rawNodes = record.get('nodes') || [];
        const rawRels = record.get('rels') || [];

        rawNodes.forEach((node: any) => {
          nodes[node.identity.toString()] = {
            id: node.identity.toString(),
            labels: node.labels,
            properties: node.properties,
          };
        });

        rawRels.forEach((rel: any) => {
          relationships[rel.identity.toString()] = {
            id: rel.identity.toString(),
            type: rel.type,
            startNode: rel.start.toString(),
            endNode: rel.end.toString(),
            properties: rel.properties,
          };
        });
      });

      return {
        nodes: Object.values(nodes),
        relationships: Object.values(relationships),
        confidenceScore: this.estimateGraphConfidence(Object.values(relationships)),
      };
    } finally {
      await session.close();
    }
  }

  async exportUserGraphData(userId: string) {
    const graph = await this.getLinkGraph('user', userId, 3);
    return {
      userId,
      exportedAt: new Date().toISOString(),
      graph,
    };
  }

  async eraseUserGraphData(userId: string) {
    const session = this.driver.session();
    try {
      await session.executeWrite((tx) =>
        tx.run(
          `MATCH (u:User {id: $userId})
           OPTIONAL MATCH (u)-[r]-()
           DELETE r, u`,
          { userId },
        ),
      );

      await session.executeWrite((tx) =>
        tx.run(
          `MATCH (n)
           WHERE (n:Email OR n:Phone OR n:IPAddress OR n:WalletAddress OR n:SSNHash OR n:Device OR n:Fingerprint)
             AND size((n)--()) = 0
           DELETE n`,
        ),
      );

      await session.executeWrite((tx) =>
        tx.run(
          `CREATE (e:ErasureAudit {userId: $userId, erasedAt: datetime()})`,
          { userId },
        ),
      );

      return {
        status: 'erased',
        userId,
        erasedAt: new Date().toISOString(),
      };
    } finally {
      await session.close();
    }
  }

  async detectSyntheticIdentityRisk(userId: string) {
    const graph = await this.getLinkGraph('user', userId, 3);
    const usersByDevice = new Set<string>();
    const sharedIpUsers = new Set<string>();
    const emailCount = new Set<string>();
    const deviceCount = new Set<string>();
    const suspiciousEdges: string[] = [];

    graph.relationships.forEach((rel) => {
      const start = graph.nodes.find((node) => node.id === rel.startNode);
      const end = graph.nodes.find((node) => node.id === rel.endNode);
      if (!start || !end) return;

      if (rel.type === 'USED_BY' && start.labels.includes('Device') && end.labels.includes('User')) {
        deviceCount.add(start.properties.id || start.properties.value);
      }

      if (rel.type === 'SEEN_AT' && start.labels.includes('IPAddress') && end.labels.includes('User')) {
        sharedIpUsers.add(end.properties.id);
      }

      if (rel.type === 'HAS_EMAIL' && start.labels.includes('Email') && end.labels.includes('User')) {
        emailCount.add(start.properties.value);
      }

      if (rel.properties?.confidence && rel.properties.confidence < 50) {
        suspiciousEdges.push(`${rel.type} (${start.labels[0]} -> ${end.labels[0]})`);
      }
    });

    const riskScore = Math.min(
      100,
      10 + deviceCount.size * 12 + sharedIpUsers.size * 8 + emailCount.size * 6 + suspiciousEdges.length * 5,
    );
    return {
      userId,
      syntheticRiskScore: riskScore,
      indicators: {
        sharedDevices: deviceCount.size,
        sharedIps: sharedIpUsers.size,
        linkedEmails: emailCount.size,
        suspiciousRelationships: suspiciousEdges,
      },
      isSynthetic: riskScore >= 65,
    };
  }

  private getEntityMapping(entityType: IdentityEntityType) {
    switch (entityType) {
      case 'user':
        return { label: 'User', property: 'id' };
      case 'device':
        return { label: 'Device', property: 'id' };
      case 'email':
        return { label: 'Email', property: 'value' };
      case 'phone':
        return { label: 'Phone', property: 'value' };
      case 'ip':
        return { label: 'IPAddress', property: 'value' };
      case 'wallet':
        return { label: 'WalletAddress', property: 'value' };
      case 'ssnHash':
        return { label: 'SSNHash', property: 'value' };
      case 'fingerprint':
        return { label: 'Fingerprint', property: 'value' };
      case 'household':
        return { label: 'Household', property: 'id' };
      case 'organization':
        return { label: 'Organization', property: 'id' };
      default:
        return { label: 'User', property: 'id' };
    }
  }

  private normalizeEntityType(entityType: string): IdentityEntityType {
    const normalized = entityType.trim();
    if (ENTITY_TYPE_SET.has(normalized as IdentityEntityType)) {
      return normalized as IdentityEntityType;
    }
    return 'user';
  }

  private calculateConfidence(payload: IdentityEvidenceDto): number {
    let score = 10;
    if (payload.userId) score += 20;
    if (payload.deviceId) score += 18;
    if (payload.email) score += 15;
    if (payload.phone) score += 12;
    if (payload.ip) score += 8;
    if (payload.walletAddress) score += 14;
    if (payload.ssnHash) score += 20;
    if (payload.fingerprint) score += 18;
    if (payload.householdId) score += 6;
    if (payload.organizationId) score += 6;
    return Math.min(100, score);
  }

  private estimateGraphConfidence(relationships: GraphRelationship[]) {
    if (!relationships.length) return 0;
    const sum = relationships.reduce((acc, rel) => acc + (Number(rel.properties.confidence) || 0), 0);
    return Math.round(sum / relationships.length);
  }

  private async mergeIdentityNodes(tx: Session, payload: IdentityEvidenceDto, source: string) {
    const now = new Date().toISOString();
    const props = { source, updatedAt: now };

    if (payload.userId) {
      await tx.run(
        `MERGE (u:User {id: $userId})
         ON CREATE SET u.createdAt = datetime(), u.source = $source
         SET u.lastSeen = datetime(), u.updatedAt = $updatedAt`,
        { ...props, userId: payload.userId },
      );
    }
    if (payload.deviceId) {
      await tx.run(
        `MERGE (d:Device {id: $deviceId})
         ON CREATE SET d.createdAt = datetime(), d.source = $source
         SET d.lastSeen = datetime(), d.updatedAt = $updatedAt`,
        { ...props, deviceId: payload.deviceId },
      );
    }
    if (payload.email) {
      await tx.run(
        `MERGE (e:Email {value: $email})
         ON CREATE SET e.createdAt = datetime(), e.source = $source
         SET e.lastSeen = datetime(), e.updatedAt = $updatedAt`,
        { ...props, email: payload.email.toLowerCase() },
      );
    }
    if (payload.phone) {
      await tx.run(
        `MERGE (p:Phone {value: $phone})
         ON CREATE SET p.createdAt = datetime(), p.source = $source
         SET p.lastSeen = datetime(), p.updatedAt = $updatedAt`,
        { ...props, phone: payload.phone },
      );
    }
    if (payload.ip) {
      await tx.run(
        `MERGE (ip:IPAddress {value: $ip})
         ON CREATE SET ip.createdAt = datetime(), ip.source = $source
         SET ip.lastSeen = datetime(), ip.updatedAt = $updatedAt`,
        { ...props, ip: payload.ip },
      );
    }
    if (payload.walletAddress) {
      await tx.run(
        `MERGE (w:WalletAddress {value: $walletAddress})
         ON CREATE SET w.createdAt = datetime(), w.source = $source
         SET w.lastSeen = datetime(), w.updatedAt = $updatedAt`,
        { ...props, walletAddress: payload.walletAddress },
      );
    }
    if (payload.ssnHash) {
      await tx.run(
        `MERGE (s:SSNHash {value: $ssnHash})
         ON CREATE SET s.createdAt = datetime(), s.source = $source
         SET s.lastSeen = datetime(), s.updatedAt = $updatedAt`,
        { ...props, ssnHash: payload.ssnHash },
      );
    }
    if (payload.fingerprint) {
      await tx.run(
        `MERGE (f:Fingerprint {value: $fingerprint})
         ON CREATE SET f.createdAt = datetime(), f.source = $source
         SET f.lastSeen = datetime(), f.updatedAt = $updatedAt`,
        { ...props, fingerprint: payload.fingerprint },
      );
    }
    if (payload.householdId) {
      await tx.run(
        `MERGE (h:Household {id: $householdId})
         ON CREATE SET h.createdAt = datetime(), h.source = $source
         SET h.updatedAt = $updatedAt`,
        { ...props, householdId: payload.householdId },
      );
    }
    if (payload.organizationId) {
      await tx.run(
        `MERGE (o:Organization {id: $organizationId})
         ON CREATE SET o.createdAt = datetime(), o.source = $source
         SET o.updatedAt = $updatedAt`,
        { ...props, organizationId: payload.organizationId },
      );
    }
  }

  private async mergeIdentityRelationships(tx: Session, payload: IdentityEvidenceDto, source: string, confidenceScore: number) {
    const relationshipProperties = {
      source,
      confidence: confidenceScore,
      updatedAt: new Date().toISOString(),
    };

    if (payload.deviceId && payload.userId) {
      await tx.run(
        `MATCH (d:Device {id: $deviceId}), (u:User {id: $userId})
         MERGE (d)-[r:USED_BY]->(u)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, deviceId: payload.deviceId, userId: payload.userId },
      );
    }
    if (payload.userId && payload.email) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (e:Email {value: $email})
         MERGE (u)-[r:HAS_EMAIL]->(e)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, email: payload.email.toLowerCase() },
      );
    }
    if (payload.userId && payload.phone) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (p:Phone {value: $phone})
         MERGE (u)-[r:HAS_PHONE]->(p)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, phone: payload.phone },
      );
    }
    if (payload.userId && payload.ip) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (ip:IPAddress {value: $ip})
         MERGE (u)-[r:SEEN_AT]->(ip)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, ip: payload.ip },
      );
    }
    if (payload.userId && payload.walletAddress) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (w:WalletAddress {value: $walletAddress})
         MERGE (u)-[r:OWNS_WALLET]->(w)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, walletAddress: payload.walletAddress },
      );
    }
    if (payload.userId && payload.ssnHash) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (s:SSNHash {value: $ssnHash})
         MERGE (u)-[r:HAS_SSN_HASH]->(s)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, ssnHash: payload.ssnHash },
      );
    }
    if (payload.userId && payload.fingerprint) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (f:Fingerprint {value: $fingerprint})
         MERGE (u)-[r:HAS_FINGERPRINT]->(f)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, fingerprint: payload.fingerprint },
      );
    }
  }

  private async createHouseholdOrganizationLinks(tx: Session, payload: IdentityEvidenceDto, source: string, confidenceScore: number) {
    const relationshipProperties = {
      source,
      confidence: confidenceScore,
      updatedAt: new Date().toISOString(),
    };

    if (payload.userId && payload.householdId) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (h:Household {id: $householdId})
         MERGE (u)-[r:BELONGS_TO]->(h)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, householdId: payload.householdId },
      );
    }
    if (payload.householdId && payload.organizationId) {
      await tx.run(
        `MATCH (h:Household {id: $householdId}), (o:Organization {id: $organizationId})
         MERGE (h)-[r:PART_OF]->(o)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, householdId: payload.householdId, organizationId: payload.organizationId },
      );
    }
    if (payload.userId && payload.organizationId && !payload.householdId) {
      await tx.run(
        `MATCH (u:User {id: $userId}), (o:Organization {id: $organizationId})
         MERGE (u)-[r:MEMBER_OF]->(o)
         SET r.confidence = $confidence, r.source = $source, r.updatedAt = datetime()`,
        { ...relationshipProperties, userId: payload.userId, organizationId: payload.organizationId },
      );
    }
  }

  private async createAuditEntry(tx: Session, entityId: string, source: string, confidenceScore: number) {
    await tx.run(
      `CREATE (a:IdentityGraphAudit {
        id: randomUUID(),
        entityId: $entityId,
        source: $source,
        confidenceScore: $confidenceScore,
        createdAt: datetime()
      })`,
      { entityId, source, confidenceScore },
    );
  }
}
