import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface EventData {
  contractId: string;
  eventName: string;
  parameters: Record<string, any>;
  timestamp: number;
  transactionHash: string;
  ledger: number;
}

@Entity('indexed_events')
@Index(['contractId', 'eventName'])
@Index(['transactionHash'])
@Index(['ledger'])
export class IndexedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @Column({ name: 'event_name' })
  eventName: string;

  @Column({ type: 'jsonb' })
  eventData: EventData;

  @Column({ name: 'transaction_hash', unique: true })
  transactionHash: string;

  @Column({ name: 'ledger' })
  ledger: number;

  @Column({ name: 'cursor', unique: true })
  cursor: string;

  @Column({ name: 'processed_at' })
  processedAt: Date;

  @Column({ default: false })
  reprocessed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
