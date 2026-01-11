import { PrismaClient, Prisma, LedgerReason } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

export * from '@prisma/client';
export { Decimal };

// ============================================
// Type Helpers
// ============================================

export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ============================================
// Ledger Application (Transactional)
// ============================================

export interface ApplyLedgerInput {
  userId: string;
  deltaAvailable: Decimal;
  deltaReserved: Decimal;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
}

/**
 * Apply a ledger entry within a transaction.
 * This ensures atomic balance updates with invariant checking.
 */
export async function applyLedger(
  tx: PrismaTransactionClient,
  input: ApplyLedgerInput
): Promise<void> {
  // Get current balance (or create if doesn't exist)
  const balance = await tx.balance.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      available: new Prisma.Decimal(0),
      reserved: new Prisma.Decimal(0),
    },
    update: {},
  });

  // Calculate new balances
  const newAvailable = new Decimal(balance.available.toString()).plus(input.deltaAvailable);
  const newReserved = new Decimal(balance.reserved.toString()).plus(input.deltaReserved);

  // Invariant checks
  if (newAvailable.isNegative()) {
    throw new Error(`Insufficient available balance. Current: ${balance.available}, Delta: ${input.deltaAvailable}`);
  }
  if (newReserved.isNegative()) {
    throw new Error(`Insufficient reserved balance. Current: ${balance.reserved}, Delta: ${input.deltaReserved}`);
  }

  // Create ledger entry
  await tx.ledgerEntry.create({
    data: {
      userId: input.userId,
      deltaAvailable: new Prisma.Decimal(input.deltaAvailable.toString()),
      deltaReserved: new Prisma.Decimal(input.deltaReserved.toString()),
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
    },
  });

  // Update balance
  await tx.balance.update({
    where: { userId: input.userId },
    data: {
      available: new Prisma.Decimal(newAvailable.toString()),
      reserved: new Prisma.Decimal(newReserved.toString()),
    },
  });
}

/**
 * Apply multiple ledger entries atomically
 */
export async function applyLedgerBatch(
  tx: PrismaTransactionClient,
  inputs: ApplyLedgerInput[]
): Promise<void> {
  for (const input of inputs) {
    await applyLedger(tx, input);
  }
}

// ============================================
// Position Helpers
// ============================================

export interface UpdatePositionInput {
  userId: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  deltaShares: Decimal;
  deltaReservedShares: Decimal;
  tradePrice?: Decimal;
}

/**
 * Update a position within a transaction.
 * Handles avg price calculation for buys.
 */
export async function updatePosition(
  tx: PrismaTransactionClient,
  input: UpdatePositionInput
): Promise<void> {
  const position = await tx.position.upsert({
    where: {
      userId_marketId_outcome: {
        userId: input.userId,
        marketId: input.marketId,
        outcome: input.outcome,
      },
    },
    create: {
      userId: input.userId,
      marketId: input.marketId,
      outcome: input.outcome,
      shares: new Prisma.Decimal(0),
      reservedShares: new Prisma.Decimal(0),
      avgPrice: new Prisma.Decimal(0),
    },
    update: {},
  });

  const currentShares = new Decimal(position.shares.toString());
  const currentReserved = new Decimal(position.reservedShares.toString());
  const currentAvgPrice = new Decimal(position.avgPrice.toString());

  const newShares = currentShares.plus(input.deltaShares);
  const newReserved = currentReserved.plus(input.deltaReservedShares);

  // Invariant checks
  if (newShares.isNegative()) {
    throw new Error(`Insufficient shares. Current: ${currentShares}, Delta: ${input.deltaShares}`);
  }
  if (newReserved.isNegative()) {
    throw new Error(`Insufficient reserved shares. Current: ${currentReserved}, Delta: ${input.deltaReservedShares}`);
  }
  if (newReserved.gt(newShares)) {
    throw new Error(`Reserved shares cannot exceed total shares`);
  }

  // Calculate new avg price for buys
  let newAvgPrice = currentAvgPrice;
  if (input.deltaShares.gt(0) && input.tradePrice) {
    const currentValue = currentShares.times(currentAvgPrice);
    const addedValue = input.deltaShares.times(input.tradePrice);
    newAvgPrice = newShares.isZero()
      ? new Decimal(0)
      : currentValue.plus(addedValue).div(newShares);
  }

  await tx.position.update({
    where: {
      userId_marketId_outcome: {
        userId: input.userId,
        marketId: input.marketId,
        outcome: input.outcome,
      },
    },
    data: {
      shares: new Prisma.Decimal(newShares.toString()),
      reservedShares: new Prisma.Decimal(newReserved.toString()),
      avgPrice: new Prisma.Decimal(newAvgPrice.toString()),
    },
  });
}
