'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMarkets, useStats, invalidateMarkets, invalidateAll } from '@/lib/hooks';
import { useAuthStore, getApiClient } from '@/lib/store';
import { Card, CardHeader, CardContent, Button, Input, Badge, Modal, Spinner } from '@/components/ui';

export default function AdminPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const { data: stats, isLoading: statsLoading } = useStats();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    question: '',
    description: '',
    category: '',
    resolvesAt: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [resolveModal, setResolveModal] = useState<{ id: string; question: string } | null>(null);
  const [resolveOutcome, setResolveOutcome] = useState<'YES' | 'NO'>('YES');
  const [resolveSource, setResolveSource] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Auth check
  if (!token || user?.role !== 'ADMIN') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">Admin access required</h2>
          <p className="text-gray-500 mb-4">You need to be signed in as an admin to access this page.</p>
          <Link href="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const client = getApiClient();
      const market = await client.createMarket({
        question: createForm.question,
        description: createForm.description,
        category: createForm.category,
        resolvesAt: new Date(createForm.resolvesAt),
      });

      setIsCreateOpen(false);
      setCreateForm({ question: '', description: '', category: '', resolvesAt: '' });
      invalidateMarkets();
      router.push(`/market/${market.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create market');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setIsResolving(true);

    try {
      const client = getApiClient();
      await client.resolveMarket(resolveModal.id, {
        winningOutcome: resolveOutcome,
        source: resolveSource || undefined,
      });

      setResolveModal(null);
      invalidateAll();
    } catch (err) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCancelMarket = async (marketId: string) => {
    try {
      const client = getApiClient();
      await client.cancelMarket(marketId);
      invalidateAll();
    } catch (err) {
      console.error(err);
    }
  };

  const openMarkets = markets?.filter((m) => m.status === 'OPEN') || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <Button onClick={() => setIsCreateOpen(true)}>Create Market</Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="text-center py-6">
              <p className="text-3xl font-bold text-indigo-600">{stats.users}</p>
              <p className="text-sm text-gray-500">Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center py-6">
              <p className="text-3xl font-bold text-green-600">{stats.markets.open}</p>
              <p className="text-sm text-gray-500">Open Markets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center py-6">
              <p className="text-3xl font-bold text-blue-600">{stats.orders.open}</p>
              <p className="text-sm text-gray-500">Open Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center py-6">
              <p className="text-3xl font-bold text-purple-600">{stats.trades}</p>
              <p className="text-sm text-gray-500">Total Trades</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Open Markets */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-lg">Open Markets ({openMarkets.length})</h2>
        </CardHeader>
        <CardContent className="p-0">
          {marketsLoading ? (
            <div className="p-6 flex justify-center">
              <Spinner />
            </div>
          ) : openMarkets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No open markets</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {openMarkets.map((market) => (
                <div key={market.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <Link
                      href={`/market/${market.id}`}
                      className="text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      {market.question}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      {market.category && <Badge>{market.category}</Badge>}
                      <span>{market.tradeCount} trades</span>
                      <span>•</span>
                      <span>Resolves {new Date(market.resolvesAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() =>
                        setResolveModal({ id: market.id, question: market.question })
                      }
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancelMarket(market.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Market Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Market">
        <form onSubmit={handleCreateMarket} className="space-y-4">
          <Input
            label="Question"
            value={createForm.question}
            onChange={(e) => setCreateForm({ ...createForm, question: e.target.value })}
            placeholder="Will X happen by Y date?"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Additional context about the market..."
            />
          </div>

          <Input
            label="Category"
            value={createForm.category}
            onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
            placeholder="Crypto, Sports, Politics, etc."
          />

          <Input
            label="Resolution Date"
            type="datetime-local"
            value={createForm.resolvesAt}
            onChange={(e) => setCreateForm({ ...createForm, resolvesAt: e.target.value })}
            required
          />

          {createError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-3 text-sm">
              {createError}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isCreating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={!!resolveModal}
        onClose={() => setResolveModal(null)}
        title="Resolve Market"
      >
        {resolveModal && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{resolveModal.question}</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Winning Outcome
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolveOutcome('YES')}
                  className={`py-3 rounded-lg font-medium ${
                    resolveOutcome === 'YES'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setResolveOutcome('NO')}
                  className={`py-3 rounded-lg font-medium ${
                    resolveOutcome === 'NO'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            <Input
              label="Resolution Source (optional)"
              value={resolveSource}
              onChange={(e) => setResolveSource(e.target.value)}
              placeholder="Link to source confirming outcome"
            />

            <div className="flex gap-2 pt-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setResolveModal(null)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleResolve} isLoading={isResolving}>
                Resolve as {resolveOutcome}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
