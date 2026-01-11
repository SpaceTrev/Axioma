import { FastifyPluginAsync } from 'fastify';
import { prisma, applyLedger, updatePosition, Decimal } from '@axioma/db';
import {
  CreateMarketSchema,
  ResolveMarketSchema,
  CreateOrderSchema,
  SYSTEM_USER_ID,
} from '@axioma/shared';
import {
  MatchingEngine,
  calculateBuyReserve,
  calculateTradeSettlement,
  calculateSettlement,
  calculateCancellation,
  calculateOrderRelease,
} from '@axioma/engine';
import { DEFAULT_FEE_CONFIG } from '@axioma/ledger';

// In-memory order books per market (in production, use Redis or similar)
const orderBooks = new Map<string, { YES: MatchingEngine; NO: MatchingEngine }>();

function getOrCreateOrderBooks(marketId: string) {
  if (!orderBooks.has(marketId)) {
    orderBooks.set(marketId, {
      YES: new MatchingEngine(DEFAULT_FEE_CONFIG),
      NO: new MatchingEngine(DEFAULT_FEE_CONFIG),
    });
  }
  return orderBooks.get(marketId)!;
}

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all markets
  fastify.get('/', async (request) => {
    const { status, category, search } = request.query as {
      status?: string;
      category?: string;
      search?: string;
    };

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
        _count: { select: { trades: true } },
      },
    });

    return {
      success: true,
      data: markets.map((m) => ({
        id: m.id,
        question: m.question,
        description: m.description,
        category: m.category,
        resolvesAt: m.resolvesAt,
        status: m.status,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
        tradeCount: m._count.trades,
        resolution: m.resolution,
      })),
    };
  });

  // Get single market with order book and trades
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const market = await prisma.market.findUnique({
      where: { id },
      include: { resolution: true },
    });

    if (!market) {
      return reply.status(404).send({ error: 'Not Found', message: 'Market not found' });
    }

    // Get recent trades
    const recentTrades = await prisma.trade.findMany({
      where: { marketId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get order book from memory
    const books = getOrCreateOrderBooks(id);
    const yesBook = books.YES.getOrderBook();
    const noBook = books.NO.getOrderBook();

    // Get last trade prices
    const lastYesTrade = recentTrades.find((t) => t.outcome === 'YES');
    const lastNoTrade = recentTrades.find((t) => t.outcome === 'NO');

    return {
      success: true,
      data: {
        market: {
          id: market.id,
          question: market.question,
          description: market.description,
          category: market.category,
          resolvesAt: market.resolvesAt,
          status: market.status,
          createdBy: market.createdBy,
          createdAt: market.createdAt,
        },
        resolution: market.resolution
          ? {
              marketId: market.resolution.marketId,
              winningOutcome: market.resolution.winningOutcome,
              resolvedAt: market.resolution.resolvedAt,
              resolverUserId: market.resolution.resolverUserId,
            }
          : null,
        orderBook: {
          YES: {
            bids: yesBook.bids.map((l) => ({
              price: l.price.toString(),
              quantity: l.quantity.toString(),
              orderCount: l.orderCount,
            })),
            asks: yesBook.asks.map((l) => ({
              price: l.price.toString(),
              quantity: l.quantity.toString(),
              orderCount: l.orderCount,
            })),
          },
          NO: {
            bids: noBook.bids.map((l) => ({
              price: l.price.toString(),
              quantity: l.quantity.toString(),
              orderCount: l.orderCount,
            })),
            asks: noBook.asks.map((l) => ({
              price: l.price.toString(),
              quantity: l.quantity.toString(),
              orderCount: l.orderCount,
            })),
          },
        },
        recentTrades: recentTrades.map((t) => ({
          id: t.id,
          marketId: t.marketId,
          outcome: t.outcome,
          price: t.price.toString(),
          quantity: t.quantity.toString(),
          makerOrderId: t.makerOrderId,
          takerOrderId: t.takerOrderId,
          makerUserId: t.makerUserId,
          takerUserId: t.takerUserId,
          takerFee: t.takerFee.toString(),
          createdAt: t.createdAt,
        })),
        lastTradePrice: {
          YES: lastYesTrade?.price.toString() ?? null,
          NO: lastNoTrade?.price.toString() ?? null,
        },
      },
    };
  });

  // Create market (authenticated)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parseResult = CreateMarketSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { question, description, category, resolvesAt } = parseResult.data;

      const market = await prisma.market.create({
        data: {
          question,
          description,
          category,
          resolvesAt,
          createdBy: request.user.id,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: market.id,
          question: market.question,
          description: market.description,
          category: market.category,
          resolvesAt: market.resolvesAt,
          status: market.status,
          createdBy: market.createdBy,
          createdAt: market.createdAt,
        },
      });
    }
  );

  // Place order on market
  fastify.post(
    '/:id/orders',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: marketId } = request.params as { id: string };
      const userId = request.user.id;

      const parseResult = CreateOrderSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { outcome, side, price, quantity } = parseResult.data;
      const priceDecimal = new Decimal(price);
      const quantityDecimal = new Decimal(quantity);

      // Check market exists and is open
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) {
        return reply.status(404).send({ error: 'Not Found', message: 'Market not found' });
      }
      if (market.status !== 'OPEN') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Market is not open' });
      }

      // Execute in transaction
      const result = await prisma.$transaction(async (tx) => {
        if (side === 'BUY') {
          // Check and reserve funds
          const balance = await tx.balance.findUnique({ where: { userId } });
          const availableBalance = balance
            ? new Decimal(balance.available.toString())
            : new Decimal(0);
          const requiredAmount = priceDecimal.times(quantityDecimal);

          if (availableBalance.lt(requiredAmount)) {
            throw new Error(`Insufficient funds. Required: ${requiredAmount}, Available: ${availableBalance}`);
          }

          // Create order
          const order = await tx.order.create({
            data: {
              userId,
              marketId,
              outcome,
              side,
              price: priceDecimal.toString(),
              quantity: quantityDecimal.toString(),
              remaining: quantityDecimal.toString(),
              status: 'OPEN',
            },
          });

          // Reserve funds via ledger
          const reserveCalc = calculateBuyReserve(userId, order.id, priceDecimal, quantityDecimal);
          await applyLedger(tx, {
            userId,
            deltaAvailable: reserveCalc.ledgerEntry.deltaAvailable,
            deltaReserved: reserveCalc.ledgerEntry.deltaReserved,
            reason: 'ORDER_RESERVE',
            refType: 'order',
            refId: order.id,
          });

          return order;
        } else {
          // SELL order - check position
          const position = await tx.position.findUnique({
            where: {
              userId_marketId_outcome: { userId, marketId, outcome },
            },
          });

          const availableShares = position
            ? new Decimal(position.shares.toString()).minus(position.reservedShares.toString())
            : new Decimal(0);

          if (availableShares.lt(quantityDecimal)) {
            throw new Error(`Insufficient shares. Required: ${quantityDecimal}, Available: ${availableShares}`);
          }

          // Create order
          const order = await tx.order.create({
            data: {
              userId,
              marketId,
              outcome,
              side,
              price: priceDecimal.toString(),
              quantity: quantityDecimal.toString(),
              remaining: quantityDecimal.toString(),
              status: 'OPEN',
            },
          });

          // Reserve shares
          await updatePosition(tx, {
            userId,
            marketId,
            outcome,
            deltaShares: new Decimal(0),
            deltaReservedShares: quantityDecimal,
          });

          return order;
        }
      });

      // Add to in-memory order book and match
      const books = getOrCreateOrderBooks(marketId);
      const engine = outcome === 'YES' ? books.YES : books.NO;

      const matchResult = engine.addOrder({
        id: result.id,
        userId,
        marketId,
        outcome,
        side,
        price: priceDecimal,
        quantity: quantityDecimal,
        remaining: quantityDecimal,
        createdAt: result.createdAt,
      });

      // Process matches
      for (const match of matchResult.matches) {
        await prisma.$transaction(async (tx) => {
          // Create trade record
          const trade = await tx.trade.create({
            data: {
              marketId,
              outcome,
              price: match.price.toString(),
              quantity: match.quantity.toString(),
              makerOrderId: match.makerOrderId,
              takerOrderId: match.takerOrderId,
              makerUserId: match.makerUserId,
              takerUserId: match.takerUserId,
              takerFee: match.takerFee.toString(),
            },
          });

          // Get maker order to determine side
          const makerOrder = await tx.order.findUnique({ where: { id: match.makerOrderId } });
          if (!makerOrder) throw new Error('Maker order not found');

          // Calculate settlement
          const settlement = calculateTradeSettlement({
            tradeId: trade.id,
            marketId,
            outcome,
            makerOrderId: match.makerOrderId,
            takerOrderId: match.takerOrderId,
            makerUserId: match.makerUserId,
            takerUserId: match.takerUserId,
            makerSide: makerOrder.side as 'BUY' | 'SELL',
            price: match.price,
            quantity: match.quantity,
            takerFee: match.takerFee,
          });

          // Apply ledger entries
          for (const entry of settlement.ledgerEntries) {
            await applyLedger(tx, {
              userId: entry.userId,
              deltaAvailable: entry.deltaAvailable,
              deltaReserved: entry.deltaReserved,
              reason: entry.reason as any,
              refType: entry.refType,
              refId: entry.refId,
            });
          }

          // Update positions
          for (const posUpdate of settlement.positionUpdates) {
            await updatePosition(tx, {
              userId: posUpdate.userId,
              marketId: posUpdate.marketId,
              outcome: posUpdate.outcome,
              deltaShares: posUpdate.deltaShares,
              deltaReservedShares: posUpdate.deltaReservedShares,
              tradePrice: posUpdate.tradePrice,
            });
          }

          // Update order statuses
          await tx.order.update({
            where: { id: match.makerOrderId },
            data: {
              remaining: { decrement: parseFloat(match.quantity.toString()) },
              status:
                match.quantity.eq(new Decimal(makerOrder.remaining.toString()))
                  ? 'FILLED'
                  : 'PARTIAL',
            },
          });

          await tx.order.update({
            where: { id: match.takerOrderId },
            data: {
              remaining: { decrement: parseFloat(match.quantity.toString()) },
              status:
                matchResult.remainingOrder === null
                  ? 'FILLED'
                  : 'PARTIAL',
            },
          });
        });
      }

      // Update order status if fully filled
      if (matchResult.remainingOrder === null) {
        await prisma.order.update({
          where: { id: result.id },
          data: { status: 'FILLED', remaining: 0 },
        });
      }

      return {
        success: true,
        data: {
          id: result.id,
          userId: result.userId,
          marketId: result.marketId,
          outcome: result.outcome,
          side: result.side,
          price: result.price.toString(),
          quantity: result.quantity.toString(),
          remaining: matchResult.remainingOrder?.remaining.toString() ?? '0',
          status: matchResult.remainingOrder === null ? 'FILLED' : result.status,
          createdAt: result.createdAt,
          matchCount: matchResult.matches.length,
        },
      };
    }
  );

  // Get order book
  fastify.get('/:id/orderbook', async (request, reply) => {
    const { id } = request.params as { id: string };

    const market = await prisma.market.findUnique({ where: { id } });
    if (!market) {
      return reply.status(404).send({ error: 'Not Found', message: 'Market not found' });
    }

    const books = getOrCreateOrderBooks(id);
    const yesBook = books.YES.getOrderBook();
    const noBook = books.NO.getOrderBook();

    return {
      success: true,
      data: {
        YES: {
          bids: yesBook.bids.map((l) => ({
            price: l.price.toString(),
            quantity: l.quantity.toString(),
            orderCount: l.orderCount,
          })),
          asks: yesBook.asks.map((l) => ({
            price: l.price.toString(),
            quantity: l.quantity.toString(),
            orderCount: l.orderCount,
          })),
          bestBid: books.YES.getBestBid()?.toString() ?? null,
          bestAsk: books.YES.getBestAsk()?.toString() ?? null,
          midpoint: books.YES.getMidpoint()?.toString() ?? null,
        },
        NO: {
          bids: noBook.bids.map((l) => ({
            price: l.price.toString(),
            quantity: l.quantity.toString(),
            orderCount: l.orderCount,
          })),
          asks: noBook.asks.map((l) => ({
            price: l.price.toString(),
            quantity: l.quantity.toString(),
            orderCount: l.orderCount,
          })),
          bestBid: books.NO.getBestBid()?.toString() ?? null,
          bestAsk: books.NO.getBestAsk()?.toString() ?? null,
          midpoint: books.NO.getMidpoint()?.toString() ?? null,
        },
      },
    };
  });

  // Get trades
  fastify.get('/:id/trades', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '50' } = request.query as { limit?: string };

    const trades = await prisma.trade.findMany({
      where: { marketId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    return {
      success: true,
      data: trades.map((t) => ({
        id: t.id,
        marketId: t.marketId,
        outcome: t.outcome,
        price: t.price.toString(),
        quantity: t.quantity.toString(),
        makerOrderId: t.makerOrderId,
        takerOrderId: t.takerOrderId,
        makerUserId: t.makerUserId,
        takerUserId: t.takerUserId,
        takerFee: t.takerFee.toString(),
        createdAt: t.createdAt,
      })),
    };
  });

  // Resolve market (ADMIN only)
  fastify.post(
    '/:id/resolve',
    { preHandler: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id: marketId } = request.params as { id: string };
      const userId = request.user.id;

      const parseResult = ResolveMarketSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { winningOutcome } = parseResult.data;

      // Check market
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) {
        return reply.status(404).send({ error: 'Not Found', message: 'Market not found' });
      }
      if (market.status !== 'OPEN') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Market is not open' });
      }

      // Get all positions for this market
      const positions = await prisma.position.findMany({
        where: { marketId },
      });

      // Calculate settlement
      const settlementCalc = calculateSettlement(
        marketId,
        winningOutcome,
        positions.map((p) => ({
          userId: p.userId,
          marketId: p.marketId,
          outcome: p.outcome as 'YES' | 'NO',
          shares: new Decimal(p.shares.toString()),
          reservedShares: new Decimal(p.reservedShares.toString()),
          avgPrice: new Decimal(p.avgPrice.toString()),
        }))
      );

      // Cancel all open orders and get refunds
      const openOrders = await prisma.order.findMany({
        where: { marketId, status: { in: ['OPEN', 'PARTIAL'] } },
      });

      const cancellationCalc = calculateCancellation(
        marketId,
        openOrders.map((o) => ({
          id: o.id,
          userId: o.userId,
          marketId: o.marketId,
          outcome: o.outcome as 'YES' | 'NO',
          side: o.side as 'BUY' | 'SELL',
          price: new Decimal(o.price.toString()),
          remaining: new Decimal(o.remaining.toString()),
        })),
        []
      );

      // Execute in transaction
      await prisma.$transaction(async (tx) => {
        // Create resolution record
        await tx.marketResolution.create({
          data: {
            marketId,
            winningOutcome,
            resolverUserId: userId,
          },
        });

        // Update market status
        await tx.market.update({
          where: { id: marketId },
          data: { status: 'RESOLVED' },
        });

        // Cancel all open orders
        await tx.order.updateMany({
          where: { marketId, status: { in: ['OPEN', 'PARTIAL'] } },
          data: { status: 'CANCELLED' },
        });

        // Apply cancellation refunds
        for (const entry of cancellationCalc.ledgerEntries) {
          await applyLedger(tx, {
            userId: entry.userId,
            deltaAvailable: entry.deltaAvailable,
            deltaReserved: entry.deltaReserved,
            reason: entry.reason as any,
            refType: entry.refType,
            refId: entry.refId,
          });
        }

        // Release reserved shares from cancelled SELL orders
        for (const posUpdate of cancellationCalc.positionUpdates) {
          await updatePosition(tx, {
            userId: posUpdate.userId,
            marketId: posUpdate.marketId,
            outcome: posUpdate.outcome,
            deltaShares: new Decimal(0),
            deltaReservedShares: posUpdate.releaseReservedShares.neg(),
          });
        }

        // Apply settlement ledger entries
        for (const entry of settlementCalc.ledgerEntries) {
          await applyLedger(tx, {
            userId: entry.userId,
            deltaAvailable: entry.deltaAvailable,
            deltaReserved: entry.deltaReserved,
            reason: entry.reason as any,
            refType: entry.refType,
            refId: entry.refId,
          });
        }

        // Clear positions
        for (const posUpdate of settlementCalc.positionUpdates) {
          await tx.position.update({
            where: {
              userId_marketId_outcome: {
                userId: posUpdate.userId,
                marketId: posUpdate.marketId,
                outcome: posUpdate.outcome,
              },
            },
            data: {
              shares: posUpdate.newShares.toString(),
              reservedShares: posUpdate.newReservedShares.toString(),
            },
          });
        }
      });

      // Clear in-memory order books
      orderBooks.delete(marketId);

      return {
        success: true,
        data: {
          marketId,
          winningOutcome,
          settledPositions: settlementCalc.positionUpdates.length,
          cancelledOrders: cancellationCalc.orderIds.length,
        },
      };
    }
  );

  // Cancel market (ADMIN only)
  fastify.post(
    '/:id/cancel',
    { preHandler: [fastify.authenticateAdmin] },
    async (request, reply) => {
      const { id: marketId } = request.params as { id: string };

      // Check market
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) {
        return reply.status(404).send({ error: 'Not Found', message: 'Market not found' });
      }
      if (market.status !== 'OPEN') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Market is not open' });
      }

      // Get all open orders
      const openOrders = await prisma.order.findMany({
        where: { marketId, status: { in: ['OPEN', 'PARTIAL'] } },
      });

      // Calculate cancellation
      const cancellationCalc = calculateCancellation(
        marketId,
        openOrders.map((o) => ({
          id: o.id,
          userId: o.userId,
          marketId: o.marketId,
          outcome: o.outcome as 'YES' | 'NO',
          side: o.side as 'BUY' | 'SELL',
          price: new Decimal(o.price.toString()),
          remaining: new Decimal(o.remaining.toString()),
        })),
        []
      );

      // Execute in transaction
      await prisma.$transaction(async (tx) => {
        // Update market status
        await tx.market.update({
          where: { id: marketId },
          data: { status: 'CANCELLED' },
        });

        // Cancel all open orders
        await tx.order.updateMany({
          where: { marketId, status: { in: ['OPEN', 'PARTIAL'] } },
          data: { status: 'CANCELLED' },
        });

        // Apply cancellation refunds
        for (const entry of cancellationCalc.ledgerEntries) {
          await applyLedger(tx, {
            userId: entry.userId,
            deltaAvailable: entry.deltaAvailable,
            deltaReserved: entry.deltaReserved,
            reason: entry.reason as any,
            refType: entry.refType,
            refId: entry.refId,
          });
        }

        // Release reserved shares
        for (const posUpdate of cancellationCalc.positionUpdates) {
          await updatePosition(tx, {
            userId: posUpdate.userId,
            marketId: posUpdate.marketId,
            outcome: posUpdate.outcome,
            deltaShares: new Decimal(0),
            deltaReservedShares: posUpdate.releaseReservedShares.neg(),
          });
        }
      });

      // Clear in-memory order books
      orderBooks.delete(marketId);

      return {
        success: true,
        data: {
          marketId,
          cancelledOrders: cancellationCalc.orderIds.length,
        },
      };
    }
  );
};
