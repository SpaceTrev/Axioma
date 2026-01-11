import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const MarketStatusSchema = z.enum(['OPEN', 'RESOLVED', 'CANCELLED']);
export type MarketStatus = z.infer<typeof MarketStatusSchema>;

export const OutcomeSchema = z.enum(['YES', 'NO']);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderStatusSchema = z.enum(['OPEN', 'PARTIAL', 'FILLED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const LedgerReasonSchema = z.enum([
  'FAUCET_CREDIT',
  'ORDER_RESERVE',
  'ORDER_RESERVE_RELEASE',
  'TRADE_BUY',
  'TRADE_SELL',
  'TRADE_FEE',
  'SETTLEMENT_WIN',
  'SETTLEMENT_LOSS',
  'MARKET_CANCEL_REFUND',
  'ADMIN_ADJUSTMENT',
]);
export type LedgerReason = z.infer<typeof LedgerReasonSchema>;

// ============================================
// User Schemas
// ============================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  createdAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============================================
// Balance Schemas
// ============================================

export const BalanceSchema = z.object({
  available: z.string(), // Decimal as string
  reserved: z.string(),
});

export type Balance = z.infer<typeof BalanceSchema>;

// ============================================
// Market Schemas
// ============================================

export const MarketSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1).max(500),
  description: z.string().max(5000),
  category: z.string().max(100),
  resolvesAt: z.coerce.date(),
  status: MarketStatusSchema,
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type Market = z.infer<typeof MarketSchema>;

export const CreateMarketSchema = z.object({
  question: z.string().min(1).max(500),
  description: z.string().max(5000).default(''),
  category: z.string().max(100).default('general'),
  resolvesAt: z.coerce.date(),
});

export type CreateMarketInput = z.infer<typeof CreateMarketSchema>;

export const ResolveMarketSchema = z.object({
  winningOutcome: OutcomeSchema,
  source: z.string().max(1000).optional(),
});

export type ResolveMarketInput = z.infer<typeof ResolveMarketSchema>;

export const MarketResolutionSchema = z.object({
  marketId: z.string().uuid(),
  winningOutcome: OutcomeSchema,
  resolvedAt: z.coerce.date(),
  resolverUserId: z.string().uuid(),
  source: z.string().max(1000).optional(),
});

export type MarketResolution = z.infer<typeof MarketResolutionSchema>;

// ============================================
// Order Schemas
// ============================================

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string().uuid(),
  outcome: OutcomeSchema,
  side: OrderSideSchema,
  price: z.string(), // Decimal as string
  quantity: z.string(),
  remaining: z.string(),
  status: OrderStatusSchema,
  createdAt: z.coerce.date(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = z.object({
  outcome: OutcomeSchema,
  side: OrderSideSchema,
  price: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v) : v).refine(v => v >= 0.01 && v <= 0.99, 'Price must be between 0.01 and 0.99'),
  quantity: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v) : v).refine(v => v > 0 && v <= 1000000, 'Quantity must be positive and <= 1000000'),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ============================================
// Trade Schemas
// ============================================

export const TradeSchema = z.object({
  id: z.string().uuid(),
  marketId: z.string().uuid(),
  outcome: OutcomeSchema,
  price: z.string(),
  quantity: z.string(),
  makerOrderId: z.string().uuid(),
  takerOrderId: z.string().uuid(),
  makerUserId: z.string().uuid(),
  takerUserId: z.string().uuid(),
  takerFee: z.string(),
  createdAt: z.coerce.date(),
});

export type Trade = z.infer<typeof TradeSchema>;

// ============================================
// Position Schemas
// ============================================

export const PositionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string().uuid(),
  outcome: OutcomeSchema,
  shares: z.string(),
  reservedShares: z.string(),
  avgPrice: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;

// ============================================
// Order Book Schemas
// ============================================

export const OrderBookLevelSchema = z.object({
  price: z.string(),
  quantity: z.string(),
  orderCount: z.number(),
});

export type OrderBookLevel = z.infer<typeof OrderBookLevelSchema>;

export const OrderBookSchema = z.object({
  bids: z.array(OrderBookLevelSchema),
  asks: z.array(OrderBookLevelSchema),
});

export type OrderBook = z.infer<typeof OrderBookSchema>;

export const MarketOrderBookSchema = z.object({
  YES: OrderBookSchema,
  NO: OrderBookSchema,
});

export type MarketOrderBook = z.infer<typeof MarketOrderBookSchema>;

// ============================================
// Portfolio Schemas
// ============================================

export const PortfolioSchema = z.object({
  balance: BalanceSchema,
  positions: z.array(PositionSchema),
  openOrders: z.array(OrderSchema),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;

// ============================================
// Faucet Schemas
// ============================================

export const FaucetSchema = z.object({
  amount: z.number().positive().max(10000),
});

export type FaucetInput = z.infer<typeof FaucetSchema>;

// ============================================
// Market Detail Response
// ============================================

export const MarketDetailSchema = z.object({
  market: MarketSchema,
  resolution: MarketResolutionSchema.nullable(),
  orderBook: MarketOrderBookSchema,
  recentTrades: z.array(TradeSchema),
  lastTradePrice: z.object({
    YES: z.string().nullable(),
    NO: z.string().nullable(),
  }),
});

export type MarketDetail = z.infer<typeof MarketDetailSchema>;

// ============================================
// API Response Wrappers
// ============================================

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export function createApiResponse<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

// ============================================
// Constants
// ============================================

export const SYSTEM_USER_ID = 'system';
export const DEFAULT_TAKER_FEE_RATE = 0.01; // 1%
export const MIN_PRICE = 0.01;
export const MAX_PRICE = 0.99;
export const MAX_QUANTITY = 1000000;

// ============================================
// Wallet Adapter Interface (Stubbed)
// ============================================

export interface IWalletAdapter {
  /**
   * Get the wallet address for a user
   */
  getAddress(userId: string): Promise<string | null>;
  
  /**
   * Deposit USDC from external wallet (stubbed - no-op in MVP)
   */
  deposit(userId: string, amount: string): Promise<{ txHash: string }>;
  
  /**
   * Withdraw USDC to external wallet (stubbed - no-op in MVP)
   */
  withdraw(userId: string, amount: string, toAddress: string): Promise<{ txHash: string }>;
}

/**
 * Stubbed wallet adapter for development
 */
export class StubWalletAdapter implements IWalletAdapter {
  async getAddress(_userId: string): Promise<string | null> {
    return null; // No real wallet in MVP
  }
  
  async deposit(_userId: string, _amount: string): Promise<{ txHash: string }> {
    throw new Error('Wallet deposits not supported in MVP. Use the dev faucet.');
  }
  
  async withdraw(_userId: string, _amount: string, _toAddress: string): Promise<{ txHash: string }> {
    throw new Error('Wallet withdrawals not supported in MVP.');
  }
}
