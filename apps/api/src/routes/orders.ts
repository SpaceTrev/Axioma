import { FastifyPluginAsync } from 'fastify';
import { prisma, applyLedger, updatePosition, Decimal } from '@axioma/db';
import { calculateOrderRelease } from '@axioma/engine';

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's orders
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = request.user.id;
      const { marketId, status } = request.query as { marketId?: string; status?: string };

      const where: any = { userId };
      if (marketId) where.marketId = marketId;
      if (status) where.status = status;

      const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { market: { select: { question: true } } },
      });

      return {
        success: true,
        data: orders.map((o) => ({
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
      };
    }
  );

  // Get single order
  fastify.get(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          market: { select: { question: true } },
          makerTrades: true,
          takerTrades: true,
        },
      });

      if (!order) {
        return reply.status(404).send({ error: 'Not Found', message: 'Order not found' });
      }

      if (order.userId !== userId && request.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Not your order' });
      }

      return {
        success: true,
        data: {
          id: order.id,
          userId: order.userId,
          marketId: order.marketId,
          marketQuestion: order.market.question,
          outcome: order.outcome,
          side: order.side,
          price: order.price.toString(),
          quantity: order.quantity.toString(),
          remaining: order.remaining.toString(),
          status: order.status,
          createdAt: order.createdAt,
          trades: [
            ...order.makerTrades.map((t) => ({
              id: t.id,
              price: t.price.toString(),
              quantity: t.quantity.toString(),
              role: 'maker' as const,
              createdAt: t.createdAt,
            })),
            ...order.takerTrades.map((t) => ({
              id: t.id,
              price: t.price.toString(),
              quantity: t.quantity.toString(),
              role: 'taker' as const,
              fee: t.takerFee.toString(),
              createdAt: t.createdAt,
            })),
          ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        },
      };
    }
  );

  // Cancel order
  fastify.post(
    '/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      const order = await prisma.order.findUnique({ where: { id } });

      if (!order) {
        return reply.status(404).send({ error: 'Not Found', message: 'Order not found' });
      }

      if (order.userId !== userId && request.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Not your order' });
      }

      if (order.status !== 'OPEN' && order.status !== 'PARTIAL') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Order cannot be cancelled',
        });
      }

      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        if (order.side === 'BUY') {
          // Release reserved funds
          const releaseEntry = calculateOrderRelease(
            order.userId,
            order.id,
            new Decimal(order.price.toString()),
            new Decimal(order.remaining.toString())
          );

          await applyLedger(tx, {
            userId: order.userId,
            deltaAvailable: releaseEntry.deltaAvailable,
            deltaReserved: releaseEntry.deltaReserved,
            reason: 'ORDER_RESERVE_RELEASE',
            refType: 'order',
            refId: order.id,
          });
        } else {
          // Release reserved shares
          await updatePosition(tx, {
            userId: order.userId,
            marketId: order.marketId,
            outcome: order.outcome as 'YES' | 'NO',
            deltaShares: new Decimal(0),
            deltaReservedShares: new Decimal(order.remaining.toString()).neg(),
          });
        }
      });

      // TODO: Remove from in-memory order book
      // This would require access to the orderBooks map from markets.ts
      // In a production system, this would be handled differently (e.g., Redis)

      return {
        success: true,
        data: {
          id: order.id,
          status: 'CANCELLED',
        },
      };
    }
  );
};
