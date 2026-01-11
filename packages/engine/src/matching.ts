import Decimal from 'decimal.js';
import {
  calculateTakerFee,
  FeeConfig,
  DEFAULT_FEE_CONFIG,
  Outcome,
} from '@axioma/ledger';

// ============================================
// Types
// ============================================

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED';

export interface EngineOrder {
  id: string;
  userId: string;
  marketId: string;
  outcome: Outcome;
  side: OrderSide;
  price: Decimal;
  quantity: Decimal;
  remaining: Decimal;
  createdAt: Date;
}

export interface MatchResult {
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  price: Decimal;
  quantity: Decimal;
  takerFee: Decimal;
}

export interface OrderBookLevel {
  price: Decimal;
  quantity: Decimal;
  orderCount: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[]; // BUY orders, sorted DESC by price
  asks: OrderBookLevel[]; // SELL orders, sorted ASC by price
}

// ============================================
// Pure Matching Engine
// ============================================

/**
 * Deterministic matching engine for a single outcome (YES or NO).
 * This is a pure functional implementation - all state changes are returned,
 * not applied internally.
 */
export class MatchingEngine {
  private buyOrders: EngineOrder[] = [];
  private sellOrders: EngineOrder[] = [];
  private feeConfig: FeeConfig;

  constructor(feeConfig: FeeConfig = DEFAULT_FEE_CONFIG) {
    this.feeConfig = feeConfig;
  }

  /**
   * Add an order and attempt to match.
   * Returns all matches and the final state of the incoming order.
   */
  addOrder(order: EngineOrder): {
    matches: MatchResult[];
    remainingOrder: EngineOrder | null;
  } {
    const matches: MatchResult[] = [];
    let currentOrder = { ...order };

    if (order.side === 'BUY') {
      // Match against sell orders
      while (
        currentOrder.remaining.gt(0) &&
        this.sellOrders.length > 0 &&
        this.sellOrders[0].price.lte(currentOrder.price)
      ) {
        const makerOrder = this.sellOrders[0];
        const matchQty = Decimal.min(currentOrder.remaining, makerOrder.remaining);
        const matchPrice = makerOrder.price; // Maker price
        const tradeValue = matchQty.times(matchPrice);
        const takerFee = calculateTakerFee(tradeValue, this.feeConfig);

        matches.push({
          makerOrderId: makerOrder.id,
          takerOrderId: currentOrder.id,
          makerUserId: makerOrder.userId,
          takerUserId: currentOrder.userId,
          price: matchPrice,
          quantity: matchQty,
          takerFee,
        });

        // Update remaining quantities
        currentOrder.remaining = currentOrder.remaining.minus(matchQty);
        makerOrder.remaining = makerOrder.remaining.minus(matchQty);

        // Remove filled maker orders
        if (makerOrder.remaining.isZero()) {
          this.sellOrders.shift();
        }
      }

      // Add remaining to book if not filled
      if (currentOrder.remaining.gt(0)) {
        this.insertBuyOrder(currentOrder);
        return { matches, remainingOrder: currentOrder };
      }
    } else {
      // SELL order - match against buy orders
      while (
        currentOrder.remaining.gt(0) &&
        this.buyOrders.length > 0 &&
        this.buyOrders[0].price.gte(currentOrder.price)
      ) {
        const makerOrder = this.buyOrders[0];
        const matchQty = Decimal.min(currentOrder.remaining, makerOrder.remaining);
        const matchPrice = makerOrder.price; // Maker price
        const tradeValue = matchQty.times(matchPrice);
        const takerFee = calculateTakerFee(tradeValue, this.feeConfig);

        matches.push({
          makerOrderId: makerOrder.id,
          takerOrderId: currentOrder.id,
          makerUserId: makerOrder.userId,
          takerUserId: currentOrder.userId,
          price: matchPrice,
          quantity: matchQty,
          takerFee,
        });

        // Update remaining quantities
        currentOrder.remaining = currentOrder.remaining.minus(matchQty);
        makerOrder.remaining = makerOrder.remaining.minus(matchQty);

        // Remove filled maker orders
        if (makerOrder.remaining.isZero()) {
          this.buyOrders.shift();
        }
      }

      // Add remaining to book if not filled
      if (currentOrder.remaining.gt(0)) {
        this.insertSellOrder(currentOrder);
        return { matches, remainingOrder: currentOrder };
      }
    }

    return { matches, remainingOrder: currentOrder.remaining.isZero() ? null : currentOrder };
  }

  /**
   * Cancel an order by ID
   */
  cancelOrder(orderId: string): EngineOrder | null {
    // Try buy orders
    const buyIndex = this.buyOrders.findIndex((o) => o.id === orderId);
    if (buyIndex !== -1) {
      const [removed] = this.buyOrders.splice(buyIndex, 1);
      return removed;
    }

    // Try sell orders
    const sellIndex = this.sellOrders.findIndex((o) => o.id === orderId);
    if (sellIndex !== -1) {
      const [removed] = this.sellOrders.splice(sellIndex, 1);
      return removed;
    }

    return null;
  }

  /**
   * Get all open orders (for cancellation on market cancel)
   */
  getAllOrders(): EngineOrder[] {
    return [...this.buyOrders, ...this.sellOrders];
  }

  /**
   * Clear all orders (used when market is resolved/cancelled)
   */
  clearAllOrders(): EngineOrder[] {
    const all = this.getAllOrders();
    this.buyOrders = [];
    this.sellOrders = [];
    return all;
  }

  /**
   * Get aggregated order book snapshot
   */
  getOrderBook(): OrderBookSnapshot {
    return {
      bids: this.aggregateLevels(this.buyOrders),
      asks: this.aggregateLevels(this.sellOrders),
    };
  }

  /**
   * Get best bid price (highest buy)
   */
  getBestBid(): Decimal | null {
    return this.buyOrders.length > 0 ? this.buyOrders[0].price : null;
  }

  /**
   * Get best ask price (lowest sell)
   */
  getBestAsk(): Decimal | null {
    return this.sellOrders.length > 0 ? this.sellOrders[0].price : null;
  }

  /**
   * Get midpoint price
   */
  getMidpoint(): Decimal | null {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (bid && ask) {
      return bid.plus(ask).div(2);
    }
    return bid || ask || null;
  }

  // ============================================
  // Private helpers
  // ============================================

  private insertBuyOrder(order: EngineOrder): void {
    // BUY orders sorted by price DESC, then createdAt ASC (price-time priority)
    const insertIndex = this.buyOrders.findIndex(
      (o) =>
        o.price.lt(order.price) ||
        (o.price.eq(order.price) && o.createdAt > order.createdAt)
    );
    if (insertIndex === -1) {
      this.buyOrders.push(order);
    } else {
      this.buyOrders.splice(insertIndex, 0, order);
    }
  }

  private insertSellOrder(order: EngineOrder): void {
    // SELL orders sorted by price ASC, then createdAt ASC (price-time priority)
    const insertIndex = this.sellOrders.findIndex(
      (o) =>
        o.price.gt(order.price) ||
        (o.price.eq(order.price) && o.createdAt > order.createdAt)
    );
    if (insertIndex === -1) {
      this.sellOrders.push(order);
    } else {
      this.sellOrders.splice(insertIndex, 0, order);
    }
  }

  private aggregateLevels(orders: EngineOrder[]): OrderBookLevel[] {
    const levels = new Map<string, OrderBookLevel>();

    for (const order of orders) {
      const key = order.price.toString();
      const existing = levels.get(key);
      if (existing) {
        existing.quantity = existing.quantity.plus(order.remaining);
        existing.orderCount++;
      } else {
        levels.set(key, {
          price: order.price,
          quantity: order.remaining,
          orderCount: 1,
        });
      }
    }

    return Array.from(levels.values());
  }
}

// ============================================
// Factory for market-wide order books
// ============================================

export interface MarketOrderBooks {
  YES: MatchingEngine;
  NO: MatchingEngine;
}

export function createMarketOrderBooks(
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG
): MarketOrderBooks {
  return {
    YES: new MatchingEngine(feeConfig),
    NO: new MatchingEngine(feeConfig),
  };
}
