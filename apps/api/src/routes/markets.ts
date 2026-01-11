import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@axioma/db';
import { CreateMarketSchema } from '@axioma/shared';

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all markets
  fastify.get('/', async (request, reply) => {
    try {
      const markets = await prisma.market.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return markets;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch markets' });
    }
  });

  // Get single market
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const market = await prisma.market.findUnique({
        where: { id },
        include: { orders: true },
      });

      if (!market) {
        return reply.status(404).send({ error: 'Market not found' });
      }

      return market;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch market' });
    }
  });

  // Create market
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as any;
      const data = CreateMarketSchema.parse({
        ...body,
        resolveDate: new Date(body.resolveDate),
      });

      const market = await prisma.market.create({
        data: {
          title: data.title,
          description: data.description,
          resolveDate: data.resolveDate,
        },
      });

      return reply.status(201).send(market);
    } catch (error) {
      fastify.log.error(error);
      reply.status(400).send({ error: 'Invalid market data' });
    }
  });
};
