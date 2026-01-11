# Security Model

This document describes the security architecture of Axioma, including authentication, authorization, and data integrity measures.

## Authentication

### JWT-Based Auth

Axioma uses JSON Web Tokens (JWT) for authentication:

```
Flow:
1. User registers/logs in with email + password
2. Server validates credentials, returns JWT
3. Client includes JWT in Authorization header
4. Server validates JWT on each request
```

### Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1704067200,
  "exp": 1704153600
}
```

- **sub**: User ID (UUID)
- **role**: USER or ADMIN
- **exp**: Token expiry (24 hours default)

### Password Security

- Passwords are hashed using bcrypt (12 rounds)
- Minimum password length: 6 characters
- Passwords are never stored in plaintext
- Passwords are never logged or returned in API responses

## Authorization

### Role-Based Access Control

Two roles are defined:

| Role | Capabilities |
|------|--------------|
| USER | Place orders, view markets, manage portfolio |
| ADMIN | All USER capabilities + create markets, resolve/cancel markets |

### Endpoint Protection

```typescript
// Public endpoints (no auth required)
GET /api/markets
GET /api/markets/:id
GET /api/markets/:id/orderbook
GET /api/markets/:id/trades

// Authenticated endpoints
POST /api/markets/:id/orders  // requires token
GET /api/portfolio            // requires token
POST /api/orders/:id/cancel   // requires token + ownership

// Admin endpoints
POST /api/markets             // requires ADMIN role
POST /api/markets/:id/resolve // requires ADMIN role
POST /api/markets/:id/cancel  // requires ADMIN role
```

### Resource Ownership

Users can only:
- Cancel their own orders
- View their own portfolio
- Access their own ledger history

Ownership is verified in API handlers:

```typescript
if (order.userId !== request.user.id) {
  throw new Forbidden('Not your order');
}
```

## Ledger Integrity

### Append-Only Ledger

All balance changes are recorded as immutable ledger entries:

```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  delta_available DECIMAL(18,8) NOT NULL,
  delta_reserved DECIMAL(18,8) NOT NULL,
  reason VARCHAR NOT NULL,
  ref_type VARCHAR,
  ref_id UUID,
  created_at TIMESTAMP NOT NULL
);
```

- **Immutable**: No UPDATE or DELETE operations
- **Auditable**: Every change has a reason and reference
- **Traceable**: Full history of all balance changes

### Balance Invariants

Before every ledger entry, invariants are validated:

```typescript
function validateBalanceState(balance: Balance, delta: LedgerDelta): void {
  const newAvailable = balance.available + delta.deltaAvailable;
  const newReserved = balance.reserved + delta.deltaReserved;
  
  if (newAvailable < 0) {
    throw new LedgerInvariantError('Available balance cannot go negative');
  }
  if (newReserved < 0) {
    throw new LedgerInvariantError('Reserved balance cannot go negative');
  }
}
```

### Position Invariants

Position changes are also validated:

```typescript
function validatePositionState(position: Position, delta: PositionDelta): void {
  const newShares = position.shares + delta.deltaShares;
  const newReserved = position.reservedShares + delta.deltaReserved;
  
  if (newShares < 0) {
    throw new PositionInvariantError('Shares cannot go negative');
  }
  if (newReserved < 0) {
    throw new PositionInvariantError('Reserved shares cannot go negative');
  }
  if (newReserved > newShares) {
    throw new PositionInvariantError('Cannot reserve more than owned');
  }
}
```

## Transaction Safety

### Atomic Operations

All multi-step operations use database transactions:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Validate user balance
  // 2. Create order
  // 3. Reserve funds
  // 4. Create ledger entry
  // All succeed or all fail
});
```

### Order of Operations

The order of operations is designed to prevent race conditions:

1. Read and lock user balance (SELECT FOR UPDATE)
2. Validate sufficient funds
3. Create order record
4. Update balance (reserve funds)
5. Create ledger entry
6. Commit transaction

### Idempotency

Critical operations include idempotency checks:
- Order placement generates unique order ID
- Trade settlement references specific trade ID
- Market resolution can only happen once

## Input Validation

### Zod Schema Validation

All API inputs are validated using Zod schemas:

```typescript
const CreateOrderInput = z.object({
  outcome: z.enum(['YES', 'NO']),
  side: z.enum(['BUY', 'SELL']),
  price: z.string().refine(isValidPrice),
  quantity: z.string().refine(isPositiveDecimal),
});
```

### Price Validation

Order prices must be:
- Greater than 0.00
- Less than 1.00
- Valid decimal format

### Quantity Validation

Order quantities must be:
- Greater than 0
- Valid decimal format
- No more than available balance/shares

## Error Handling

### No Information Leakage

Error responses are sanitized:

```typescript
// Bad - leaks internal info
{ error: 'User not found in database users table' }

// Good - generic message
{ error: 'Invalid credentials' }
```

### Standard Error Responses

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

## Rate Limiting (Future)

For production, implement:
- Rate limiting per IP
- Rate limiting per user
- Order placement throttling
- WebSocket connection limits

## CORS Configuration

```typescript
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

## Environment Security

### Required Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
CORS_ORIGIN=https://app.axioma.io
```

### Secret Management

- JWT_SECRET must be at least 32 characters
- Use different secrets for each environment
- Never commit secrets to version control
- Use environment-specific `.env` files

## Audit Trail

Every significant action is traceable:

| Action | Audit Data |
|--------|------------|
| Order placed | Order record + ledger entry |
| Trade executed | Trade record + 2 ledger entries |
| Order cancelled | Order status + ledger entry |
| Market resolved | Resolution record + ledger entries |

## Development vs Production

### Development Mode

```typescript
// Dev endpoints enabled
POST /api/dev/faucet  // Free test USDC
POST /api/dev/reset   // Reset account

// Less strict validation
- Weaker passwords allowed
- Verbose error messages
- CORS allows localhost
```

### Production Mode

```typescript
// Dev endpoints disabled
- Faucet disabled or removed
- Reset disabled

// Strict validation
- Strong password requirements
- Generic error messages
- CORS restricted to production domain
```

## Security Checklist

- [x] Password hashing with bcrypt
- [x] JWT authentication
- [x] Role-based authorization
- [x] Input validation with Zod
- [x] SQL injection prevention (Prisma)
- [x] Atomic transactions
- [x] Ledger invariant validation
- [x] Ownership verification
- [ ] Rate limiting (future)
- [ ] HTTPS enforcement (deployment)
- [ ] Security headers (deployment)
- [ ] Audit logging (future)
