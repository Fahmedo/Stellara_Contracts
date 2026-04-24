import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { walletAddress: 'GABC1111111111111111111111111111111111111111111111111111' },
      update: {},
      create: {
        walletAddress: 'GABC1111111111111111111111111111111111111111111111111111',
        email: 'alice@example.com',
        reputationScore: 850,
        trustScore: 720,
        reputationLevel: 'GOLD',
        profileData: { username: 'alice', bio: 'DeFi enthusiast' },
      },
    }),
    prisma.user.upsert({
      where: { walletAddress: 'GDEF2222222222222222222222222222222222222222222222222222' },
      update: {},
      create: {
        walletAddress: 'GDEF2222222222222222222222222222222222222222222222222222',
        email: 'bob@example.com',
        reputationScore: 620,
        trustScore: 580,
        reputationLevel: 'SILVER',
        profileData: { username: 'bob', bio: 'Blockchain developer' },
      },
    }),
    prisma.user.upsert({
      where: { walletAddress: 'GHIJ3333333333333333333333333333333333333333333333333333' },
      update: {},
      create: {
        walletAddress: 'GHIJ3333333333333333333333333333333333333333333333333333',
        email: 'carol@example.com',
        reputationScore: 310,
        trustScore: 500,
        reputationLevel: 'BRONZE',
        profileData: { username: 'carol', bio: 'Web3 learner' },
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { contractId: 'CONTRACT_SEED_001' },
      update: {},
      create: {
        contractId: 'CONTRACT_SEED_001',
        creatorId: users[0].id,
        title: 'Stellar DeFi Protocol',
        description: 'A decentralized lending protocol on Stellar',
        category: 'DeFi',
        goal: BigInt('100000000000'), // 100k XLM in stroops
        currentFunds: BigInt('45000000000'),
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipfsHash: 'QmStellarDeFiProtocolMetadata123456789012345678',
        status: 'ACTIVE',
      },
    }),
    prisma.project.upsert({
      where: { contractId: 'CONTRACT_SEED_002' },
      update: {},
      create: {
        contractId: 'CONTRACT_SEED_002',
        creatorId: users[1].id,
        title: 'NFT Marketplace',
        description: 'Cross-chain NFT marketplace with Stellar integration',
        category: 'NFT',
        goal: BigInt('50000000000'),
        currentFunds: BigInt('50000000000'),
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        ipfsHash: 'QmNFTMarketplaceMetadata1234567890123456789012',
        status: 'COMPLETED',
      },
    }),
  ]);

  console.log(`✅ Created ${projects.length} projects`);

  // Contributions
  const contributions = await Promise.all([
    prisma.contribution.upsert({
      where: { transactionHash: 'TX_SEED_HASH_001' },
      update: {},
      create: {
        transactionHash: 'TX_SEED_HASH_001',
        investorId: users[1].id,
        projectId: projects[0].id,
        amount: BigInt('10000000000'),
      },
    }),
    prisma.contribution.upsert({
      where: { transactionHash: 'TX_SEED_HASH_002' },
      update: {},
      create: {
        transactionHash: 'TX_SEED_HASH_002',
        investorId: users[2].id,
        projectId: projects[0].id,
        amount: BigInt('5000000000'),
      },
    }),
    prisma.contribution.upsert({
      where: { transactionHash: 'TX_SEED_HASH_003' },
      update: {},
      create: {
        transactionHash: 'TX_SEED_HASH_003',
        investorId: users[0].id,
        projectId: projects[1].id,
        amount: BigInt('50000000000'),
      },
    }),
  ]);

  console.log(`✅ Created ${contributions.length} contributions`);

  // Milestones
  const milestones = await Promise.all([
    prisma.milestone.upsert({
      where: { id: 'milestone-seed-001' },
      update: {},
      create: {
        id: 'milestone-seed-001',
        projectId: projects[0].id,
        contractMilestoneId: 'MILESTONE_CONTRACT_001',
        title: 'Smart Contract Audit',
        description: 'Complete security audit of core contracts',
        fundingAmount: BigInt('20000000000'),
        status: 'APPROVED',
      },
    }),
    prisma.milestone.upsert({
      where: { id: 'milestone-seed-002' },
      update: {},
      create: {
        id: 'milestone-seed-002',
        projectId: projects[0].id,
        contractMilestoneId: 'MILESTONE_CONTRACT_002',
        title: 'Testnet Launch',
        description: 'Deploy and test on Stellar testnet',
        fundingAmount: BigInt('30000000000'),
        status: 'PENDING',
      },
    }),
  ]);

  console.log(`✅ Created ${milestones.length} milestones`);

  // Notification settings for each user
  await Promise.all(
    users.map((user) =>
      prisma.notificationSetting.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          emailEnabled: true,
          pushEnabled: false,
          notifyContributions: true,
          notifyMilestones: true,
          notifyDeadlines: true,
          notifyReputationChanges: true,
          notifyLevelUps: true,
          notifyWeeklySummary: true,
        },
      }),
    ),
  );

  console.log(`✅ Created notification settings for ${users.length} users`);

  // Sample notifications
  await Promise.all([
    prisma.notification.create({
      data: {
        userId: users[0].id,
        type: 'CONTRIBUTION',
        title: 'New Contribution',
        message: 'Bob contributed 10,000 XLM to your project',
        read: false,
        data: { projectId: projects[0].id, amount: '10000000000' },
      },
    }),
    prisma.notification.create({
      data: {
        userId: users[1].id,
        type: 'MILESTONE',
        title: 'Milestone Approved',
        message: 'Smart Contract Audit milestone has been approved',
        read: true,
        data: { milestoneId: milestones[0].id },
      },
    }),
    prisma.notification.create({
      data: {
        userId: users[2].id,
        type: 'REPUTATION_CHANGE',
        title: 'Reputation Updated',
        message: 'Your reputation score increased by 50 points',
        read: false,
        data: { scoreChange: 50 },
      },
    }),
  ]);

  console.log('✅ Created sample notifications');

  // Reputation history
  await Promise.all([
    prisma.reputationHistory.create({
      data: {
        userId: users[0].id,
        scoreChange: 100,
        reason: 'Successful project completion',
      },
    }),
    prisma.reputationHistory.create({
      data: {
        userId: users[1].id,
        scoreChange: 50,
        reason: 'Contribution to funded project',
      },
    }),
    prisma.reputationHistory.create({
      data: {
        userId: users[2].id,
        scoreChange: 25,
        reason: 'First contribution',
      },
    }),
  ]);

  console.log('✅ Created reputation history');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
