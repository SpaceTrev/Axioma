import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create system user for fee collection
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@axioma.internal' },
    update: {},
    create: {
      id: 'system',
      email: 'system@axioma.internal',
      passwordHash: '', // System user cannot login
      role: 'ADMIN',
    },
  });
  console.log('Created system user:', systemUser.email);

  // Create system balance
  await prisma.balance.upsert({
    where: { userId: 'system' },
    update: {},
    create: {
      userId: 'system',
      available: 0,
      reserved: 0,
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@axioma.dev' },
    update: {},
    create: {
      email: 'admin@axioma.dev',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('Created admin user:', adminUser.email);

  // Create admin balance
  await prisma.balance.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      available: 10000, // Give admin some starting balance
      reserved: 0,
    },
  });

  // Create a test user
  const testPassword = await bcrypt.hash('test1234', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@axioma.dev' },
    update: {},
    create: {
      email: 'test@axioma.dev',
      passwordHash: testPassword,
      role: 'USER',
    },
  });
  console.log('Created test user:', testUser.email);

  // Create test user balance
  await prisma.balance.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      available: 1000,
      reserved: 0,
    },
  });

  // Create some sample markets
  const market1 = await prisma.market.upsert({
    where: { id: 'sample-market-1' },
    update: {},
    create: {
      id: 'sample-market-1',
      question: 'Will Bitcoin exceed $100,000 by end of 2026?',
      description: 'This market resolves YES if the price of Bitcoin (BTC) on Coinbase exceeds $100,000 USD at any point before December 31, 2026 11:59 PM UTC.',
      category: 'crypto',
      resolvesAt: new Date('2026-12-31T23:59:59Z'),
      status: 'OPEN',
      createdBy: adminUser.id,
    },
  });
  console.log('Created sample market:', market1.question);

  const market2 = await prisma.market.upsert({
    where: { id: 'sample-market-2' },
    update: {},
    create: {
      id: 'sample-market-2',
      question: 'Will the US Federal Reserve cut interest rates in Q1 2026?',
      description: 'This market resolves YES if the Federal Reserve announces at least one interest rate cut between January 1, 2026 and March 31, 2026.',
      category: 'economics',
      resolvesAt: new Date('2026-03-31T23:59:59Z'),
      status: 'OPEN',
      createdBy: adminUser.id,
    },
  });
  console.log('Created sample market:', market2.question);

  const market3 = await prisma.market.upsert({
    where: { id: 'sample-market-3' },
    update: {},
    create: {
      id: 'sample-market-3',
      question: 'Will SpaceX successfully land Starship on Mars by 2030?',
      description: 'This market resolves YES if SpaceX lands a Starship vehicle on the surface of Mars before January 1, 2030.',
      category: 'technology',
      resolvesAt: new Date('2029-12-31T23:59:59Z'),
      status: 'OPEN',
      createdBy: adminUser.id,
    },
  });
  console.log('Created sample market:', market3.question);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
