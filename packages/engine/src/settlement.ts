import Decimal from 'decimal.js';
import { Outcome, LedgerEntryInput, SYSTEM_USER_ID } from '@axioma/ledger';

// ============================================
// Types
// ============================================

export interface PositionForSettlement {
  userId: string;
  marketId: string;
  outcome: Outcome;
  shares: Decimal;
  reservedShares: Decimal;
  avgPrice: Decimal;
}

export interface OrderForCancellation {
  id: string;
  userId: string;
  marketId: string;
  outcome: Outcome;
  side: 'BUY' | 'SELL';
  price: Decimal;
  remaining: Decimal;
}

export interface SettlementResult {
  ledgerEntries: LedgerEntryInput[];
  positionUpdates: Array<{
    userId: string;
    marketId: string;
    outcome: Outcome;
    newShares: Decimal;
    newReservedShares: Decimal;
  }>;
}

export interface CancellationResult {
  ledgerEntries: LedgerEntryInput[];
  positionUpdates: Array<{
    userId: string;
    marketId: string;
    outcome: Outcome;
    releaseReservedShares: Decimal;
  }>;
  orderIds: string[];
}

// ============================================
// Settlement Logic
// ============================================

/**
 * Calculate settlement for market resolution.
 * - Winning outcome: shares redeem at 1.0 USDC each
 * - Losing outcome: shares redeem at 0
 * 
 * This is a pure function - returns all changes to be applied.
 */
export function calculateSettlement(
  marketId: string,
  winningOutcome: Outcome,
  positions: PositionForSettlement[]
): SettlementResult {
  const ledgerEntries: LedgerEntryInput[] = [];
  const positionUpdates: SettlementResult['positionUpdates'] = [];

  for (const position of positions) {
    if (position.marketId !== marketId) continue;

    const totalShares = position.shares;
    if (totalShares.isZero()) continue;

    if (position.outcome === winningOutcome) {
      // Winner: credit 1.0 USDC per share
      const payout = totalShares;
      
      ledgerEntries.push({
        userId: position.userId,
        deltaAvailable: payout,
        deltaReserved: new Decimal(0),
        reason: 'SETTLEMENT_WIN',
        refType: 'market',
        refId: marketId,
      });
    } else {
      // Loser: shares are worthless, but we still record the event
      ledgerEntries.push({
        userId: position.userId,
        deltaAvailable: new Decimal(0),
        deltaReserved: new Decimal(0),
        reason: 'SETTLEMENT_LOSS',
        refType: 'market',
        refId: marketId,
      });
    }

    // Clear position
    positionUpdates.push({
      userId: position.userId,
      marketId: position.marketId,
      outcome: position.outcome,
      newShares: new Decimal(0),
      newReservedShares: new Decimal(0),
    });
  }

  return { ledgerEntries, positionUpdates };
}

/**
 * Calculate refunds for market cancellation.
 * - Cancel all open orders
 * - Release all reserved funds (BUY orders)
 * - Release all reserved shares (SELL orders)
 * 
 * This is a pure function - returns all changes to be applied.
 */
export function calculateCancellation(
  marketId: string,
  openOrders: OrderForCancellation[],
  positions: PositionForSettlement[]
): CancellationResult {
  const ledgerEntries: LedgerEntryInput[] = [];
  const positionUpdates: CancellationResult['positionUpdates'] = [];
  const orderIds: string[] = [];

  // Group SELL orders by user+outcome to calculate reserved shares to release
  const sellOrderReserves = new Map<string, Decimal>();

  for (const order of openOrders) {
    if (order.marketId !== marketId) continue;
    
    orderIds.push(order.id);

    if (order.side === 'BUY') {
      // BUY order: release reserved USDC
      const reservedAmount = order.remaining.times(order.price);
      
      ledgerEntries.push({
        userId: order.userId,
        deltaAvailable: reservedAmount,
        deltaReserved: reservedAmount.neg(),
        reason: 'MARKET_CANCEL_REFUND',
        refType: 'order',
        refId: order.id,
      });
    } else {
      // SELL order: track reserved shares to release
      const key = `${order.userId}:${order.outcome}`;
      const current = sellOrderReserves.get(key) || new Decimal(0);
      sellOrderReserves.set(key, current.plus(order.remaining));
    }
  }

  // Release reserved shares for SELL orders
  for (const [key, reservedShares] of sellOrderReserves) {
    const [userId, outcome] = key.split(':');
    
    positionUpdates.push({
      userId,
      marketId,
      outcome: outcome as Outcome,
      releaseReservedShares: reservedShares,
    });
  }

  return { ledgerEntries, positionUpdates, orderIds };
}

// ============================================
// Trade Settlement (for matched orders)
// ============================================

export interface TradeSettlementInput {
  tradeId: string;
  marketId: string;
  outcome: Outcome;
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  makerSide: 'BUY' | 'SELL';
  price: Decimal;
  quantity: Decimal;
  takerFee: Decimal;
}

export interface TradeSettlementResult {
  ledgerEntries: LedgerEntryInput[];
  positionUpdates: Array<{
    userId: string;
    marketId: string;
    outcome: Outcome;
    deltaShares: Decimal;
    deltaReservedShares: Decimal;
    tradePrice: Decimal;
  }>;
}

/**
 * Calculate ledger entries and position updates for a trade.
 * 
 * Trade scenarios:
 * 1. BUY taker vs SELL maker: 
 *    - Taker (buyer) uses reserved USDC, gets shares
 *    - Maker (seller) gives up reserved shares, gets USDC
 * 
 * 2. SELL taker vs BUY maker:
 *    - Taker (seller) gives up reserved shares, gets USDC
 *    - Maker (buyer) uses reserved USDC, gets shares
 */
export function calculateTradeSettlement(
  trade: TradeSettlementInput
): TradeSettlementResult {
  const ledgerEntries: LedgerEntryInput[] = [];
  const positionUpdates: TradeSettlementResult['positionUpdates'] = [];

  const tradeValue = trade.quantity.times(trade.price);
  const netToSeller = tradeValue.minus(trade.takerFee);

  if (trade.makerSide === 'SELL') {
    // Taker is BUYER
    // Taker: consume reserved USDC, get shares
    ledgerEntries.push({
      userId: trade.takerUserId,
      deltaAvailable: new Decimal(0),
      deltaReserved: tradeValue.neg(), // Consume reserved
      reason: 'TRADE_BUY',
      refType: 'trade',
      refId: trade.tradeId,
    });

    // Taker fee
    if (trade.takerFee.gt(0)) {
      ledgerEntries.push({
        userId: trade.takerUserId,
        deltaAvailable: trade.takerFee.neg(),
        deltaReserved: new Decimal(0),
        reason: 'TRADE_FEE',
        refType: 'trade',
        refId: trade.tradeId,
      });

      // Credit fee to system
      ledgerEntries.push({
        userId: SYSTEM_USER_ID,
        deltaAvailable: trade.takerFee,
        deltaReserved: new Decimal(0),
        reason: 'TRADE_FEE',
        refType: 'trade',
        refId: trade.tradeId,
      });
    }

    // Taker gets shares
    positionUpdates.push({
      userId: trade.takerUserId,
      marketId: trade.marketId,
      outcome: trade.outcome,
      deltaShares: trade.quantity,
      deltaReservedShares: new Decimal(0),
      tradePrice: trade.price,
    });

    // Maker (seller): give up reserved shares, get USDC
    ledgerEntries.push({
      userId: trade.makerUserId,
      deltaAvailable: netToSeller,
      deltaReserved: new Decimal(0),
      reason: 'TRADE_SELL',
      refType: 'trade',
      refId: trade.tradeId,
    });

    // Maker loses reserved shares
    positionUpdates.push({
      userId: trade.makerUserId,
      marketId: trade.marketId,
      outcome: trade.outcome,
      deltaShares: trade.quantity.neg(),
      deltaReservedShares: trade.quantity.neg(),
      tradePrice: trade.price,
    });
  } else {
    // Maker is BUYER, Taker is SELLER
    // Maker: consume reserved USDC, get shares
    ledgerEntries.push({
      userId: trade.makerUserId,
      deltaAvailable: new Decimal(0),
      deltaReserved: tradeValue.neg(),
      reason: 'TRADE_BUY',
      refType: 'trade',
      refId: trade.tradeId,
    });

    // Maker gets shares
    positionUpdates.push({
      userId: trade.makerUserId,
      marketId: trade.marketId,
      outcome: trade.outcome,
      deltaShares: trade.quantity,
      deltaReservedShares: new Decimal(0),
      tradePrice: trade.price,
    });

    // Taker (seller): give up reserved shares, get USDC minus fee
    ledgerEntries.push({
      userId: trade.takerUserId,
      deltaAvailable: netToSeller,
      deltaReserved: new Decimal(0),
      reason: 'TRADE_SELL',
      refType: 'trade',
      refId: trade.tradeId,
    });

    // Taker fee (already deducted from netToSeller, but we record it)
    if (trade.takerFee.gt(0)) {
      ledgerEntries.push({
        userId: SYSTEM_USER_ID,
        deltaAvailable: trade.takerFee,
        deltaReserved: new Decimal(0),
        reason: 'TRADE_FEE',
        refType: 'trade',
        refId: trade.tradeId,
      });
    }

    // Taker loses reserved shares
    positionUpdates.push({
      userId: trade.takerUserId,
      marketId: trade.marketId,
      outcome: trade.outcome,
      deltaShares: trade.quantity.neg(),
      deltaReservedShares: trade.quantity.neg(),
      tradePrice: trade.price,
    });
  }

  return { ledgerEntries, positionUpdates };
}

// ============================================
// Reserve Calculation
// ============================================

export interface ReserveForBuyResult {
  ledgerEntry: LedgerEntryInput;
  reserveAmount: Decimal;
}

/**
 * Calculate the reserve needed for a BUY order
 */
export function calculateBuyReserve(
  userId: string,
  orderId: string,
  price: Decimal,
  quantity: Decimal
): ReserveForBuyResult {
  const reserveAmount = price.times(quantity);
  
  return {
    ledgerEntry: {
      userId,
      deltaAvailable: reserveAmount.neg(),
      deltaReserved: reserveAmount,
      reason: 'ORDER_RESERVE',
      refType: 'order',
      refId: orderId,
    },
    reserveAmount,
  };
}

/**
 * Calculate the release for a cancelled/expired order
 */
export function calculateOrderRelease(
  userId: string,
  orderId: string,
  price: Decimal,
  remainingQuantity: Decimal
): LedgerEntryInput {
  const releaseAmount = price.times(remainingQuantity);
  
  return {
    userId,
    deltaAvailable: releaseAmount,
    deltaReserved: releaseAmount.neg(),
    reason: 'ORDER_RESERVE_RELEASE',
    refType: 'order',
    refId: orderId,
  };
}
