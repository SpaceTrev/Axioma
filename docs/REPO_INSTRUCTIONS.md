# Repository Instructions

## Overview

This monorepo contains a binary prediction market platform with a Fastify API, a Next.js web app, and shared packages for database access, the matching engine, ledger logic, and shared types. It uses pnpm workspaces with Turborepo for task orchestration. See `README.md` for a high-level architecture summary and `package.json` for root scripts. 

## Repo Layout

```
apps/
  api/          # Fastify REST API
  web/          # Next.js frontend
packages/
  api-client/   # Typed API client
  db/           # Prisma client & database transactions
  engine/       # Matching engine & settlement logic
  ledger/       # Ledger types & invariant validation
  shared/       # Shared types, Zod schemas, DTOs
docs/
  ENGINE.md     # Matching engine design
  SECURITY.md   # Auth and authorization model
```

## Setup

1. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```
2. Start PostgreSQL:
   ```bash
   docker-compose up -d
   ```
3. Generate and seed the database:
   ```bash
   cd packages/db
   pnpm db:generate
   pnpm db:push
   pnpm db:seed
   ```
4. Start the dev servers:
   ```bash
   cd ../..
   pnpm dev
   ```

## Common Commands

From the repo root:

```bash
pnpm dev     # Run app dev servers
pnpm build   # Build all apps/packages
pnpm test    # Run tests across the repo
pnpm lint    # Lint all apps/packages
pnpm format  # Format supported files
```

## Services

When running `pnpm dev`:

- API: http://localhost:3001 (Swagger at `/docs`)
- Web: http://localhost:3000

## Notes

- Use Node.js >= 18 and pnpm >= 8.
- Default seeded accounts are listed in `README.md` for local testing.
