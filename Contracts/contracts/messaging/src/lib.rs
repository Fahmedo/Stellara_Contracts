#![no_std]

use shared::circuit_breaker::{
    CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState, PauseLevel,
};
use shared::governance::{GovernanceManager, GovernanceRole, UpgradeProposal};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec,
};

const CONTRACT_VERSION: u32 = 1;
const MAX_MESSAGE_LENGTH: u32 = 1024;

#[contract]
pub struct UpgradeableMessagingContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Message {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub payload: String,
    pub timestamp: u64,
    pub read: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessagingStats {
    pub total_messages: u64,
    pub unread_messages: u64,
    pub last_message_id: u64,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MessagingError {
    Unauthorized = 4001,
    InvalidPayload = 4002,
    InvalidRecipient = 4003,
    MessageNotFound = 4004,
    AlreadyRead = 4005,
    NotInitialized = 4006,
}

impl From<MessagingError> for soroban_sdk::Error {
    fn from(error: MessagingError) -> Self {
        soroban_sdk::Error::from_contract_error(error as u32)
    }
}

impl From<&MessagingError> for soroban_sdk::Error {
    fn from(error: &MessagingError) -> Self {
        soroban_sdk::Error::from_contract_error(*error as u32)
    }
}

impl From<soroban_sdk::Error> for MessagingError {
    fn from(_error: soroban_sdk::Error) -> Self {
        MessagingError::Unauthorized
    }
}

fn require_initialized(env: &Env) -> Result<(), MessagingError> {
    let init_key = symbol_short!("init");
    if env.storage().persistent().has(&init_key) {
        Ok(())
    } else {
        Err(MessagingError::NotInitialized)
    }
}

fn get_messages_map(env: &Env) -> Map<u64, Message> {
    env.storage()
        .persistent()
        .get(&symbol_short!("msgs"))
        .unwrap_or_else(|| Map::new(env))
}

fn get_user_message_ids(env: &Env, key: &Symbol, user: &Address) -> Vec<u64> {
    let message_index: Map<Address, Vec<u64>> = env
        .storage()
        .persistent()
        .get(key)
        .unwrap_or_else(|| Map::new(env));

    message_index
        .get(user.clone())
        .unwrap_or_else(|| Vec::new(env))
}

fn set_user_message_ids(env: &Env, key: &Symbol, user: &Address, ids: Vec<u64>) {
    let mut message_index: Map<Address, Vec<u64>> = env
        .storage()
        .persistent()
        .get(key)
        .unwrap_or_else(|| Map::new(env));

    message_index.set(user.clone(), ids);
    env.storage().persistent().set(key, &message_index);
}

fn get_unread_counts(env: &Env) -> Map<Address, u32> {
    env.storage()
        .persistent()
        .get(&symbol_short!("unread"))
        .unwrap_or_else(|| Map::new(env))
}

fn get_stats(env: &Env) -> MessagingStats {
    env.storage()
        .persistent()
        .get(&symbol_short!("stats"))
        .unwrap_or(MessagingStats {
            total_messages: 0,
            unread_messages: 0,
            last_message_id: 0,
        })
}

#[contractimpl]
impl UpgradeableMessagingContract {
    pub fn init(
        env: Env,
        admin: Address,
        approvers: Vec<Address>,
        executor: Address,
        cb_config: CircuitBreakerConfig,
    ) -> Result<(), MessagingError> {
        let init_key = symbol_short!("init");
        if env.storage().persistent().has(&init_key) {
            return Err(MessagingError::Unauthorized);
        }

        env.storage().persistent().set(&init_key, &true);

        let roles_key = symbol_short!("roles");
        let mut roles = Map::new(&env);
        roles.set(admin, GovernanceRole::Admin);

        for approver in approvers.iter() {
            roles.set(approver, GovernanceRole::Approver);
        }

        roles.set(executor, GovernanceRole::Executor);
        env.storage().persistent().set(&roles_key, &roles);

        env.storage().persistent().set(
            &symbol_short!("stats"),
            &MessagingStats {
                total_messages: 0,
                unread_messages: 0,
                last_message_id: 0,
            },
        );
        env.storage()
            .persistent()
            .set(&symbol_short!("ver"), &CONTRACT_VERSION);

        // Initialize circuit breaker
        CircuitBreaker::init(&env, cb_config);

        Ok(())
    }

    pub fn send_message(
        env: Env,
        sender: Address,
        recipient: Address,
        payload: String,
    ) -> Result<u64, MessagingError> {
        sender.require_auth();
        require_initialized(&env)?;

        // Check pause state via CircuitBreaker
        CircuitBreaker::require_not_paused(&env, symbol_short!("send_m"));

        // Track activity (1 message = 1 unit volume)
        CircuitBreaker::track_activity(&env, 1);

        if sender == recipient {
            return Err(MessagingError::InvalidRecipient);
        }

        let payload_len = payload.len();
        if payload_len == 0 || payload_len > MAX_MESSAGE_LENGTH {
            return Err(MessagingError::InvalidPayload);
        }

        let mut stats = get_stats(&env);
        let message_id = stats.last_message_id + 1;

        let message = Message {
            id: message_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            payload,
            timestamp: env.ledger().timestamp(),
            read: false,
        };

        let mut messages = get_messages_map(&env);
        messages.set(message_id, message);
        env.storage()
            .persistent()
            .set(&symbol_short!("msgs"), &messages);

        let inbox_key = symbol_short!("inbox");
        let sent_key = symbol_short!("sent");

        let mut recipient_ids = get_user_message_ids(&env, &inbox_key, &recipient);
        recipient_ids.push_back(message_id);
        set_user_message_ids(&env, &inbox_key, &recipient, recipient_ids);

        let mut sender_ids = get_user_message_ids(&env, &sent_key, &sender);
        sender_ids.push_back(message_id);
        set_user_message_ids(&env, &sent_key, &sender, sender_ids);

        let mut unread_counts = get_unread_counts(&env);
        let unread_count = unread_counts.get(recipient.clone()).unwrap_or(0);
        unread_counts.set(recipient, unread_count + 1);
        env.storage()
            .persistent()
            .set(&symbol_short!("unread"), &unread_counts);

        stats.total_messages += 1;
        stats.unread_messages += 1;
        stats.last_message_id = message_id;
        env.storage()
            .persistent()
            .set(&symbol_short!("stats"), &stats);

        Ok(message_id)
    }

    pub fn mark_as_read(
        env: Env,
        recipient: Address,
        message_id: u64,
    ) -> Result<(), MessagingError> {
        recipient.require_auth();
        require_initialized(&env)?;

        let mut messages = get_messages_map(&env);
        let mut message = messages
            .get(message_id)
            .ok_or(MessagingError::MessageNotFound)?;

        if message.recipient != recipient {
            return Err(MessagingError::Unauthorized);
        }

        if message.read {
            return Err(MessagingError::AlreadyRead);
        }

        message.read = true;
        messages.set(message_id, message);
        env.storage()
            .persistent()
            .set(&symbol_short!("msgs"), &messages);

        let mut unread_counts = get_unread_counts(&env);
        let unread_count = unread_counts.get(recipient.clone()).unwrap_or(0);
        unread_counts.set(recipient, unread_count.saturating_sub(1));
        env.storage()
            .persistent()
            .set(&symbol_short!("unread"), &unread_counts);

        let mut stats = get_stats(&env);
        stats.unread_messages = stats.unread_messages.saturating_sub(1);
        env.storage()
            .persistent()
            .set(&symbol_short!("stats"), &stats);

        Ok(())
    }

    pub fn get_messages(
        env: Env,
        user: Address,
        include_sent: bool,
        include_received: bool,
        unread_only: bool,
    ) -> Result<Vec<Message>, MessagingError> {
        user.require_auth();
        require_initialized(&env)?;

        let messages = get_messages_map(&env);
        let mut result = Vec::new(&env);

        if include_received {
            let inbox_key = symbol_short!("inbox");
            let inbox_ids = get_user_message_ids(&env, &inbox_key, &user);
            for message_id in inbox_ids.iter() {
                if let Some(message) = messages.get(message_id) {
                    if !unread_only || !message.read {
                        result.push_back(message);
                    }
                }
            }
        }

        if include_sent {
            let sent_key = symbol_short!("sent");
            let sent_ids = get_user_message_ids(&env, &sent_key, &user);
            for message_id in sent_ids.iter() {
                if let Some(message) = messages.get(message_id) {
                    if !unread_only || !message.read {
                        result.push_back(message);
                    }
                }
            }
        }

        Ok(result)
    }

    pub fn get_unread_count(env: Env, user: Address) -> Result<u32, MessagingError> {
        user.require_auth();
        require_initialized(&env)?;

        let unread_counts = get_unread_counts(&env);
        Ok(unread_counts.get(user).unwrap_or(0))
    }

    pub fn get_stats(env: Env) -> MessagingStats {
        get_stats(&env)
    }

    pub fn get_version(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&symbol_short!("ver"))
            .unwrap_or(0)
    }

    pub fn propose_upgrade(
        env: Env,
        admin: Address,
        new_contract_hash: Symbol,
        description: Symbol,
        approvers: Vec<Address>,
        approval_threshold: u32,
        timelock_delay: u64,
    ) -> Result<u64, MessagingError> {
        admin.require_auth();
        require_initialized(&env)?;

        GovernanceManager::propose_upgrade(
            &env,
            admin,
            new_contract_hash,
            env.current_contract_address(),
            description,
            approval_threshold,
            approvers,
            timelock_delay,
        )
        .map_err(|_| MessagingError::Unauthorized)
    }

    pub fn approve_upgrade(
        env: Env,
        proposal_id: u64,
        approver: Address,
    ) -> Result<(), MessagingError> {
        approver.require_auth();
        require_initialized(&env)?;

        GovernanceManager::approve_proposal(&env, proposal_id, approver)
            .map_err(|_| MessagingError::Unauthorized)
    }

    pub fn execute_upgrade(
        env: Env,
        proposal_id: u64,
        executor: Address,
    ) -> Result<(), MessagingError> {
        executor.require_auth();
        require_initialized(&env)?;

        GovernanceManager::execute_proposal(&env, proposal_id, executor)
            .map_err(|_| MessagingError::Unauthorized)
    }

    pub fn get_upgrade_proposal(
        env: Env,
        proposal_id: u64,
    ) -> Result<UpgradeProposal, MessagingError> {
        require_initialized(&env)?;
        GovernanceManager::get_proposal(&env, proposal_id).map_err(|_| MessagingError::Unauthorized)
    }

    pub fn reject_upgrade(
        env: Env,
        proposal_id: u64,
        rejector: Address,
    ) -> Result<(), MessagingError> {
        rejector.require_auth();
        require_initialized(&env)?;

        GovernanceManager::reject_proposal(&env, proposal_id, rejector)
            .map_err(|_| MessagingError::Unauthorized)
    }

    pub fn cancel_upgrade(
        env: Env,
        proposal_id: u64,
        admin: Address,
    ) -> Result<(), MessagingError> {
        admin.require_auth();
        require_initialized(&env)?;

        GovernanceManager::cancel_proposal(&env, proposal_id, admin)
            .map_err(|_| MessagingError::Unauthorized)
    }

    /// Set circuit breaker pause level (admin only)
    pub fn set_cb_pause_level(
        env: Env,
        admin: Address,
        level: PauseLevel,
    ) -> Result<(), MessagingError> {
        admin.require_auth();
        CircuitBreaker::set_pause_level(&env, admin, level);
        Ok(())
    }

    /// Pause specific function (admin only)
    pub fn pause_cb_function(
        env: Env,
        admin: Address,
        func_name: Symbol,
    ) -> Result<(), MessagingError> {
        admin.require_auth();
        CircuitBreaker::pause_function(&env, admin, func_name);
        Ok(())
    }

    /// Unpause specific function (admin only)
    pub fn unpause_cb_function(
        env: Env,
        admin: Address,
        func_name: Symbol,
    ) -> Result<(), MessagingError> {
        admin.require_auth();
        CircuitBreaker::unpause_function(&env, admin, func_name);
        Ok(())
    }

    /// Get current circuit breaker state
    pub fn get_cb_state(env: Env) -> CircuitBreakerState {
        CircuitBreaker::get_state(&env)
    }

    /// Get current circuit breaker config
    pub fn get_cb_config(env: Env) -> CircuitBreakerConfig {
        CircuitBreaker::get_config(&env)
    }
}

#[cfg(test)]
mod test;
