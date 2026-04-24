import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reset() {
  console.log('🗑️  Resetting seed data...');

  // Delete in dependency order
  await prisma.notificationOutbox.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationSetting.deleteMany({});
  await prisma.reputationHistory.deleteMany({});
  await prisma.contribution.deleteMany({ where: { transactionHash: { startsWith: 'TX_SEED_HASH_' } } });
  await prisma.milestone.deleteMany({ where: { id: { startsWith: 'milestone-seed-' } } });
  await prisma.project.deleteMany({ where: { contractId: { startsWith: 'CONTRACT_SEED_' } } });
  await prisma.user.deleteMany({ where: { email: { in: ['alice@example.com', 'bob@example.com', 'carol@example.com'] } } });

  console.log('✅ Seed data cleared');
}

reset()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
