import { SettlementEngine } from '../settlement';
import { Match } from '../matching';

describe('SettlementEngine', () => {
  let engine: SettlementEngine;

  beforeEach(() => {
    engine = new SettlementEngine();
  });

  it('should settle a match', () => {
    const match: Match = {
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      price: 0.6,
      quantity: 100,
    };

    const settlement = engine.settle(match, 'buyer-1', 'seller-1');

    expect(settlement).toMatchObject({
      matchId: 'buy-1-sell-1',
      buyerUserId: 'buyer-1',
      sellerUserId: 'seller-1',
      quantity: 100,
      price: 0.6,
    });
    expect(settlement.timestamp).toBeInstanceOf(Date);
  });

  it('should track multiple settlements', () => {
    const match1: Match = {
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      price: 0.6,
      quantity: 100,
    };

    const match2: Match = {
      buyOrderId: 'buy-2',
      sellOrderId: 'sell-2',
      price: 0.7,
      quantity: 50,
    };

    engine.settle(match1, 'buyer-1', 'seller-1');
    engine.settle(match2, 'buyer-2', 'seller-2');

    const settlements = engine.getSettlements();
    expect(settlements).toHaveLength(2);
  });

  it('should get settlements for a specific user', () => {
    const match1: Match = {
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      price: 0.6,
      quantity: 100,
    };

    const match2: Match = {
      buyOrderId: 'buy-2',
      sellOrderId: 'sell-2',
      price: 0.7,
      quantity: 50,
    };

    engine.settle(match1, 'user-1', 'user-2');
    engine.settle(match2, 'user-3', 'user-1');

    const userSettlements = engine.getSettlementsForUser('user-1');
    expect(userSettlements).toHaveLength(2);
  });
});
