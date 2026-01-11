'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, ProbabilityBar } from './ui';

interface MarketCardProps {
  market: {
    id: string;
    question: string;
    description?: string;
    category?: string | null;
    status: string;
    resolvesAt: string | Date;
    tradeCount?: number;
    yesPrice?: number | null;
    noPrice?: number | null;
  };
}

export function MarketCard({ market }: MarketCardProps) {
  const yesPrice = market.yesPrice ?? 0.5;
  const statusVariant =
    market.status === 'OPEN' ? 'success' : market.status === 'RESOLVED' ? 'info' : 'danger';

  const timeLeft = new Date(market.resolvesAt).getTime() - Date.now();
  const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

  return (
    <Link href={`/market/${market.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent>
          <div className="flex items-start justify-between mb-3">
            <Badge variant={statusVariant}>{market.status}</Badge>
            {market.category && (
              <Badge variant="default">{market.category}</Badge>
            )}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {market.question}
          </h3>

          {market.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
              {market.description}
            </p>
          )}

          <ProbabilityBar yesPrice={yesPrice} className="mb-4" />

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{market.tradeCount ?? 0} trades</span>
            <span>
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                : 'Expired'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ============================================
// Market List
// ============================================

interface MarketListProps {
  markets: Array<{
    id: string;
    question: string;
    description?: string;
    category?: string | null;
    status: string;
    resolvesAt: string | Date;
    tradeCount?: number;
    yesPrice?: number | null;
  }>;
  isLoading?: boolean;
}

export function MarketList({ markets, isLoading }: MarketListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-4" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No markets found</h3>
        <p className="text-gray-500">Check back later or create a new market.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
