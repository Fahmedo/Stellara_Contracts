import { execSync } from 'child_process';
import { loadRuntimeConfig, rollbackTraffic, verifyLoadBalancer } from './blue-green-lib';

function runCommand(command: string): void {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
}

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const reason = process.env.BLUE_GREEN_ROLLBACK_REASON ?? 'manual rollback';

  console.log(
    `Rolling traffic back to ${config.activeSlot} in ${config.environment}. Reason: ${reason}`,
  );

  await rollbackTraffic(config, reason);
  await verifyLoadBalancer(config);

  if (config.runDbRollback) {
    runCommand('npm run db:rollback -- --steps 1');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown rollback failure';
  console.error(`Blue-green rollback failed: ${message}`);
  process.exit(1);
});
