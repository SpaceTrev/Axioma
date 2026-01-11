import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  validateBalanceState,
  applyLedgerEntry,
  hasSufficientAvailable,
  LedgerInvariantError,
  validatePositionState,
  reserveShares,
  releaseReservedShares,
  consumeReservedShares,
  addShares,
  getAvailableShares,
  hasSufficientSharesForSell,
  PositionInvariantError,
  calculateTakerFee,
  DEFAULT_FEE_CONFIG,
} from './index';

describe('Balance Invariants', () => {
  it('should validate positive balances', () => {
    expect(() =>
      validateBalanceState({
        available: new Decimal(100),
        reserved: new Decimal(50),
      })
    ).not.toThrow();
  });

  it('should reject negative available balance', () => {
    expect(() =>
      validateBalanceState({
        available: new Decimal(-1),
        reserved: new Decimal(0),
      })
    ).toThrow(LedgerInvariantError);
  });

  it('should reject negative reserved balance', () => {
    expect(() =>
      validateBalanceState({
        available: new Decimal(100),
        reserved: new Decimal(-1),
      })
    ).toThrow(LedgerInvariantError);
  });
});

describe('applyLedgerEntry', () => {
  it('should apply positive deltas', () => {
    const current = {
      available: new Decimal(100),
      reserved: new Decimal(0),
    };
    const result = applyLedgerEntry(current, {
      deltaAvailable: new Decimal(50),
      deltaReserved: new Decimal(0),
    });
    expect(result.available.toString()).toBe('150');
    expect(result.reserved.toString()).toBe('0');
  });

  it('should move available to reserved', () => {
    const current = {
      available: new Decimal(100),
      reserved: new Decimal(0),
    };
    const result = applyLedgerEntry(current, {
      deltaAvailable: new Decimal(-50),
      deltaReserved: new Decimal(50),
    });
    expect(result.available.toString()).toBe('50');
    expect(result.reserved.toString()).toBe('50');
  });

  it('should throw on overdraft', () => {
    const current = {
      available: new Decimal(100),
      reserved: new Decimal(0),
    };
    expect(() =>
      applyLedgerEntry(current, {
        deltaAvailable: new Decimal(-150),
        deltaReserved: new Decimal(0),
      })
    ).toThrow(LedgerInvariantError);
  });
});

describe('hasSufficientAvailable', () => {
  it('should return true when balance is sufficient', () => {
    const balance = {
      available: new Decimal(100),
      reserved: new Decimal(0),
    };
    expect(hasSufficientAvailable(balance, new Decimal(50))).toBe(true);
    expect(hasSufficientAvailable(balance, new Decimal(100))).toBe(true);
  });

  it('should return false when balance is insufficient', () => {
    const balance = {
      available: new Decimal(100),
      reserved: new Decimal(0),
    };
    expect(hasSufficientAvailable(balance, new Decimal(150))).toBe(false);
  });
});

describe('Position Invariants', () => {
  it('should validate positive position', () => {
    expect(() =>
      validatePositionState({
        shares: new Decimal(100),
        reservedShares: new Decimal(50),
        avgPrice: new Decimal('0.5'),
      })
    ).not.toThrow();
  });

  it('should reject negative shares', () => {
    expect(() =>
      validatePositionState({
        shares: new Decimal(-1),
        reservedShares: new Decimal(0),
        avgPrice: new Decimal('0.5'),
      })
    ).toThrow(PositionInvariantError);
  });

  it('should reject reserved shares exceeding total shares', () => {
    expect(() =>
      validatePositionState({
        shares: new Decimal(50),
        reservedShares: new Decimal(100),
        avgPrice: new Decimal('0.5'),
      })
    ).toThrow(PositionInvariantError);
  });
});

describe('Share Operations', () => {
  const basePosition = {
    shares: new Decimal(100),
    reservedShares: new Decimal(0),
    avgPrice: new Decimal('0.5'),
  };

  it('should get available shares', () => {
    const pos = { ...basePosition, reservedShares: new Decimal(30) };
    expect(getAvailableShares(pos).toString()).toBe('70');
  });

  it('should check sufficient shares for sell', () => {
    expect(hasSufficientSharesForSell(basePosition, new Decimal(50))).toBe(true);
    expect(hasSufficientSharesForSell(basePosition, new Decimal(150))).toBe(false);
  });

  it('should reserve shares', () => {
    const result = reserveShares(basePosition, new Decimal(30));
    expect(result.reservedShares.toString()).toBe('30');
    expect(result.shares.toString()).toBe('100');
  });

  it('should throw when reserving more than available', () => {
    expect(() => reserveShares(basePosition, new Decimal(150))).toThrow(
      PositionInvariantError
    );
  });

  it('should release reserved shares', () => {
    const reserved = reserveShares(basePosition, new Decimal(30));
    const result = releaseReservedShares(reserved, new Decimal(30));
    expect(result.reservedShares.toString()).toBe('0');
  });

  it('should consume reserved shares on fill', () => {
    const reserved = reserveShares(basePosition, new Decimal(30));
    const result = consumeReservedShares(reserved, new Decimal(30));
    expect(result.shares.toString()).toBe('70');
    expect(result.reservedShares.toString()).toBe('0');
  });

  it('should add shares with weighted average price', () => {
    // Start with 100 shares at $0.50 = $50 value
    // Add 100 shares at $0.70 = $70 value
    // Total: 200 shares, $120 value, avg = $0.60
    const result = addShares(basePosition, new Decimal(100), new Decimal('0.7'));
    expect(result.shares.toString()).toBe('200');
    expect(result.avgPrice.toString()).toBe('0.6');
  });

  it('should handle adding shares to empty position', () => {
    const emptyPosition = {
      shares: new Decimal(0),
      reservedShares: new Decimal(0),
      avgPrice: new Decimal(0),
    };
    const result = addShares(emptyPosition, new Decimal(100), new Decimal('0.5'));
    expect(result.shares.toString()).toBe('100');
    expect(result.avgPrice.toString()).toBe('0.5');
  });
});

describe('Fee Calculation', () => {
  it('should calculate taker fee', () => {
    const tradeValue = new Decimal(100);
    const fee = calculateTakerFee(tradeValue);
    expect(fee.toString()).toBe('1'); // 1% of 100
  });

  it('should handle custom fee rate', () => {
    const tradeValue = new Decimal(100);
    const fee = calculateTakerFee(tradeValue, { takerFeeRate: new Decimal('0.005') });
    expect(fee.toString()).toBe('0.5'); // 0.5% of 100
  });
});
