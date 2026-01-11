'use client';

import useSWR, { SWRConfiguration, mutate } from 'swr';
import { getApiClient } from './store';
import type { Market, MarketDetail, Trade, Portfolio } from '@axioma/shared';

// ============================================
// Types
// ============================================

type MarketWithTrades = Market & { tradeCount: number };
type OrderWithMarket = { id: string; marketId: string; marketQuestion: string; side: string; outcome: string; price: string; quantity: string; remaining: string; status: string; createdAt: string | Date };
type OrderBook = {
  YES: { bids: Array<{ price: string; quantity: string; orderCount: number }>; asks: Array<{ price: string; quantity: string; orderCount: number }>; bestBid: string | null; bestAsk: string | null; midpoint: string | null };
  NO: { bids: Array<{ price: string; quantity: string; orderCount: number }>; asks: Array<{ price: string; quantity: string; orderCount: number }>; bestBid: string | null; bestAsk: string | null; midpoint: string | null };
};
type Stats = { users: number; markets: { total: number; open: number }; orders: { total: number; open: number }; trades: number };
type PortfolioWithSummary = Portfolio & { summary: { positionValue: string; unrealizedPnL: string; openOrdersCount: number; reservedInOrders: string } };
type TradeWithRole = Trade & { role: string };

// ============================================
// Fetchers
// ============================================

async function fetchMarkets(): Promise<MarketWithTrades[]> {
  return getApiClient().getMarkets();
}

async function fetchMarket(id: string): Promise<MarketDetail> {
  return getApiClient().getMarket(id);
}

async function fetchOrderBook(marketId: string): Promise<OrderBook> {
  return getApiClient().getOrderBook(marketId);
}

async function fetchMarketTrades(marketId: string): Promise<Trade[]> {
  return getApiClient().getTrades(marketId);
}

async function fetchPortfolio(): Promise<PortfolioWithSummary> {
  return getApiClient().getPortfolio();
}

async function fetchOrders(): Promise<OrderWithMarket[]> {
  return getApiClient().getOrders();
}

async function fetchTradeHistory(): Promise<TradeWithRole[]> {
  return getApiClient().getTradeHistory();
}

async function fetchStats(): Promise<Stats> {
  return getApiClient().getStats();
}

// ============================================
// Market Hooks
// ============================================

export function useMarkets(config?: SWRConfiguration<MarketWithTrades[]>) {
  return useSWR<MarketWithTrades[]>('/markets', fetchMarkets, {
    revalidateOnFocus: true,
    refreshInterval: 30000,
    ...config,
  });
}

export function useMarket(id: string, config?: SWRConfiguration<MarketDetail>) {
  return useSWR<MarketDetail>(id ? `/markets/${id}` : null, () => fetchMarket(id), {
    revalidateOnFocus: true,
    ...config,
  });
}

export function useOrderBook(marketId: string, config?: SWRConfiguration<OrderBook>) {
  return useSWR<OrderBook>(marketId ? `/markets/${marketId}/orderbook` : null, () => fetchOrderBook(marketId), {
    refreshInterval: 2000,
    ...config,
  });
}

export function useMarketTrades(marketId: string, config?: SWRConfiguration<Trade[]>) {
  return useSWR<Trade[]>(marketId ? `/markets/${marketId}/trades` : null, () => fetchMarketTrades(marketId), {
    refreshInterval: 5000,
    ...config,
  });
}

// ============================================
// Portfolio Hooks
// ============================================

export function usePortfolio(config?: SWRConfiguration<PortfolioWithSummary>) {
  return useSWR<PortfolioWithSummary>('/portfolio', fetchPortfolio, {
    revalidateOnFocus: true,
    ...config,
  });
}

export function useTradeHistory(config?: SWRConfiguration<TradeWithRole[]>) {
  return useSWR<TradeWithRole[]>('/portfolio/trades', fetchTradeHistory, {
    revalidateOnFocus: true,
    ...config,
  });
}

// ============================================
// Order Hooks
// ============================================

export function useOrders(config?: SWRConfiguration<OrderWithMarket[]>) {
  return useSWR<OrderWithMarket[]>('/orders', fetchOrders, {
    revalidateOnFocus: true,
    ...config,
  });
}

// ============================================
// Dev Hooks
// ============================================

export function useStats(config?: SWRConfiguration<Stats>) {
  return useSWR<Stats>('/dev/stats', fetchStats, {
    refreshInterval: 10000,
    ...config,
  });
}

// ============================================
// Mutation Helpers
// ============================================

export function invalidateMarkets() {
  mutate('/markets');
}

export function invalidateMarket(id: string) {
  mutate(`/markets/${id}`);
  mutate(`/markets/${id}/orderbook`);
  mutate(`/markets/${id}/trades`);
}

export function invalidatePortfolio() {
  mutate('/portfolio');
  mutate('/portfolio/trades');
}

export function invalidateOrders() {
  mutate('/orders');
}

export function invalidateAll() {
  invalidateMarkets();
  invalidatePortfolio();
  invalidateOrders();
}
