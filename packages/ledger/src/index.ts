import Decimal from 'decimal.js';

// ============================================
// Ledger Types
// ============================================

export type LedgerReason =
  | 'FAUCET_CREDIT'
  | 'ORDER_RESERVE'
  | 'ORDER_RESERVE_RELEASE'
  | 'TRADE_BUY'
  | 'TRADE_SELL'
  | 'TRADE_FEE'
  | 'SETTLEMENT_WIN'
  | 'SETTLEMENT_LOSS'
  | 'MARKET_CANCEL_REFUND'
  | 'ADMIN_ADJUSTMENT';

export interface LedgerEntryInput {
  userId: string;
  deltaAvailable: Decimal;
  deltaReserved: Decimal;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
}

export interface BalanceState {
  available: Decimal;
  reserved: Decimal;
}

// ============================================
// Invariant Checks
// ============================================

export class LedgerInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerInvariantError';
  }
}

/**
 * Validates that a balance state is valid (no negative values)
 */
export function validateBalanceState(balance: BalanceState): void {
  if (balance.available.isNegative()) {
    throw new LedgerInvariantError(
      `Available balance cannot be negative: ${balance.available.toString()}`
    );
  }
  if (balance.reserved.isNegative()) {
    throw new LedgerInvariantError(
      `Reserved balance cannot be negative: ${balance.reserved.toString()}`
    );
  }
}

/**
 * Computes new balance after applying a ledger entry
 */
export function applyLedgerEntry(
  currentBalance: BalanceState,
  entry: Pick<LedgerEntryInput, 'deltaAvailable' | 'deltaReserved'>
): BalanceState {
  const newBalance: BalanceState = {
    available: currentBalance.available.plus(entry.deltaAvailable),
    reserved: currentBalance.reserved.plus(entry.deltaReserved),
  };

  validateBalanceState(newBalance);

  return newBalance;
}

/**
 * Check if user has sufficient available balance
 */
export function hasSufficientAvailable(
  balance: BalanceState,
  amount: Decimal
): boolean {
  return balance.available.gte(amount);
}

/**
 * Check if user has sufficient reserved balance
 */
export function hasSufficientReserved(
  balance: BalanceState,
  amount: Decimal
): boolean {
  return balance.reserved.gte(amount);
}

// ============================================
// Position Types
// ============================================

export type Outcome = 'YES' | 'NO';

export interface PositionState {
  shares: Decimal;
  reservedShares: Decimal;
  avgPrice: Decimal;
}

export class PositionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PositionInvariantError';
  }
}

/**
 * Validates that a position state is valid (no negative values)
 */
export function validatePositionState(position: PositionState): void {
  if (position.shares.isNegative()) {
    throw new PositionInvariantError(
      `Shares cannot be negative: ${position.shares.toString()}`
    );
  }
  if (position.reservedShares.isNegative()) {
    throw new PositionInvariantError(
      `Reserved shares cannot be negative: ${position.reservedShares.toString()}`
    );
  }
  if (position.reservedShares.gt(position.shares)) {
    throw new PositionInvariantError(
      `Reserved shares (${position.reservedShares}) cannot exceed total shares (${position.shares})`
    );
  }
}

/**
 * Get available (non-reserved) shares
 */
export function getAvailableShares(position: PositionState): Decimal {
  return position.shares.minus(position.reservedShares);
}

/**
 * Check if user has sufficient available shares for selling
 */
export function hasSufficientSharesForSell(
  position: PositionState,
  amount: Decimal
): boolean {
  return getAvailableShares(position).gte(amount);
}

/**
 * Reserve shares for a SELL order
 */
export function reserveShares(
  position: PositionState,
  amount: Decimal
): PositionState {
  const newPosition: PositionState = {
    ...position,
    reservedShares: position.reservedShares.plus(amount),
  };
  validatePositionState(newPosition);
  return newPosition;
}

/**
 * Release reserved shares (on cancel)
 */
export function releaseReservedShares(
  position: PositionState,
  amount: Decimal
): PositionState {
  const newPosition: PositionState = {
    ...position,
    reservedShares: position.reservedShares.minus(amount),
  };
  validatePositionState(newPosition);
  return newPosition;
}

/**
 * Consume reserved shares on fill (reduce both shares and reserved)
 */
export function consumeReservedShares(
  position: PositionState,
  amount: Decimal
): PositionState {
  const newPosition: PositionState = {
    ...position,
    shares: position.shares.minus(amount),
    reservedShares: position.reservedShares.minus(amount),
  };
  validatePositionState(newPosition);
  return newPosition;
}

/**
 * Add shares to position (on BUY fill)
 */
export function addShares(
  position: PositionState,
  amount: Decimal,
  pricePerShare: Decimal
): PositionState {
  // Calculate new weighted average price
  const currentValue = position.shares.times(position.avgPrice);
  const newValue = amount.times(pricePerShare);
  const totalShares = position.shares.plus(amount);
  
  const newAvgPrice = totalShares.isZero()
    ? new Decimal(0)
    : currentValue.plus(newValue).div(totalShares);

  return {
    shares: totalShares,
    reservedShares: position.reservedShares,
    avgPrice: newAvgPrice,
  };
}

// ============================================
// Fee Configuration
// ============================================

export interface FeeConfig {
  takerFeeRate: Decimal; // e.g., 0.01 for 1%
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  takerFeeRate: new Decimal('0.01'), // 1% taker fee
};

/**
 * Calculate taker fee for a trade
 */
export function calculateTakerFee(
  tradeValue: Decimal,
  config: FeeConfig = DEFAULT_FEE_CONFIG
): Decimal {
  return tradeValue.times(config.takerFeeRate);
}

// ============================================
// System Account
// ============================================

export const SYSTEM_USER_ID = 'system';
export const SYSTEM_USER_EMAIL = 'system@axioma.internal';

// ============================================
// Re-export Decimal for convenience
// ============================================

export { Decimal };
