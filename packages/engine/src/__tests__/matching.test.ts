import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { MatchingEngine, EngineOrder } from '../matching';
import { DEFAULT_FEE_CONFIG } from '@axioma/ledger';

describe('MatchingEngine', () => {
  let engine: MatchingEngine;

  const createOrder = (
    overrides: Partial<EngineOrder> & { id: string }
  ): EngineOrder => ({
    userId: 'user1',
    marketId: 'market1',
    outcome: 'YES',
    side: 'BUY',
    price: new Decimal('0.5'),
    quantity: new Decimal(100),
    remaining: new Decimal(100),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    engine = new MatchingEngine(DEFAULT_FEE_CONFIG);
  });

  describe('Order Book Sorting', () => {
    it('should sort BUY orders by price DESC, time ASC', () => {
      engine.addOrder(
        createOrder({
          id: 'order1',
          side: 'BUY',
          price: new Decimal('0.5'),
          createdAt: new Date('2024-01-01T00:00:00Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'order2',
          side: 'BUY',
          price: new Decimal('0.6'),
          createdAt: new Date('2024-01-01T00:00:01Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'order3',
          side: 'BUY',
          price: new Decimal('0.5'),
          createdAt: new Date('2024-01-01T00:00:02Z'),
        })
      );

      const book = engine.getOrderBook();
      expect(book.bids).toHaveLength(2); // Aggregated by price
      expect(book.bids[0].price.toString()).toBe('0.6');
      expect(book.bids[1].price.toString()).toBe('0.5');
    });

    it('should sort SELL orders by price ASC, time ASC', () => {
      engine.addOrder(
        createOrder({
          id: 'order1',
          side: 'SELL',
          price: new Decimal('0.6'),
          createdAt: new Date('2024-01-01T00:00:00Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'order2',
          side: 'SELL',
          price: new Decimal('0.5'),
          createdAt: new Date('2024-01-01T00:00:01Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'order3',
          side: 'SELL',
          price: new Decimal('0.6'),
          createdAt: new Date('2024-01-01T00:00:02Z'),
        })
      );

      const book = engine.getOrderBook();
      expect(book.asks).toHaveLength(2); // Aggregated by price
      expect(book.asks[0].price.toString()).toBe('0.5');
      expect(book.asks[1].price.toString()).toBe('0.6');
    });
  });

  describe('Order Matching', () => {
    it('should match when BUY price >= SELL price', () => {
      // First, add a SELL order (maker)
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      // Then add a BUY order (taker) at same or higher price
      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].makerOrderId).toBe('sell1');
      expect(result.matches[0].takerOrderId).toBe('buy1');
      expect(result.matches[0].price.toString()).toBe('0.5');
      expect(result.matches[0].quantity.toString()).toBe('100');
    });

    it('should use maker price for trade', () => {
      // SELL at 0.50
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      // BUY at 0.60 (willing to pay more)
      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.6'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      // Trade should happen at maker (SELL) price
      expect(result.matches[0].price.toString()).toBe('0.5');
    });

    it('should not match when BUY price < SELL price', () => {
      engine.addOrder(
        createOrder({
          id: 'sell1',
          side: 'SELL',
          price: new Decimal('0.6'),
        })
      );

      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          side: 'BUY',
          price: new Decimal('0.5'),
        })
      );

      expect(result.matches).toHaveLength(0);
      expect(engine.getOrderBook().bids).toHaveLength(1);
      expect(engine.getOrderBook().asks).toHaveLength(1);
    });
  });

  describe('Partial Fills', () => {
    it('should partially fill when taker quantity < maker quantity', () => {
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
        })
      );

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].quantity.toString()).toBe('50');
      expect(result.remainingOrder).toBeNull(); // Taker fully filled

      // Maker should have 50 remaining
      const book = engine.getOrderBook();
      expect(book.asks).toHaveLength(1);
      expect(book.asks[0].quantity.toString()).toBe('50');
    });

    it('should partially fill when taker quantity > maker quantity', () => {
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
        })
      );

      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].quantity.toString()).toBe('50');
      expect(result.remainingOrder).not.toBeNull();
      expect(result.remainingOrder!.remaining.toString()).toBe('50');

      // Taker's remaining should be in buy book
      const book = engine.getOrderBook();
      expect(book.bids).toHaveLength(1);
      expect(book.bids[0].quantity.toString()).toBe('50');
    });

    it('should match against multiple makers', () => {
      // Add multiple SELL orders
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller1',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(30),
          remaining: new Decimal(30),
          createdAt: new Date('2024-01-01T00:00:00Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'sell2',
          userId: 'seller2',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(30),
          remaining: new Decimal(30),
          createdAt: new Date('2024-01-01T00:00:01Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'sell3',
          userId: 'seller3',
          side: 'SELL',
          price: new Decimal('0.6'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
          createdAt: new Date('2024-01-01T00:00:02Z'),
        })
      );

      // BUY order that can match all at 0.5 and some at 0.6
      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.6'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      expect(result.matches).toHaveLength(3);
      // First two fills at 0.5
      expect(result.matches[0].price.toString()).toBe('0.5');
      expect(result.matches[0].quantity.toString()).toBe('30');
      expect(result.matches[1].price.toString()).toBe('0.5');
      expect(result.matches[1].quantity.toString()).toBe('30');
      // Third fill at 0.6
      expect(result.matches[2].price.toString()).toBe('0.6');
      expect(result.matches[2].quantity.toString()).toBe('40');

      // sell3 should have 10 remaining
      const book = engine.getOrderBook();
      expect(book.asks).toHaveLength(1);
      expect(book.asks[0].quantity.toString()).toBe('10');
    });
  });

  describe('Price-Time Priority', () => {
    it('should match best price first (BUY side)', () => {
      // Add multiple BUY orders at different prices
      engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer1',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
          createdAt: new Date('2024-01-01T00:00:00Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'buy2',
          userId: 'buyer2',
          side: 'BUY',
          price: new Decimal('0.6'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
          createdAt: new Date('2024-01-01T00:00:01Z'),
        })
      );

      // SELL order should match highest BUY first
      const result = engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
        })
      );

      expect(result.matches[0].makerOrderId).toBe('buy2');
      expect(result.matches[0].price.toString()).toBe('0.6');
    });

    it('should match earlier order first at same price', () => {
      // Add multiple BUY orders at same price
      engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer1',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
          createdAt: new Date('2024-01-01T00:00:00Z'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'buy2',
          userId: 'buyer2',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
          createdAt: new Date('2024-01-01T00:00:01Z'),
        })
      );

      // SELL order should match earlier BUY first
      const result = engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(50),
          remaining: new Decimal(50),
        })
      );

      expect(result.matches[0].makerOrderId).toBe('buy1');
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate taker fee correctly', () => {
      engine.addOrder(
        createOrder({
          id: 'sell1',
          userId: 'seller',
          side: 'SELL',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      const result = engine.addOrder(
        createOrder({
          id: 'buy1',
          userId: 'buyer',
          side: 'BUY',
          price: new Decimal('0.5'),
          quantity: new Decimal(100),
          remaining: new Decimal(100),
        })
      );

      // Trade value = 100 * 0.5 = 50
      // Taker fee = 50 * 0.01 = 0.5
      expect(result.matches[0].takerFee.toString()).toBe('0.5');
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel an existing order', () => {
      engine.addOrder(createOrder({ id: 'buy1', side: 'BUY' }));
      engine.addOrder(createOrder({ id: 'sell1', side: 'SELL', price: new Decimal('0.6') }));

      const cancelled = engine.cancelOrder('buy1');
      expect(cancelled).not.toBeNull();
      expect(cancelled!.id).toBe('buy1');

      const book = engine.getOrderBook();
      expect(book.bids).toHaveLength(0);
      expect(book.asks).toHaveLength(1);
    });

    it('should return null for non-existent order', () => {
      const cancelled = engine.cancelOrder('nonexistent');
      expect(cancelled).toBeNull();
    });
  });

  describe('Order Book Queries', () => {
    it('should return best bid and ask', () => {
      engine.addOrder(
        createOrder({
          id: 'buy1',
          side: 'BUY',
          price: new Decimal('0.45'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'buy2',
          side: 'BUY',
          price: new Decimal('0.50'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'sell1',
          side: 'SELL',
          price: new Decimal('0.55'),
        })
      );
      engine.addOrder(
        createOrder({
          id: 'sell2',
          side: 'SELL',
          price: new Decimal('0.60'),
        })
      );

      expect(engine.getBestBid()!.toString()).toBe('0.5');
      expect(engine.getBestAsk()!.toString()).toBe('0.55');
      expect(engine.getMidpoint()!.toString()).toBe('0.525');
    });

    it('should return null for empty book', () => {
      expect(engine.getBestBid()).toBeNull();
      expect(engine.getBestAsk()).toBeNull();
      expect(engine.getMidpoint()).toBeNull();
    });
  });
});
