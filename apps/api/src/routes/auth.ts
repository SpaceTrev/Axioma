import { FastifyPluginAsync } from 'fastify';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@axioma/db';
import { RegisterSchema, LoginSchema } from '@axioma/shared';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    const parseResult = RegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { email, password } = parseResult.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Email already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'USER',
      },
    });

    // Create initial balance
    await prisma.balance.create({
      data: {
        userId: user.id,
        available: 0,
        reserved: 0,
      },
    });

    // Generate token
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    };
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { email, password } = parseResult.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    };
  });

  // Get current user
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
        include: { balance: true },
      });

      if (!user) {
        throw { statusCode: 404, message: 'User not found' };
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          balance: user.balance
            ? {
                available: user.balance.available.toString(),
                reserved: user.balance.reserved.toString(),
              }
            : null,
        },
      };
    }
  );
};
