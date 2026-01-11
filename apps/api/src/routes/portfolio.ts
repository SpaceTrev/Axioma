import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@axioma/db';

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's portfolio
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = request.user.id;

      // Get balance
      const balance = await prisma.balance.findUnique({ where: { userId } });

      // Get positions with market info
      const positions = await prisma.position.findMany({
        where: { userId },
        include: {
          market: {
            select: {
              id: true,
              question: true,
              status: true,
              resolution: true,
            },
          },
        },
      });

      // Get open orders
      const openOrders = await prisma.order.findMany({
        where: {
          userId,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        include: {
          market: { select: { question: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate unrealized PnL for each position
      const positionsWithPnL = positions.map((p) => {
        const shares = parseFloat(p.shares.toString());
        const avgPrice = parseFloat(p.avgPrice.toString());
        const costBasis = shares * avgPrice;

        // Use 0.5 as default midpoint if no market data
        // In a real implementation, we'd get the actual midpoint from order book
        const currentPrice = p.market.status === 'RESOLVED'
          ? (p.market.resolution?.winningOutcome === p.outcome ? 1 : 0)
          : 0.5;

        const currentValue = shares * currentPrice;
        const unrealizedPnL = currentValue - costBasis;

        return {
          id: p.id,
          userId: p.userId,
          marketId: p.marketId,
          marketQuestion: p.market.question,
          marketStatus: p.market.status,
          outcome: p.outcome,
          shares: p.shares.toString(),
          reservedShares: p.reservedShares.toString(),
          avgPrice: p.avgPrice.toString(),
          costBasis: costBasis.toFixed(8),
          currentValue: currentValue.toFixed(8),
          unrealizedPnL: unrealizedPnL.toFixed(8),
        };
      });

      return {
        success: true,
        data: {
          balance: {
            available: balance?.available.toString() ?? '0',
            reserved: balance?.reserved.toString() ?? '0',
            total: balance
              ? (parseFloat(balance.available.toString()) + parseFloat(balance.reserved.toString())).toFixed(8)
              : '0',
          },
          positions: positionsWithPnL.filter((p) => parseFloat(p.shares) > 0),
          openOrders: openOrders.map((o) => ({
            id: o.id,
            userId: o.userId,
            marketId: o.marketId,
            marketQuestion: o.market.question,
            outcome: o.outcome,
            side: o.side,
            price: o.price.toString(),
            quantity: o.quantity.toString(),
            remaining: o.remaining.toString(),
            status: o.status,
            createdAt: o.createdAt,
          })),
          summary: {
            totalPositionValue: positionsWithPnL
              .filter((p) => parseFloat(p.shares) > 0)
              .reduce((sum, p) => sum + parseFloat(p.currentValue), 0)
              .toFixed(8),
            totalUnrealizedPnL: positionsWithPnL
              .filter((p) => parseFloat(p.shares) > 0)
              .reduce((sum, p) => sum + parseFloat(p.unrealizedPnL), 0)
              .toFixed(8),
            openOrderCount: openOrders.length,
          },
        },
      };
    }
  );

  // Get user's trade history
  fastify.get(
    '/trades',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = request.user.id;
      const { limit = '50' } = request.query as { limit?: string };

      const trades = await prisma.trade.findMany({
        where: {
          OR: [{ makerUserId: userId }, { takerUserId: userId }],
        },
        include: {
          market: { select: { question: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });

      return {
        success: true,
        data: trades.map((t) => ({
          id: t.id,
          marketId: t.marketId,
          marketQuestion: t.market.question,
          outcome: t.outcome,
          price: t.price.toString(),
          quantity: t.quantity.toString(),
          role: t.makerUserId === userId ? 'maker' : 'taker',
          fee: t.takerUserId === userId ? t.takerFee.toString() : '0',
          createdAt: t.createdAt,
        })),
      };
    }
  );

  // Get user's ledger history
  fastify.get(
    '/ledger',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = request.user.id;
      const { limit = '50' } = request.query as { limit?: string };

      const entries = await prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });

      return {
        success: true,
        data: entries.map((e) => ({
          id: e.id,
          deltaAvailable: e.deltaAvailable.toString(),
          deltaReserved: e.deltaReserved.toString(),
          reason: e.reason,
          refType: e.refType,
          refId: e.refId,
          createdAt: e.createdAt,
        })),
      };
    }
  );
};
