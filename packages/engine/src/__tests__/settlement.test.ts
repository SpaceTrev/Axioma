import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateSettlement,
  calculateCancellation,
  calculateTradeSettlement,
  calculateBuyReserve,
  calculateOrderRelease,
  PositionForSettlement,
  OrderForCancellation,
} from '../settlement';
import { SYSTEM_USER_ID } from '@axioma/ledger';

describe('Settlement', () => {
  describe('calculateSettlement', () => {
    it('should pay out winners at 1.0 USDC per share', () => {
      const positions: PositionForSettlement[] = [
        {
          userId: 'winner',
          marketId: 'market1',
          outcome: 'YES',
          shares: new Decimal(100),
          reservedShares: new Decimal(0),
          avgPrice: new Decimal('0.6'),
        },
        {
          userId: 'loser',
          marketId: 'market1',
          outcome: 'NO',
          shares: new Decimal(50),
          reservedShares: new Decimal(0),
          avgPrice: new Decimal('0.4'),
        },
      ];

      const result = calculateSettlement('market1', 'YES', positions);

      // Winner gets 100 USDC (100 shares * 1.0)
      const winnerEntry = result.ledgerEntries.find(
        (e) => e.userId === 'winner' && e.reason === 'SETTLEMENT_WIN'
      );
      expect(winnerEntry).toBeDefined();
      expect(winnerEntry!.deltaAvailable.toString()).toBe('100');

      // Loser gets recorded but no payout
      const loserEntry = result.ledgerEntries.find(
        (e) => e.userId === 'loser' && e.reason === 'SETTLEMENT_LOSS'
      );
      expect(loserEntry).toBeDefined();
      expect(loserEntry!.deltaAvailable.toString()).toBe('0');

      // Both positions should be cleared
      expect(result.positionUpdates).toHaveLength(2);
      for (const update of result.positionUpdates) {
        expect(update.newShares.toString()).toBe('0');
        expect(update.newReservedShares.toString()).toBe('0');
      }
    });

    it('should handle multiple winners', () => {
      const positions: PositionForSettlement[] = [
        {
          userId: 'winner1',
          marketId: 'market1',
          outcome: 'YES',
          shares: new Decimal(100),
          reservedShares: new Decimal(0),
          avgPrice: new Decimal('0.5'),
        },
        {
          userId: 'winner2',
          marketId: 'market1',
          outcome: 'YES',
          shares: new Decimal(200),
          reservedShares: new Decimal(0),
          avgPrice: new Decimal('0.7'),
        },
      ];

      const result = calculateSettlement('market1', 'YES', positions);

      expect(result.ledgerEntries).toHaveLength(2);
      expect(result.ledgerEntries[0].deltaAvailable.toString()).toBe('100');
      expect(result.ledgerEntries[1].deltaAvailable.toString()).toBe('200');
    });

    it('should skip zero-share positions', () => {
      const positions: PositionForSettlement[] = [
        {
          userId: 'empty',
          marketId: 'market1',
          outcome: 'YES',
          shares: new Decimal(0),
          reservedShares: new Decimal(0),
          avgPrice: new Decimal(0),
        },
      ];

      const result = calculateSettlement('market1', 'YES', positions);

      expect(result.ledgerEntries).toHaveLength(0);
      expect(result.positionUpdates).toHaveLength(0);
    });
  });

  describe('calculateCancellation', () => {
    it('should release reserved USDC for BUY orders', () => {
      const openOrders: OrderForCancellation[] = [
        {
          id: 'order1',
          userId: 'buyer',
          marketId: 'market1',
          outcome: 'YES',
          side: 'BUY',
          price: new Decimal('0.5'),
          remaining: new Decimal(100),
        },
      ];

      const result = calculateCancellation('market1', openOrders, []);

      expect(result.ledgerEntries).toHaveLength(1);
      expect(result.ledgerEntries[0].userId).toBe('buyer');
      expect(result.ledgerEntries[0].deltaAvailable.toString()).toBe('50'); // 100 * 0.5
      expect(result.ledgerEntries[0].deltaReserved.toString()).toBe('-50');
      expect(result.ledgerEntries[0].reason).toBe('MARKET_CANCEL_REFUND');
      expect(result.orderIds).toContain('order1');
    });

    it('should release reserved shares for SELL orders', () => {
      const openOrders: OrderForCancellation[] = [
        {
          id: 'order1',
          userId: 'seller',
          marketId: 'market1',
          outcome: 'YES',
          side: 'SELL',
          price: new Decimal('0.5'),
          remaining: new Decimal(100),
        },
      ];

      const result = calculateCancellation('market1', openOrders, []);

      expect(result.ledgerEntries).toHaveLength(0); // No USDC changes for SELL
      expect(result.positionUpdates).toHaveLength(1);
      expect(result.positionUpdates[0].userId).toBe('seller');
      expect(result.positionUpdates[0].releaseReservedShares.toString()).toBe('100');
    });

    it('should aggregate multiple SELL orders for same user/outcome', () => {
      const openOrders: OrderForCancellation[] = [
        {
          id: 'order1',
          userId: 'seller',
          marketId: 'market1',
          outcome: 'YES',
          side: 'SELL',
          price: new Decimal('0.5'),
          remaining: new Decimal(50),
        },
        {
          id: 'order2',
          userId: 'seller',
          marketId: 'market1',
          outcome: 'YES',
          side: 'SELL',
          price: new Decimal('0.6'),
          remaining: new Decimal(30),
        },
      ];

      const result = calculateCancellation('market1', openOrders, []);

      expect(result.positionUpdates).toHaveLength(1);
      expect(result.positionUpdates[0].releaseReservedShares.toString()).toBe('80');
    });
  });

  describe('calculateTradeSettlement', () => {
    it('should settle BUY taker vs SELL maker correctly', () => {
      const result = calculateTradeSettlement({
        tradeId: 'trade1',
        marketId: 'market1',
        outcome: 'YES',
        makerOrderId: 'sell1',
        takerOrderId: 'buy1',
        makerUserId: 'seller',
        takerUserId: 'buyer',
        makerSide: 'SELL',
        price: new Decimal('0.5'),
        quantity: new Decimal(100),
        takerFee: new Decimal('0.5'),
      });

      // Trade value = 100 * 0.5 = 50
      // Taker fee = 0.5
      // Net to seller = 50 - 0.5 = 49.5

      // Buyer: consume reserved USDC
      const buyerEntry = result.ledgerEntries.find(
        (e) => e.userId === 'buyer' && e.reason === 'TRADE_BUY'
      );
      expect(buyerEntry!.deltaReserved.toString()).toBe('-50');

      // Buyer: pay fee
      const buyerFeeEntry = result.ledgerEntries.find(
        (e) => e.userId === 'buyer' && e.reason === 'TRADE_FEE'
      );
      expect(buyerFeeEntry!.deltaAvailable.toString()).toBe('-0.5');

      // System: receive fee
      const systemFeeEntry = result.ledgerEntries.find(
        (e) => e.userId === SYSTEM_USER_ID && e.reason === 'TRADE_FEE'
      );
      expect(systemFeeEntry!.deltaAvailable.toString()).toBe('0.5');

      // Seller: receive USDC (minus fee already taken)
      const sellerEntry = result.ledgerEntries.find(
        (e) => e.userId === 'seller' && e.reason === 'TRADE_SELL'
      );
      expect(sellerEntry!.deltaAvailable.toString()).toBe('49.5');

      // Position updates
      const buyerPosition = result.positionUpdates.find((p) => p.userId === 'buyer');
      expect(buyerPosition!.deltaShares.toString()).toBe('100');

      const sellerPosition = result.positionUpdates.find((p) => p.userId === 'seller');
      expect(sellerPosition!.deltaShares.toString()).toBe('-100');
      expect(sellerPosition!.deltaReservedShares.toString()).toBe('-100');
    });

    it('should settle SELL taker vs BUY maker correctly', () => {
      const result = calculateTradeSettlement({
        tradeId: 'trade1',
        marketId: 'market1',
        outcome: 'YES',
        makerOrderId: 'buy1',
        takerOrderId: 'sell1',
        makerUserId: 'buyer',
        takerUserId: 'seller',
        makerSide: 'BUY',
        price: new Decimal('0.5'),
        quantity: new Decimal(100),
        takerFee: new Decimal('0.5'),
      });

      // Maker (buyer): consume reserved USDC, get shares
      const makerBuyEntry = result.ledgerEntries.find(
        (e) => e.userId === 'buyer' && e.reason === 'TRADE_BUY'
      );
      expect(makerBuyEntry!.deltaReserved.toString()).toBe('-50');

      // Taker (seller): get USDC minus fee
      const takerSellEntry = result.ledgerEntries.find(
        (e) => e.userId === 'seller' && e.reason === 'TRADE_SELL'
      );
      expect(takerSellEntry!.deltaAvailable.toString()).toBe('49.5');

      // Buyer gets shares
      const buyerPosition = result.positionUpdates.find((p) => p.userId === 'buyer');
      expect(buyerPosition!.deltaShares.toString()).toBe('100');

      // Seller loses shares
      const sellerPosition = result.positionUpdates.find((p) => p.userId === 'seller');
      expect(sellerPosition!.deltaShares.toString()).toBe('-100');
    });
  });

  describe('calculateBuyReserve', () => {
    it('should calculate correct reserve amount', () => {
      const result = calculateBuyReserve(
        'user1',
        'order1',
        new Decimal('0.6'),
        new Decimal(100)
      );

      expect(result.reserveAmount.toString()).toBe('60');
      expect(result.ledgerEntry.deltaAvailable.toString()).toBe('-60');
      expect(result.ledgerEntry.deltaReserved.toString()).toBe('60');
      expect(result.ledgerEntry.reason).toBe('ORDER_RESERVE');
    });
  });

  describe('calculateOrderRelease', () => {
    it('should calculate correct release amount', () => {
      const result = calculateOrderRelease(
        'user1',
        'order1',
        new Decimal('0.6'),
        new Decimal(50)
      );

      expect(result.deltaAvailable.toString()).toBe('30');
      expect(result.deltaReserved.toString()).toBe('-30');
      expect(result.reason).toBe('ORDER_RESERVE_RELEASE');
    });
  });
});
