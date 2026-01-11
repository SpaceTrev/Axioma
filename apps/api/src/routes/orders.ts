import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@axioma/db';
import { CreateOrderSchema } from '@axioma/shared';
import { MatchingEngine, SettlementEngine } from '@axioma/engine';

const matchingEngine = new MatchingEngine();
const settlementEngine = new SettlementEngine();

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // Get orders for a market
  fastify.get('/market/:marketId', async (request, reply) => {
    try {
      const { marketId } = request.params as { marketId: string };
      const orders = await prisma.order.findMany({
        where: { marketId },
        orderBy: { createdAt: 'desc' },
      });
      return orders;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch orders' });
    }
  });

  // Create order
  fastify.post('/', async (request, reply) => {
    try {
      const data = CreateOrderSchema.parse(request.body);

      const order = await prisma.order.create({
        data: {
          userId: data.userId,
          marketId: data.marketId,
          side: data.side,
          price: data.price,
          quantity: data.quantity,
        },
      });

      // Process order through matching engine
      const matches = matchingEngine.addOrder(order);

      // Process settlements
      const settlements = [];
      for (const match of matches) {
        const buyOrder = await prisma.order.findUnique({ where: { id: match.buyOrderId } });
        const sellOrder = await prisma.order.findUnique({ where: { id: match.sellOrderId } });

        if (buyOrder && sellOrder) {
          const settlement = settlementEngine.settle(match, buyOrder.userId, sellOrder.userId);
          settlements.push(settlement);

          // Update order statuses
          await prisma.order.update({
            where: { id: buyOrder.id },
            data: { filled: buyOrder.filled + match.quantity },
          });
          await prisma.order.update({
            where: { id: sellOrder.id },
            data: { filled: sellOrder.filled + match.quantity },
          });
        }
      }

      return reply.status(201).send({
        order,
        matches,
        settlements,
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(400).send({ error: 'Invalid order data' });
    }
  });

  // Get order book
  fastify.get('/book/:marketId', async (request, reply) => {
    try {
      const orderBook = matchingEngine.getOrderBook();
      return orderBook;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch order book' });
    }
  });
};
