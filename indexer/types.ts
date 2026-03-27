/**
 * Standardized event types for Stellara contracts
 * These types mirror the on-chain event structures for off-chain indexing
 */

// =============================================================================
// Event Topic Constants
// =============================================================================

export const EVENT_TOPICS = {
  // Trading events
  TRADE_EXECUTED: 'trade',
  CONTRACT_PAUSED: 'paused',
  CONTRACT_UNPAUSED: 'unpause',
  FEE_COLLECTED: 'fee',

  // Token events
  TRANSFER: 'transfer',
  APPROVAL: 'approve',
  MINT: 'mint',
  BURN: 'burn',

  // Governance events
  PROPOSAL_CREATED: 'propose',
  PROPOSAL_APPROVED: 'approve',
  PROPOSAL_REJECTED: 'reject',
  PROPOSAL_EXECUTED: 'execute',
  PROPOSAL_CANCELLED: 'cancel',
  VOTE_CAST: 'vote',
  EMERGENCY_ACTION: 'emergency',

  // Staking events
  STAKE: 'stake',
  UNSTAKE: 'unstake',
  REWARD_CLAIMED: 'claimed',
  SLASHED: 'slashed',

  // Social rewards events
  REWARD_ADDED: 'reward',
  REWARD_CLAIMED_SOCIAL: 'claimed',

  // Vesting/Academy events
  GRANT_CREATED: 'grant',
  GRANT_CLAIMED: 'claim',
  GRANT_REVOKED: 'revoke',

  // Privacy events
  SHIELD: 'shield',
  UNSHIELD: 'unshield',
  PRIVATE_TRANSFER: 'private_transfer',

  // Yield farming events
  LIQUIDITY_ADDED: 'liquidity_added',
  LIQUIDITY_REMOVED: 'liquidity_removed',
  HARVEST: 'harvest',

  // Disaster recovery events
  EMERGENCY_PAUSE: 'emergency_pause',
  RECOVERY_INITIATED: 'recovery_started',
  RECOVERY_COMPLETED: 'recovery_completed',
} as const;

export type EventTopic = typeof EVENT_TOPICS[keyof typeof EVENT_TOPICS];

// =============================================================================
// Trading Events
// =============================================================================

export interface TradeExecutedEvent {
  trade_id: bigint;
  trader: string;
  pair: string;
  amount: bigint;
  price: bigint;
  is_buy: boolean;
  fee_amount: bigint;
  fee_token: string;
  timestamp: bigint;
}

export interface ContractPausedEvent {
  paused_by: string;
  timestamp: bigint;
}

export interface ContractUnpausedEvent {
  unpaused_by: string;
  timestamp: bigint;
}

export interface FeeCollectedEvent {
  payer: string;
  recipient: string;
  amount: bigint;
  token: string;
  timestamp: bigint;
}

// =============================================================================
// Governance Events
// =============================================================================

export interface ProposalCreatedEvent {
  proposal_id: bigint;
  proposer: string;
  new_contract_hash: string;
  target_contract: string;
  description: string;
  approval_threshold: number;
  timelock_delay: bigint;
  timestamp: bigint;
}

export interface ProposalApprovedEvent {
  proposal_id: bigint;
  approver: string;
  current_approvals: number;
  threshold: number;
  timestamp: bigint;
}

export interface ProposalRejectedEvent {
  proposal_id: bigint;
  rejector: string;
  timestamp: bigint;
}

export interface ProposalExecutedEvent {
  proposal_id: bigint;
  executor: string;
  new_contract_hash: string;
  timestamp: bigint;
}

export interface ProposalCancelledEvent {
  proposal_id: bigint;
  cancelled_by: string;
  timestamp: bigint;
}

// =============================================================================
// Social Rewards Events
// =============================================================================

export interface RewardAddedEvent {
  reward_id: bigint;
  user: string;
  amount: bigint;
  reward_type: string;
  reason: string;
  granted_by: string;
  timestamp: bigint;
}

export interface RewardClaimedEvent {
  reward_id: bigint;
  user: string;
  amount: bigint;
  timestamp: bigint;
}

// =============================================================================
// Vesting Events
// =============================================================================

export interface GrantEvent {
  grant_id: bigint;
  beneficiary: string;
  amount: bigint;
  start_time: bigint;
  cliff: bigint;
  duration: bigint;
  granted_at: bigint;
  granted_by: string;
}

export interface ClaimEvent {
  grant_id: bigint;
  beneficiary: string;
  amount: bigint;
  claimed_at: bigint;
}

export interface RevokeEvent {
  grant_id: bigint;
  beneficiary: string;
  revoked_at: bigint;
  revoked_by: string;
}

// =============================================================================
// Token Events
// =============================================================================

export interface TransferEvent {
  from: string;
  to: string;
  amount: bigint;
  token: string;
  timestamp: bigint;
}

export interface ApprovalEvent {
  owner: string;
  spender: string;
  amount: bigint;
  token: string;
  expiration_ledger: number;
  timestamp: bigint;
}

export interface MintEvent {
  to: string;
  amount: bigint;
  token: string;
  total_supply: bigint;
  timestamp: bigint;
}

export interface BurnEvent {
  from: string;
  amount: bigint;
  token: string;
  total_supply: bigint;
  timestamp: bigint;
}

// =============================================================================
// Staking Events
// =============================================================================

export interface StakeEvent {
  user: string;
  amount: bigint;
  staking_contract: string;
  lock_period: bigint;
  reward_multiplier: number;
  total_staked: bigint;
  timestamp: bigint;
}

export interface UnstakeEvent {
  user: string;
  amount: bigint;
  staking_contract: string;
  rewards_earned: bigint;
  penalty: bigint;
  total_staked: bigint;
  timestamp: bigint;
}

export interface StakingRewardClaimedEvent {
  user: string;
  amount: bigint;
  staking_contract: string;
  reward_token: string;
  timestamp: bigint;
}

export interface SlashedEvent {
  user: string;
  amount: bigint;
  staking_contract: string;
  reason: string;
  slashed_by: string;
  timestamp: bigint;
}

// =============================================================================
// Additional Governance Events
// =============================================================================

export interface VoteCastEvent {
  proposal_id: bigint;
  voter: string;
  vote_type: string;
  voting_power: bigint;
  reason: string;
  timestamp: bigint;
}

export interface EmergencyActionEvent {
  action_id: bigint;
  council_member: string;
  action_type: string;
  target_contract: string;
  description: string;
  timestamp: bigint;
}

// =============================================================================
// Privacy Events
// =============================================================================

export interface ShieldEvent {
  user: string;
  amount: bigint;
  public_token: string;
  privacy_contract: string;
  note_id: string;
  timestamp: bigint;
}

export interface UnshieldEvent {
  user: string;
  amount: bigint;
  public_token: string;
  privacy_contract: string;
  note_id: string;
  timestamp: bigint;
}

export interface PrivateTransferEvent {
  from: string;
  to: string;
  amount: bigint;
  privacy_contract: string;
  input_notes: string[];
  output_notes: string[];
  timestamp: bigint;
}

// =============================================================================
// Yield Farming Events
// =============================================================================

export interface LiquidityAddedEvent {
  user: string;
  pool_id: bigint;
  amount_a: bigint;
  amount_b: bigint;
  lp_tokens: bigint;
  farming_contract: string;
  timestamp: bigint;
}

export interface LiquidityRemovedEvent {
  user: string;
  pool_id: bigint;
  amount_a: bigint;
  amount_b: bigint;
  lp_tokens: bigint;
  farming_contract: string;
  timestamp: bigint;
}

export interface HarvestEvent {
  user: string;
  pool_id: bigint;
  reward_amount: bigint;
  reward_token: string;
  farming_contract: string;
  timestamp: bigint;
}

// =============================================================================
// Disaster Recovery Events
// =============================================================================

export interface EmergencyPauseEvent {
  contract_address: string;
  paused_by: string;
  reason: string;
  timestamp: bigint;
}

export interface RecoveryInitiatedEvent {
  contract_address: string;
  recovery_id: bigint;
  initiated_by: string;
  recovery_type: string;
  timestamp: bigint;
}

export interface RecoveryCompletedEvent {
  contract_address: string;
  recovery_id: bigint;
  completed_by: string;
  success: boolean;
  new_state_hash: string;
  timestamp: bigint;
}

// =============================================================================
// Generic Event Wrapper
// =============================================================================

export interface IndexedEvent {
  id: number;
  contract_id: string;
  topic: EventTopic;
  ledger: number;
  ledger_closed_at: string;
  tx_hash: string;
  event_index: number;
  data: unknown;
  created_at: string;
}

// =============================================================================
// Database Schema Types
// =============================================================================

export interface Trade {
  id: number;
  trade_id: bigint;
  contract_id: string;
  trader: string;
  pair: string;
  amount: bigint;
  price: bigint;
  is_buy: boolean;
  fee_amount: bigint;
  fee_token: string;
  timestamp: bigint;
  ledger: number;
  tx_hash: string;
  indexed_at: string;
}

export interface Proposal {
  id: number;
  proposal_id: bigint;
  contract_id: string;
  proposer: string;
  new_contract_hash: string;
  target_contract: string;
  description: string;
  approval_threshold: number;
  timelock_delay: bigint;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  created_at: bigint;
  updated_at: string;
}

export interface Reward {
  id: number;
  reward_id: bigint;
  contract_id: string;
  user: string;
  amount: bigint;
  reward_type: string;
  reason: string;
  granted_by: string;
  granted_at: bigint;
  claimed: boolean;
  claimed_at: bigint | null;
  ledger: number;
  tx_hash: string;
  indexed_at: string;
}
