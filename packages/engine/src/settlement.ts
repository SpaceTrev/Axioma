import { Match } from './matching';

export interface Settlement {
  matchId: string;
  buyerUserId: string;
  sellerUserId: string;
  quantity: number;
  price: number;
  timestamp: Date;
}

export class SettlementEngine {
  private settlements: Settlement[] = [];

  /**
   * Settle a match between buyer and seller
   */
  settle(match: Match, buyerUserId: string, sellerUserId: string): Settlement {
    const settlement: Settlement = {
      matchId: `${match.buyOrderId}-${match.sellOrderId}`,
      buyerUserId,
      sellerUserId,
      quantity: match.quantity,
      price: match.price,
      timestamp: new Date(),
    };

    this.settlements.push(settlement);
    return settlement;
  }

  /**
   * Get all settlements
   */
  getSettlements(): Settlement[] {
    return [...this.settlements];
  }

  /**
   * Get settlements for a specific user
   */
  getSettlementsForUser(userId: string): Settlement[] {
    return this.settlements.filter((s) => s.buyerUserId === userId || s.sellerUserId === userId);
  }
}
