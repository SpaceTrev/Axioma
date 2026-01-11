# Axioma

A binary prediction market platform with ledgered accounting and a deterministic matching engine.

## 🏗️ Architecture

This is a monorepo using pnpm workspaces and Turborepo:

### Apps

- **apps/api** - Fastify REST API
  - JWT authentication
  - Order matching & execution
  - Market resolution & settlement
  - Swagger API docs at `/docs`
- **apps/web** - Next.js frontend
  - Market listing & trading UI
  - Portfolio management
  - Admin dashboard

### Packages

- **packages/shared** - Shared types, Zod schemas, DTOs
- **packages/db** - Prisma client & database transactions
- **packages/engine** - Matching engine & settlement logic
- **packages/ledger** - Ledger types & invariant validation
- **packages/api-client** - Typed API client for web/mobile

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker (for PostgreSQL)

### Setup

```bash
# Clone and install
git clone https://github.com/SpaceTrev/Axioma.git
cd Axioma
pnpm install

# Start PostgreSQL
docker-compose up -d

# Setup database
cd packages/db
pnpm db:generate
pnpm db:push
pnpm db:seed

# Start development servers
cd ../..
pnpm dev
```

This starts:
- **API** at http://localhost:3001 (Swagger docs at http://localhost:3001/docs)
- **Web** at http://localhost:3000

### Default Accounts (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@axioma.io | admin123 | ADMIN |
| user@example.com | password123 | USER |

## 📚 Documentation

- [Engine Design](docs/ENGINE.md) - Matching engine & settlement logic
- [Security Model](docs/SECURITY.md) - Authentication & authorization

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
cd packages/engine
pnpm test
```

## 💡 Key Concepts

### Binary Markets
Each market is a YES/NO question. Shares pay out 1 USDC if correct, 0 if wrong.

### Ledgered Accounting
All balance changes go through append-only ledger entries with double-entry bookkeeping invariants.

### Order Matching
- Limit orders only for MVP
- Price-time priority (best price first, then earliest)
- BUY orders reserve `price × quantity`
- SELL orders reserve shares from positions

### Settlement
- Market resolution pays winners 1 USDC per share
- Losers receive nothing
- Open orders are cancelled and reserves released

## 📦 API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/me` - Get current user

### Markets
- `GET /api/markets` - List markets
- `GET /api/markets/:id` - Get market details
- `POST /api/markets` - Create market (auth)
- `GET /api/markets/:id/orderbook` - Get order book
- `GET /api/markets/:id/trades` - Get trade history
- `POST /api/markets/:id/orders` - Place order (auth)
- `POST /api/markets/:id/resolve` - Resolve market (admin)
- `POST /api/markets/:id/cancel` - Cancel market (admin)

### Orders
- `GET /api/orders` - List user's orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/cancel` - Cancel order

### Portfolio
- `GET /api/portfolio` - Get balance, positions, summary
- `GET /api/portfolio/trades` - Trade history
- `GET /api/portfolio/ledger` - Ledger history

### Dev (development only)
- `POST /api/dev/faucet` - Get test USDC
- `POST /api/dev/reset` - Reset account
- `GET /api/dev/stats` - Platform statistics

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, SWR, Zustand
- **Backend**: Fastify 4, TypeScript
- **Database**: PostgreSQL, Prisma
- **Validation**: Zod
- **Build**: Turborepo, pnpm
- **Testing**: Vitest

## 📄 License

MIT
