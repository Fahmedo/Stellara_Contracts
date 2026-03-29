const assert = require('assert');
const path = require('path');
const { scanRustSource, scanWasmBuffer } = require('../engine');

const sampleRust = `
pub fn transfer(env: Env, amount: u128) {
    let balance = env.storage().get::<_, u128>(&"balance").unwrap();
    let recipient = Address::from(vec![1,2,3]);
    token::Client::new(&env, &recipient).transfer(&recipient, amount).unwrap();
    env.storage().set(&"balance", &(balance - amount));
}

pub fn admin_only(env: Env) {
    // no auth check intentionally missing
}
`;

const wasmBytes = Buffer.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x07, 0x01, 0x03, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00,
  0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b
]);

function testRustScan() {
  const findings = scanRustSource(sampleRust, 'sample.rs');
  assert(findings.some((f) => f.type === 'access-control'), 'Expected access-control finding');
  assert(findings.some((f) => f.type === 'unchecked-call'), 'Expected unchecked-call finding');
  assert(findings.some((f) => f.type === 'reentrancy'), 'Expected reentrancy finding');
  assert(findings.some((f) => f.type === 'overflow'), 'Expected overflow finding');
}

function testWasmScan() {
  const report = scanWasmBuffer(wasmBytes, 'sample.wasm');
  assert.strictEqual(report.totalFunctions, 1, 'Expected one function in sample wasm');
  assert(report.totalInstructions >= 1, 'Expected instruction count for wasm function');
}

function runTests() {
  testRustScan();
  testWasmScan();
  console.log('All scanner tests passed.');
}

runTests();
