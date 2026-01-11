// Matching engine
export {
  MatchingEngine,
  createMarketOrderBooks,
  type EngineOrder,
  type MatchResult,
  type OrderBookLevel,
  type OrderBookSnapshot,
  type MarketOrderBooks,
  type OrderSide,
  type OrderStatus,
} from './matching';

// Settlement
export {
  calculateSettlement,
  calculateCancellation,
  calculateTradeSettlement,
  calculateBuyReserve,
  calculateOrderRelease,
  type PositionForSettlement,
  type OrderForCancellation,
  type SettlementResult,
  type CancellationResult,
  type TradeSettlementInput,
  type TradeSettlementResult,
  type ReserveForBuyResult,
} from './settlement';

// Re-export ledger types for convenience
export { Decimal, type Outcome, type LedgerEntryInput } from '@axioma/ledger';
