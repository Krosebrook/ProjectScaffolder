# ADR-0003: Prisma ORM with PostgreSQL

## Status

Accepted

## Date

2024-01-15

## Context

ProjectScaffolder needs a reliable data persistence layer that supports:
- Complex relational data (users, projects, generations, deployments)
- Type-safe database queries
- Easy schema evolution and migrations
- Good developer experience
- Serverless-compatible connection handling

We need to choose both a database and an ORM/query builder.

## Decision

Use **Prisma ORM 7** with **PostgreSQL** database.

**Key implementation details:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

```typescript
// src/lib/db/index.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const db = new PrismaClient({ adapter });
```

## Consequences

### Positive

- **Type safety**: Generated TypeScript types from schema
- **Developer experience**: Intuitive query API, great tooling
- **Migrations**: Built-in migration system
- **Relations**: First-class support for complex relationships
- **Introspection**: Can generate schema from existing database
- **Prisma Studio**: Visual database browser

### Negative

- **Learning curve**: Prisma's unique query syntax
- **Performance**: Additional abstraction layer overhead
- **Complex queries**: Raw SQL needed for some advanced cases
- **N+1 queries**: Need to use `include` carefully
- **Version upgrades**: Breaking changes between major versions

### Neutral

- Schema-first approach requires discipline
- Generated client adds to bundle size

## Alternatives Considered

### Drizzle ORM

Type-safe ORM with SQL-like syntax.

**Rejected because:**
- Less mature ecosystem
- Fewer learning resources
- Team more familiar with Prisma

### Kysely

Type-safe SQL query builder.

**Rejected because:**
- Lower-level than needed
- No migration system
- More verbose queries

### Raw SQL with pg

Direct PostgreSQL driver usage.

**Rejected because:**
- No type safety
- Manual query building
- More error-prone
- More code to maintain

### MongoDB

Document database alternative.

**Rejected because:**
- Relational data model fits better
- Need for transactions
- PostgreSQL better for compliance requirements

## Database Choice: PostgreSQL

### Why PostgreSQL over alternatives:

| Database | Consideration |
|----------|---------------|
| **PostgreSQL** | Relational, ACID, JSON support, mature |
| MySQL | Less feature-rich, weaker JSON support |
| SQLite | Not suitable for production multi-user |
| MongoDB | Document model not ideal for our schema |

### Hosting Options

| Provider | Pros | Cons |
|----------|------|------|
| Vercel Postgres | Integrated, easy setup | Limited regions |
| Neon | Serverless, generous free tier | Newer |
| Supabase | Full BaaS features | May be overkill |
| PlanetScale | Auto-scaling | MySQL only |

## Implementation Notes

### Connection Pooling

For serverless environments, use connection pooling:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});
```

### Migration Strategy

```bash
# Development: Direct push
npx prisma db push

# Production: Migrations
npx prisma migrate dev --name description
npx prisma migrate deploy
```

### Query Optimization

```typescript
// Use select to limit fields
const projects = await db.project.findMany({
  select: { id: true, name: true, status: true },
});

// Use include judiciously
const projectWithGenerations = await db.project.findUnique({
  where: { id },
  include: { codeGenerations: { take: 5 } },
});
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma with Next.js Best Practices](https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
