import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding subscription plans...');

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small projects and startups',
      stripePriceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter_placeholder',
      amount: 2900, // $29.00
      currency: 'usd',
      interval: 'month',
      features: JSON.stringify({
        maxUsers: 10,
        maxProjects: 5,
        apiCalls: 10000,
        storageGB: 10,
        support: 'email',
      }),
      isActive: true,
    },
    {
      name: 'Professional',
      description: 'For growing businesses with advanced needs',
      stripePriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL || 'price_professional_placeholder',
      amount: 9900, // $99.00
      currency: 'usd',
      interval: 'month',
      features: JSON.stringify({
        maxUsers: 50,
        maxProjects: 25,
        apiCalls: 100000,
        storageGB: 100,
        support: 'priority',
        analytics: true,
      }),
      isActive: true,
    },
    {
      name: 'Enterprise',
      description: 'Full-featured solution for large organizations',
      stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_enterprise_placeholder',
      amount: 29900, // $299.00
      currency: 'usd',
      interval: 'month',
      features: JSON.stringify({
        maxUsers: -1, // unlimited
        maxProjects: -1, // unlimited
        apiCalls: 1000000,
        storageGB: 1000,
        support: 'dedicated',
        analytics: true,
        sso: true,
        auditLogs: true,
      }),
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`Upserted plan: ${plan.name}`);
  }

  console.log('Subscription plans seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
