'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Badge, Price } from './ui';
import { getApiClient, useAuthStore } from '@/lib/store';
import { invalidateMarket, invalidatePortfolio, invalidateOrders } from '@/lib/hooks';

// ============================================
// Order Book Display
// ============================================

interface OrderBookLevel {
  price: string;
  quantity: string;
  orderCount: number;
}

interface OrderBookProps {
  outcome: 'YES' | 'NO';
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: string | null;
  bestAsk: string | null;
  midpoint: string | null;
}

export function OrderBookPanel({ outcome, bids, asks, bestBid, bestAsk, midpoint }: OrderBookProps) {
  const isYes = outcome === 'YES';
  const color = isYes ? 'green' : 'red';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-${color}-600`}>{outcome} Order Book</h3>
          {midpoint && (
            <span className="text-sm text-gray-500">
              Mid: <span className="font-medium">{parseFloat(midpoint).toFixed(2)}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
          {/* Bids */}
          <div>
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 text-xs font-medium text-gray-500 uppercase">
              Bids (Buy)
            </div>
            <div className="max-h-48 overflow-y-auto">
              {bids.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No bids</div>
              ) : (
                bids.map((level, i) => (
                  <div
                    key={i}
                    className={`px-4 py-2 flex justify-between text-sm ${
                      bestBid === level.price ? 'bg-green-50 dark:bg-green-900/20' : ''
                    }`}
                  >
                    <span className="text-green-600 font-medium">{parseFloat(level.price).toFixed(2)}</span>
                    <span className="text-gray-600 dark:text-gray-400">{parseFloat(level.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Asks */}
          <div>
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 text-xs font-medium text-gray-500 uppercase">
              Asks (Sell)
            </div>
            <div className="max-h-48 overflow-y-auto">
              {asks.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No asks</div>
              ) : (
                asks.map((level, i) => (
                  <div
                    key={i}
                    className={`px-4 py-2 flex justify-between text-sm ${
                      bestAsk === level.price ? 'bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                  >
                    <span className="text-red-600 font-medium">{parseFloat(level.price).toFixed(2)}</span>
                    <span className="text-gray-600 dark:text-gray-400">{parseFloat(level.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Order Form
// ============================================

interface OrderFormProps {
  marketId: string;
  marketStatus: string;
}

export function OrderForm({ marketId, marketStatus }: OrderFormProps) {
  const { token } = useAuthStore();
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('0.50');
  const [quantity, setQuantity] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Please sign in to place orders');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const client = getApiClient();
      const result = await client.placeOrder(marketId, {
        outcome,
        side,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      });

      setSuccess(`Order placed! ${result.matchCount} matches`);
      invalidateMarket(marketId);
      invalidatePortfolio();
      invalidateOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setIsLoading(false);
    }
  };

  if (marketStatus !== 'OPEN') {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Place Order</h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Market is {marketStatus.toLowerCase()}. Orders are disabled.</p>
        </CardContent>
      </Card>
    );
  }

  const estimatedCost =
    side === 'BUY'
      ? (parseFloat(price) * parseFloat(quantity)).toFixed(2)
      : ((1 - parseFloat(price)) * parseFloat(quantity)).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Place Order</h3>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Outcome
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOutcome('YES')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  outcome === 'YES'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setOutcome('NO')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  outcome === 'NO'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                NO
              </button>
            </div>
          </div>

          {/* Side */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Side
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  side === 'BUY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  side === 'SELL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Price */}
          <Input
            label="Price (0.01 - 0.99)"
            type="number"
            step="0.01"
            min="0.01"
            max="0.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          {/* Quantity */}
          <Input
            label="Quantity (shares)"
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          {/* Cost Estimate */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Est. Cost</span>
              <Price value={estimatedCost} className="font-medium" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg p-3 text-sm">
              {success}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {side === 'BUY' ? 'Buy' : 'Sell'} {outcome} Shares
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================
// Trade Tape
// ============================================

interface Trade {
  id: string;
  outcome: string;
  price: string;
  quantity: string;
  createdAt: string | Date;
}

interface TradeTapeProps {
  trades: Trade[];
  isLoading?: boolean;
}

export function TradeTape({ trades, isLoading }: TradeTapeProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Recent Trades</h3>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">No trades yet</div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 last:border-b-0"
              >
                <div className="flex items-center space-x-2">
                  <Badge variant={trade.outcome === 'YES' ? 'success' : 'danger'}>
                    {trade.outcome}
                  </Badge>
                  <span className="text-sm font-medium">
                    {parseFloat(trade.quantity).toFixed(0)} @ {parseFloat(trade.price).toFixed(2)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(trade.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
