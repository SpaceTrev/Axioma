import { Order } from '@axioma/shared';

export interface Match {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
}

export class MatchingEngine {
  private buyOrders: Order[] = [];
  private sellOrders: Order[] = [];

  /**
   * Add an order to the order book
   */
  addOrder(order: Order): Match[] {
    if (order.side === 'BUY') {
      this.buyOrders.push(order);
      this.buyOrders.sort((a, b) => b.price - a.price); // Descending by price
    } else {
      this.sellOrders.push(order);
      this.sellOrders.sort((a, b) => a.price - b.price); // Ascending by price
    }

    return this.matchOrders();
  }

  /**
   * Match buy and sell orders
   */
  private matchOrders(): Match[] {
    const matches: Match[] = [];

    while (this.buyOrders.length > 0 && this.sellOrders.length > 0) {
      const buyOrder = this.buyOrders[0];
      const sellOrder = this.sellOrders[0];

      // Check if orders can match
      if (buyOrder.price < sellOrder.price) {
        break;
      }

      const matchPrice = sellOrder.price; // Price maker (sell order in this case)
      const buyRemaining = buyOrder.quantity - buyOrder.filled;
      const sellRemaining = sellOrder.quantity - sellOrder.filled;
      const matchQuantity = Math.min(buyRemaining, sellRemaining);

      matches.push({
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        price: matchPrice,
        quantity: matchQuantity,
      });

      // Update filled quantities
      buyOrder.filled += matchQuantity;
      sellOrder.filled += matchQuantity;

      // Remove fully filled orders
      if (buyOrder.filled >= buyOrder.quantity) {
        this.buyOrders.shift();
      }
      if (sellOrder.filled >= sellOrder.quantity) {
        this.sellOrders.shift();
      }
    }

    return matches;
  }

  /**
   * Get current order book state
   */
  getOrderBook() {
    return {
      buys: [...this.buyOrders],
      sells: [...this.sellOrders],
    };
  }
}
