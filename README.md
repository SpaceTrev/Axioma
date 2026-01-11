# Axioma

Crypto prediction market built with pnpm + Turborepo monorepo architecture.

## 🏗️ Architecture

This is a monorepo using pnpm workspaces and Turborepo with the following structure:

### Apps

- **apps/api** - Fastify TypeScript backend API
  - RESTful API for markets and orders
  - Real-time order matching engine
  - PostgreSQL database via Prisma
- **apps/web** - Next.js TypeScript frontend
  - Server-side rendered React application
  - Connects to the Fastify API

### Packages

- **packages/shared** - Zod validation schemas
  - Shared types and validation logic
  - Used across API and web apps
- **packages/db** - Prisma database client
  - PostgreSQL schema and client
  - Shared database access layer
- **packages/engine** - Matching and settlement logic
  - Order matching engine
  - Settlement processing
  - Includes comprehensive test suite

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose (for PostgreSQL)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/SpaceTrev/Axioma.git
cd Axioma
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

4. Start PostgreSQL:

```bash
docker-compose up -d
```

5. Generate Prisma client and push schema:

```bash
cd packages/db
pnpm db:generate
pnpm db:push
```

### Development

Start all apps in development mode:

```bash
pnpm dev
```

This will start:

- API at http://localhost:3001
- Web at http://localhost:3000

### Testing

Run tests for the engine package:

```bash
pnpm test
```

Run tests for a specific package:

```bash
cd packages/engine
pnpm test
```

## 📦 Package Scripts

### Root Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps and packages
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all code
- `pnpm format` - Format code with Prettier

### API Scripts (apps/api)

- `pnpm dev` - Start API in development mode
- `pnpm build` - Build API for production
- `pnpm start` - Start production build

### Web Scripts (apps/web)

- `pnpm dev` - Start Next.js in development mode
- `pnpm build` - Build Next.js for production
- `pnpm start` - Start production build

### Database Scripts (packages/db)

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema to database
- `pnpm db:migrate` - Run migrations
- `pnpm db:studio` - Open Prisma Studio

### Engine Scripts (packages/engine)

- `pnpm test` - Run tests with Jest
- `pnpm test:watch` - Run tests in watch mode

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Fastify, TypeScript
- **Database**: PostgreSQL, Prisma
- **Validation**: Zod
- **Build**: Turborepo, pnpm workspaces
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## 📝 API Endpoints

### Markets

- `GET /api/markets` - List all markets
- `GET /api/markets/:id` - Get market by ID
- `POST /api/markets` - Create new market

### Orders

- `GET /api/orders/market/:marketId` - Get orders for market
- `POST /api/orders` - Create new order
- `GET /api/orders/book/:marketId` - Get order book

### Health

- `GET /health` - API health check

## 🐳 Docker Services

PostgreSQL database is available via Docker Compose:

- Host: localhost
- Port: 5432
- Database: axioma
- User: axioma
- Password: axioma_dev_password

## 📚 Project Structure

```
Axioma/
├── apps/
│   ├── api/              # Fastify API
│   └── web/              # Next.js frontend
├── packages/
│   ├── db/               # Prisma database client
│   ├── engine/           # Matching & settlement logic
│   └── shared/           # Shared Zod schemas
├── .env.example          # Environment variables template
├── docker-compose.yml    # PostgreSQL setup
├── package.json          # Root package config
├── pnpm-workspace.yaml   # pnpm workspace config
├── turbo.json           # Turborepo config
└── tsconfig.json        # Shared TypeScript config
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
