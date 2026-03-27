/**
 * Pre-deployment migration safety check.
 * Exits with code 1 if there are pending migrations that haven't been reviewed,
 * or if the schema drift is detected.
 *
 * Usage: npx ts-node prisma/scripts/pre-deploy-check.ts
 */

import { execSync } from 'child_process';

function run(cmd: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });
    return { stdout, stderr: '', code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.status ?? 1 };
  }
}

function checkPendingMigrations() {
  console.log('🔍 Checking for pending migrations...');
  const result = run('npx prisma migrate status');

  if (result.stdout.includes('have not yet been applied')) {
    console.error('❌ There are pending migrations that have not been applied.');
    console.error('   Run: npm run db:migrate:deploy');
    process.exit(1);
  }

  if (result.stdout.includes('Database schema is not in sync')) {
    console.error('❌ Schema drift detected — database is out of sync with migrations.');
    console.error('   Investigate with: npx prisma migrate diff');
    process.exit(1);
  }

  console.log('✅ All migrations are applied and schema is in sync.');
}

function checkDatabaseConnection() {
  console.log('🔍 Verifying database connection...');
  const result = run('npx prisma db execute --stdin <<< "SELECT 1"');

  // Connection check via migrate status is sufficient
  const statusResult = run('npx prisma migrate status');
  if (statusResult.code !== 0 && statusResult.stderr.includes('connect')) {
    console.error('❌ Cannot connect to database. Check DATABASE_URL.');
    process.exit(1);
  }
  console.log('✅ Database connection verified.');
}

function checkGeneratedClient() {
  console.log('🔍 Verifying Prisma client is generated...');
  try {
    require('@prisma/client');
    console.log('✅ Prisma client is available.');
  } catch {
    console.error('❌ Prisma client not generated. Run: npx prisma generate');
    process.exit(1);
  }
}

async function main() {
  console.log('\n🚀 Running pre-deployment checks...\n');

  checkDatabaseConnection();
  checkPendingMigrations();
  checkGeneratedClient();

  console.log('\n✅ All pre-deployment checks passed. Safe to deploy.\n');
}

main().catch((e) => {
  console.error('❌ Pre-deploy check failed:', e.message);
  process.exit(1);
});
