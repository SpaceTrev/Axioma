import { FastifyPluginAsync } from 'fastify';
import { prisma, applyLedger, Decimal } from '@axioma/db';
import { FaucetSchema } from '@axioma/shared';

export const devRoutes: FastifyPluginAsync = async (fastify) => {
  // Dev faucet - credit USDC to user
  fastify.post(
    '/faucet',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Faucet not available in production',
        });
      }

      const parseResult = FaucetSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { amount } = parseResult.data;
      const userId = request.user.id;

      await prisma.$transaction(async (tx) => {
        await applyLedger(tx, {
          userId,
          deltaAvailable: new Decimal(amount),
          deltaReserved: new Decimal(0),
          reason: 'FAUCET_CREDIT',
          refType: 'faucet',
          refId: `faucet-${Date.now()}`,
        });
      });

      const balance = await prisma.balance.findUnique({ where: { userId } });

      return {
        success: true,
        data: {
          credited: amount.toString(),
          balance: {
            available: balance?.available.toString() ?? '0',
            reserved: balance?.reserved.toString() ?? '0',
          },
        },
      };
    }
  );

  // Reset user's balance and positions (for testing)
  fastify.post(
    '/reset',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      if (process.env.NODE_ENV === 'production') {
        throw { statusCode: 403, message: 'Reset not available in production' };
      }

      const userId = request.user.id;

      await prisma.$transaction(async (tx) => {
        // Cancel all open orders
        await tx.order.updateMany({
          where: { userId, status: { in: ['OPEN', 'PARTIAL'] } },
          data: { status: 'CANCELLED' },
        });

        // Clear positions
        await tx.position.deleteMany({ where: { userId } });

        // Reset balance
        await tx.balance.upsert({
          where: { userId },
          create: { userId, available: 0, reserved: 0 },
          update: { available: 0, reserved: 0 },
        });

        // Add reset ledger entry
        await tx.ledgerEntry.create({
          data: {
            userId,
            deltaAvailable: 0,
            deltaReserved: 0,
            reason: 'ADMIN_ADJUSTMENT',
            refType: 'dev-reset',
            refId: `reset-${Date.now()}`,
          },
        });
      });

      return {
        success: true,
        data: {
          message: 'Account reset successfully',
        },
      };
    }
  );

  // Get system stats (for debugging)
  fastify.get('/stats', async () => {
    const [userCount, marketCount, orderCount, tradeCount] = await Promise.all([
      prisma.user.count(),
      prisma.market.count(),
      prisma.order.count(),
      prisma.trade.count(),
    ]);

    const openMarkets = await prisma.market.count({ where: { status: 'OPEN' } });
    const openOrders = await prisma.order.count({
      where: { status: { in: ['OPEN', 'PARTIAL'] } },
    });

    return {
      success: true,
      data: {
        users: userCount,
        markets: {
          total: marketCount,
          open: openMarkets,
        },
        orders: {
          total: orderCount,
          open: openOrders,
        },
        trades: tradeCount,
      },
    };
  });
};
