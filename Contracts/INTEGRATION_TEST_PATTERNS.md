# Integration Test Patterns

This guide documents the cross-contract testing patterns used in the Contracts workspace.

## Goals

- Validate end-to-end business flows that touch multiple contracts.
- Verify state transitions across contract boundaries in one scenario.
- Reuse shared governance expectations for upgradeable contracts.

## Core Patterns

### 1. Single Environment Orchestration

Run all contracts in one Soroban `Env` and register each contract in the same test.
This mirrors real deployments where contracts share a network state.

### 2. Scenario-Driven Assertions

Model realistic system flows instead of isolated method checks:

- Academy badge redemption followed by social reward crediting.
- Trading execution followed by fee transfer to recipient.
- External system flow followed by messaging notification delivery.

### 3. Shared Governance Validation

For all upgradeable contracts, assert the same governance lifecycle:

- `init`
- `propose_upgrade`
- `approve_upgrade`
- proposal status transitions to `Approved`

This ensures governance behavior is consistent across contracts using shared module logic.

### 4. Token-Backed Fee Flow Testing

Use a minimal mock token contract exposing `balance` and `transfer` so the shared `FeeManager` can execute real fee collection logic during trading integration tests.

## Running Integration Tests

From the Contracts workspace root:

- `cargo test -p integration-tests`
- `cargo test --all`

## CI/CD Notes

The integration test crate is a workspace member, so it is executed by the existing CI test command.
The crate library remains minimal and `no_std`, while integration scenarios live under the tests directory.
