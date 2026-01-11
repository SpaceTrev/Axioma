import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from 'dotenv';

import { authRoutes } from './routes/auth';
import { marketRoutes } from './routes/markets';
import { orderRoutes } from './routes/orders';
import { portfolioRoutes } from './routes/portfolio';
import { devRoutes } from './routes/dev';

config();

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'axioma-dev-secret-change-in-production';

const fastify = Fastify({
  logger: true,
});

// Register plugins
fastify.register(cors, {
  origin: true,
  credentials: true,
});

fastify.register(jwt, {
  secret: JWT_SECRET,
});

// Swagger documentation
fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Axioma API',
      description: 'Binary Prediction Market API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

fastify.register(swaggerUi, {
  routePrefix: '/docs',
});

// Authentication decorator
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
});

fastify.decorate('authenticateAdmin', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(marketRoutes, { prefix: '/api/markets' });
fastify.register(orderRoutes, { prefix: '/api/orders' });
fastify.register(portfolioRoutes, { prefix: '/api/portfolio' });

// Dev routes only in development
if (process.env.NODE_ENV !== 'production') {
  fastify.register(devRoutes, { prefix: '/api/dev' });
}

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// TypeScript declarations
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    authenticateAdmin: (request: any, reply: any) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string };
  }
}

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
    console.log(`API Documentation: http://${HOST}:${PORT}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
