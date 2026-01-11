import { MatchingEngine } from '../matching';
import { Order } from '@axioma/shared';

describe('MatchingEngine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    engine = new MatchingEngine();
  });

  it('should match a buy order with a sell order at the same price', () => {
    const buyOrder: Order = {
      id: 'buy-1',
      userId: 'user-1',
      marketId: 'market-1',
      side: 'BUY',
      price: 0.6,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sellOrder: Order = {
      id: 'sell-1',
      userId: 'user-2',
      marketId: 'market-1',
      side: 'SELL',
      price: 0.6,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    engine.addOrder(buyOrder);
    const matches = engine.addOrder(sellOrder);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      price: 0.6,
      quantity: 100,
    });
  });

  it('should not match when buy price is lower than sell price', () => {
    const buyOrder: Order = {
      id: 'buy-1',
      userId: 'user-1',
      marketId: 'market-1',
      side: 'BUY',
      price: 0.5,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sellOrder: Order = {
      id: 'sell-1',
      userId: 'user-2',
      marketId: 'market-1',
      side: 'SELL',
      price: 0.6,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    engine.addOrder(buyOrder);
    const matches = engine.addOrder(sellOrder);

    expect(matches).toHaveLength(0);
    const orderBook = engine.getOrderBook();
    expect(orderBook.buys).toHaveLength(1);
    expect(orderBook.sells).toHaveLength(1);
  });

  it('should partially fill orders when quantities do not match', () => {
    const buyOrder: Order = {
      id: 'buy-1',
      userId: 'user-1',
      marketId: 'market-1',
      side: 'BUY',
      price: 0.6,
      quantity: 150,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sellOrder: Order = {
      id: 'sell-1',
      userId: 'user-2',
      marketId: 'market-1',
      side: 'SELL',
      price: 0.6,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    engine.addOrder(buyOrder);
    const matches = engine.addOrder(sellOrder);

    expect(matches).toHaveLength(1);
    expect(matches[0].quantity).toBe(100);

    const orderBook = engine.getOrderBook();
    expect(orderBook.buys).toHaveLength(1);
    expect(orderBook.buys[0].filled).toBe(100);
    expect(orderBook.sells).toHaveLength(0);
  });

  it('should match multiple orders', () => {
    const buyOrder1: Order = {
      id: 'buy-1',
      userId: 'user-1',
      marketId: 'market-1',
      side: 'BUY',
      price: 0.6,
      quantity: 50,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const buyOrder2: Order = {
      id: 'buy-2',
      userId: 'user-2',
      marketId: 'market-1',
      side: 'BUY',
      price: 0.65,
      quantity: 50,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const sellOrder: Order = {
      id: 'sell-1',
      userId: 'user-3',
      marketId: 'market-1',
      side: 'SELL',
      price: 0.6,
      quantity: 100,
      filled: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    engine.addOrder(buyOrder1);
    engine.addOrder(buyOrder2);
    const matches = engine.addOrder(sellOrder);

    expect(matches).toHaveLength(2);
    expect(matches[0].buyOrderId).toBe('buy-2'); // Higher price matched first
    expect(matches[1].buyOrderId).toBe('buy-1');
  });
});
