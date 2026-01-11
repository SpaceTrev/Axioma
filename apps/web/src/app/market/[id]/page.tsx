'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMarket, useOrderBook, useMarketTrades } from '@/lib/hooks';
import { Card, CardHeader, CardContent, Badge, ProbabilityBar, Spinner } from '@/components/ui';
import { OrderBookPanel, OrderForm, TradeTape } from '@/components/order-book';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MarketPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: marketDetail, isLoading: marketLoading, error: marketError } = useMarket(id);
  const { data: orderBook, isLoading: obLoading } = useOrderBook(id);
  const { data: trades, isLoading: tradesLoading } = useMarketTrades(id);

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (marketError || !marketDetail) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-4">
          Market not found or failed to load.
        </div>
        <Link href="/" className="text-indigo-600 mt-4 inline-block">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const { market, resolution, recentTrades, lastTradePrice } = marketDetail;
  const yesPrice = lastTradePrice.YES ? parseFloat(lastTradePrice.YES) : 0.5;
  
  const statusVariant =
    market.status === 'OPEN' ? 'success' : market.status === 'RESOLVED' ? 'info' : 'danger';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/" className="text-indigo-600 hover:text-indigo-500 text-sm">
          ← Back to Markets
        </Link>
      </div>

      {/* Market Header */}
      <Card className="mb-8">
        <CardContent>
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <Badge variant={statusVariant}>{market.status}</Badge>
            {market.category && <Badge>{market.category}</Badge>}
            <span className="text-sm text-gray-500">
              Resolves: {new Date(market.resolvesAt).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {market.question}
          </h1>

          {market.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-6">{market.description}</p>
          )}

          <ProbabilityBar yesPrice={yesPrice} />

          {resolution && (
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                Resolved: {resolution.winningOutcome}
              </h3>
              {resolution.source && (
                <p className="text-sm text-indigo-700 dark:text-indigo-400">
                  Source: {resolution.source}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Books */}
        <div className="lg:col-span-2 space-y-6">
          {obLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : orderBook ? (
            <>
              <OrderBookPanel
                outcome="YES"
                bids={orderBook.YES.bids}
                asks={orderBook.YES.asks}
                bestBid={orderBook.YES.bestBid}
                bestAsk={orderBook.YES.bestAsk}
                midpoint={orderBook.YES.midpoint}
              />
              <OrderBookPanel
                outcome="NO"
                bids={orderBook.NO.bids}
                asks={orderBook.NO.asks}
                bestBid={orderBook.NO.bestBid}
                bestAsk={orderBook.NO.bestAsk}
                midpoint={orderBook.NO.midpoint}
              />
            </>
          ) : null}

          {/* Trade Tape */}
          <TradeTape trades={trades || []} isLoading={tradesLoading} />
        </div>

        {/* Order Form */}
        <div>
          <OrderForm marketId={id} marketStatus={market.status} />

          {/* Market Stats */}
          <Card className="mt-6">
            <CardHeader>
              <h3 className="font-semibold">Market Stats</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Trades</span>
                <span className="font-medium">{recentTrades.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span className="font-medium">{new Date(market.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
