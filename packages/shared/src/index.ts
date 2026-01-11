import { z } from 'zod';

// Market schemas
export const MarketSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  resolveDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED']),
});

export const CreateMarketSchema = MarketSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

// Order schemas
export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string().uuid(),
  side: z.enum(['BUY', 'SELL']),
  price: z.number().min(0).max(1),
  quantity: z.number().positive(),
  filled: z.number().min(0),
  status: z.enum(['PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateOrderSchema = OrderSchema.omit({
  id: true,
  filled: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Market = z.infer<typeof MarketSchema>;
export type CreateMarket = z.infer<typeof CreateMarketSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
