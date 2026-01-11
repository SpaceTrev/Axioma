# Matching Engine Design

This document describes the design and implementation of Axioma's deterministic order matching engine.

## Overview

The matching engine is responsible for:
1. Maintaining order books for each market/outcome combination
2. Matching incoming orders against resting orders
3. Generating trades when orders match
4. Providing order book snapshots and market data

## Order Book Structure

Each market has two order books (YES and NO). Each order book contains:
- **Bids**: BUY orders sorted by price descending, then by time ascending
- **Asks**: SELL orders sorted by price ascending, then by time ascending

```
YES Order Book:
┌─────────────────────────────────────┐
│  BIDS (Buy YES)   │  ASKS (Sell YES) │
│  0.65 @ 100 qty   │  0.70 @ 50 qty   │
│  0.60 @ 200 qty   │  0.75 @ 100 qty  │
│  0.55 @ 150 qty   │  0.80 @ 75 qty   │
└─────────────────────────────────────┘
```

## Matching Algorithm

### Price-Time Priority (FIFO)

Orders are matched using strict price-time priority:

1. **Price Priority**: Best price always matches first
   - For BIDS: highest price first
   - For ASKS: lowest price first

2. **Time Priority**: Among orders at the same price, earliest order matches first

### Matching Logic

When a new order arrives:

1. **BUY order**: Match against ASKS (sell orders)
   - Find asks with price ≤ buy price
   - Trade at the ASK (maker) price
   
2. **SELL order**: Match against BIDS (buy orders)
   - Find bids with price ≥ sell price
   - Trade at the BID (maker) price

```typescript
// Pseudocode
function match(incomingOrder):
  if incomingOrder.side == BUY:
    matchAgainst = asks.filter(a => a.price <= incomingOrder.price)
  else:
    matchAgainst = bids.filter(b => b.price >= incomingOrder.price)
  
  for each makerOrder in matchAgainst:
    tradeQty = min(incomingOrder.remainingQty, makerOrder.remainingQty)
    tradePrice = makerOrder.price  // Trade at maker price
    
    createTrade(tradeQty, tradePrice)
    updateOrderQuantities()
    
    if incomingOrder.remainingQty == 0:
      break
```

### Trade Execution

When orders match:

1. Trade is created with:
   - Price = Maker (resting) order's price
   - Quantity = min(taker remaining, maker remaining)
   
2. Both orders' remaining quantities are reduced

3. Orders with remaining quantity = 0 are marked FILLED

4. Taker fee (1% default) is applied to the taker's side

## Reserve System

### BUY Orders

When placing a BUY order:
- Reserve = price × quantity
- This amount is moved from available to reserved balance

```
User Balance:
  Available: 1000 USDC → 900 USDC
  Reserved:  0 USDC → 100 USDC
  
Order: BUY 100 YES @ 1.00
```

### SELL Orders

When placing a SELL order:
- Must own sufficient shares of the outcome
- Shares are moved to reservedShares in the Position

```
User Position (YES):
  Shares: 100 → 50
  Reserved: 0 → 50
  
Order: SELL 50 YES @ 0.80
```

### Reserve Release

Reserves are released when:
- Order is cancelled
- Order is filled (reserves become trade settlement)
- Market is cancelled (full refund)

## Settlement

### Trade Settlement

When a trade executes:

**Buyer**:
- Pays: tradePrice × quantity (from reserved balance)
- Receives: quantity shares

**Seller**:
- Receives: tradePrice × quantity (to available balance)
- Pays: quantity shares (from reserved shares)

**Fees**:
- Taker pays 1% fee on the trade value
- Fee is deducted from payout and credited to system account

### Market Resolution

When a market is resolved:

1. Identify winning outcome (YES or NO)
2. For each position in the winning outcome:
   - Credit 1.0 USDC per share to the holder
3. Positions in the losing outcome receive nothing
4. Cancel all open orders and release reserves

```
Market: "Will BTC reach $100K by Dec 2024?"
Resolution: YES wins

User A (100 YES shares): +100 USDC
User B (50 NO shares): +0 USDC
User C (open BUY order): reserves returned
```

### Market Cancellation

If a market is cancelled (invalid, duplicate, etc.):

1. All open orders are cancelled
2. All reserves (balance and shares) are released
3. No payouts occur

## Determinism

The matching engine is designed to be fully deterministic:

1. **No randomness**: Same inputs always produce same outputs
2. **Ordered processing**: Orders are processed in arrival order
3. **Decimal precision**: Uses Decimal.js with 18 decimal places
4. **No floating point**: All calculations use string-based decimals

This ensures:
- Reproducible results for testing
- Consistent behavior across environments
- Auditability of all matches

## In-Memory Order Books

For the MVP, order books are maintained in-memory:

```typescript
const orderBooks = new Map<string, {
  YES: { bids: Order[], asks: Order[] },
  NO: { bids: Order[], asks: Order[] }
}>();
```

**Startup Recovery**:
On server restart, order books are rebuilt from the database by loading all OPEN orders.

**Trade-offs**:
- ✅ Fast matching (O(n) worst case, typically O(1))
- ✅ Simple implementation
- ❌ Lost on server restart (must rebuild)
- ❌ Single server only (no horizontal scaling)

Future versions could use Redis sorted sets or a dedicated matching service.

## API Integration

The matching engine exposes these methods:

```typescript
class MatchingEngine {
  // Add order to book, return matches
  addOrder(order: OrderInput): MatchResult
  
  // Remove order from book
  cancelOrder(marketId: string, outcome: Outcome, orderId: string): boolean
  
  // Get aggregated order book
  getOrderBook(marketId: string, outcome: Outcome): OrderBookSnapshot
  
  // Market data
  getBestBid(marketId: string, outcome: Outcome): Decimal | null
  getBestAsk(marketId: string, outcome: Outcome): Decimal | null
  getMidpoint(marketId: string, outcome: Outcome): Decimal | null
}
```

## Example Flow

```
1. User A: BUY 10 YES @ 0.60
   → No asks, order rests on bid side
   
2. User B: SELL 5 YES @ 0.55
   → Matches User A's bid at 0.60 (maker price)
   → Trade: 5 YES @ 0.60
   → User B receives 3.00 USDC (minus fee)
   → User A receives 5 YES shares
   → User A's order: 5 remaining @ 0.60
   
3. User C: SELL 10 YES @ 0.50
   → Matches User A's remaining 5 @ 0.60
   → Trade: 5 YES @ 0.60
   → User C's order: 5 remaining @ 0.50 (rests on ask side)
```
