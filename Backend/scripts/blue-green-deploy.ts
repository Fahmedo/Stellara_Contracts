import { execSync } from 'child_process';
import {
  loadRuntimeConfig,
  rollbackTraffic,
  runSmokeChecks,
  sleep,
  switchTraffic,
  verifyLoadBalancer,
  waitForHealthySlot,
} from './blue-green-lib';

function runCommand(command: string): void {
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
}

async function main(): Promise<void> {
  const config = loadRuntimeConfig();

  console.log(
    `Starting blue-green deployment in ${config.environment}. Active=${config.activeSlot}, candidate=${config.candidateSlot}, release=${config.releaseVersion}`,
  );

  try {
    await verifyLoadBalancer(config);
    await waitForHealthySlot(config);

    if (process.env.BLUE_GREEN_RUN_PREDEPLOY_CHECKS !== 'false') {
      runCommand('npm run db:pre-deploy');
      runCommand('npm run db:migrate:deploy');
    }

    await waitForHealthySlot(config);

    for (const percent of config.trafficSteps) {
      console.log(`Shifting ${percent}% of traffic to ${config.candidateSlot}`);
      await switchTraffic(config, percent);
      await sleep(config.stepIntervalMs);
      await runSmokeChecks(config);
      await verifyLoadBalancer(config);
    }

    console.log(`Blue-green deployment completed. ${config.candidateSlot} is now live.`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown deployment failure';
    console.error(`Blue-green deployment failed: ${message}`);

    if (config.rollbackOnFailure) {
      console.log(`Rolling traffic back to ${config.activeSlot}`);
      await rollbackTraffic(config, message);
      await verifyLoadBalancer(config);

      if (config.runDbRollback) {
        runCommand('npm run db:rollback -- --steps 1');
      }
    }

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown deployment failure';
  console.error(`Unhandled blue-green deployment error: ${message}`);
  process.exit(1);
});
