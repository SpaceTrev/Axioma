'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePortfolio, useOrders, invalidatePortfolio, invalidateOrders } from '@/lib/hooks';
import { useAuthStore, getApiClient } from '@/lib/store';
import { Card, CardHeader, CardContent, Badge, Button, Input, Price, Spinner } from '@/components/ui';

export default function PortfolioPage() {
  const { token, user } = useAuthStore();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: orders, isLoading: ordersLoading } = useOrders();
  const [faucetAmount, setFaucetAmount] = useState('1000');
  const [isLoadingFaucet, setIsLoadingFaucet] = useState(false);

  if (!token) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">Sign in to view your portfolio</h2>
          <Link href="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleFaucet = async () => {
    setIsLoadingFaucet(true);
    try {
      const client = getApiClient();
      await client.faucet(parseFloat(faucetAmount));
      invalidatePortfolio();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFaucet(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const client = getApiClient();
      await client.cancelOrder(orderId);
      invalidateOrders();
      invalidatePortfolio();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Portfolio</h1>

      {portfolioLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : portfolio ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance Card */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-lg">Account Balance</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Available</p>
                    <p className="text-2xl font-bold text-green-600">
                      <Price value={portfolio.balance?.available || '0'} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Reserved</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      <Price value={portfolio.balance?.reserved || '0'} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      <Price
                        value={
                          parseFloat(portfolio.balance?.available || '0') +
                          parseFloat(portfolio.balance?.reserved || '0')
                        }
                      />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Positions */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-lg">Positions</h2>
              </CardHeader>
              <CardContent className="p-0">
                {portfolio.positions?.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No positions yet. Place your first trade!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {portfolio.positions?.map((position: any) => (
                      <div key={position.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <Link
                            href={`/market/${position.marketId}`}
                            className="text-indigo-600 hover:text-indigo-500 font-medium"
                          >
                            {position.market?.question || 'Unknown Market'}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={position.outcome === 'YES' ? 'success' : 'danger'}>
                              {position.outcome}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {parseFloat(position.shares).toFixed(2)} shares @ avg{' '}
                              {parseFloat(position.avgPrice).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            <Price
                              value={(
                                parseFloat(position.shares) * parseFloat(position.avgPrice)
                              ).toFixed(2)}
                            />
                          </p>
                          <p className="text-xs text-gray-500">Cost Basis</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open Orders */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-lg">Open Orders</h2>
              </CardHeader>
              <CardContent className="p-0">
                {ordersLoading ? (
                  <div className="p-6 flex justify-center">
                    <Spinner />
                  </div>
                ) : orders?.filter((o: any) => o.status === 'OPEN').length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No open orders</div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders
                      ?.filter((o: any) => o.status === 'OPEN')
                      .map((order: any) => (
                        <div key={order.id} className="p-4 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {order.marketQuestion}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={order.side === 'BUY' ? 'info' : 'warning'}>
                                {order.side}
                              </Badge>
                              <Badge variant={order.outcome === 'YES' ? 'success' : 'danger'}>
                                {order.outcome}
                              </Badge>
                              <span className="text-sm">
                                {parseFloat(order.remainingQuantity).toFixed(0)} @{' '}
                                {parseFloat(order.price).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancelOrder(order.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Faucet */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-lg">Dev Faucet</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Get test USDC for development. This is not real money.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={faucetAmount}
                    onChange={(e) => setFaucetAmount(e.target.value)}
                    min="1"
                    max="10000"
                  />
                  <Button onClick={handleFaucet} isLoading={isLoadingFaucet}>
                    Get USDC
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            {portfolio.summary && (
              <Card>
                <CardHeader>
                  <h2 className="font-semibold text-lg">Summary</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Position Value</span>
                    <Price value={portfolio.summary.positionValue} className="font-medium" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unrealized P&L</span>
                    <span
                      className={`font-medium ${
                        parseFloat(portfolio.summary.unrealizedPnL) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      <Price value={portfolio.summary.unrealizedPnL} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Open Orders</span>
                    <span className="font-medium">{portfolio.summary.openOrdersCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reserved</span>
                    <Price value={portfolio.summary.reservedInOrders} className="font-medium" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Info */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-lg">Account</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Role</span>
                  <Badge variant={user?.role === 'ADMIN' ? 'info' : 'default'}>
                    {user?.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">Failed to load portfolio</div>
      )}
    </div>
  );
}
