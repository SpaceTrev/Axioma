'use client';

import { useState } from 'react';
import { useMarkets } from '@/lib/hooks';
import { MarketList } from '@/components/market-card';
import { Input, Button } from '@/components/ui';

export default function HomePage() {
  const { data: markets, isLoading, error } = useMarkets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  const filteredMarkets = markets?.filter((market) => {
    const matchesSearch =
      !search ||
      market.question.toLowerCase().includes(search.toLowerCase()) ||
      market.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || market.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Prediction Markets
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Trade on the outcome of future events. Put your predictions to the test.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <Input
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'OPEN' ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter('OPEN')}
          >
            Open
          </Button>
          <Button
            variant={statusFilter === 'RESOLVED' ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter('RESOLVED')}
          >
            Resolved
          </Button>
          <Button
            variant={statusFilter === '' ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter('')}
          >
            All
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-4 mb-8">
          Failed to load markets. Make sure the API is running.
        </div>
      )}

      {/* Market List */}
      <MarketList markets={filteredMarkets || []} isLoading={isLoading} />
    </div>
  );
}
