import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { marketRoutes } from './routes/markets';
import { orderRoutes } from './routes/orders';

config();

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || 'localhost';

const fastify = Fastify({
  logger: true,
});

// Register plugins
fastify.register(cors, {
  origin: true,
});

// Register routes
fastify.register(marketRoutes, { prefix: '/api/markets' });
fastify.register(orderRoutes, { prefix: '/api/orders' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
