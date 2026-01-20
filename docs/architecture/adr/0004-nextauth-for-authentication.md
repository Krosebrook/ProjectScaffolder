# ADR-0004: NextAuth.js for Authentication

## Status

Accepted

## Date

2024-01-15

## Context

ProjectScaffolder needs a robust authentication system that supports:
- Multiple OAuth providers (GitHub, Google)
- Optional email/password authentication
- Session management
- Role-based access control
- Easy integration with Next.js

We need to choose an authentication solution that balances security, developer experience, and flexibility.

## Decision

Use **NextAuth.js v4** with JWT session strategy.

**Key implementation details:**

```typescript
// src/lib/auth/config.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GitHubProvider({...}),
    GoogleProvider({...}),
    CredentialsProvider({...}),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};
```

## Consequences

### Positive

- **Next.js integration**: Built specifically for Next.js
- **OAuth support**: Easy setup for GitHub, Google, etc.
- **Flexibility**: Supports JWT, database sessions, or both
- **TypeScript**: Good type definitions
- **Active community**: Well-maintained, many examples
- **Prisma adapter**: Seamless database integration

### Negative

- **Complexity**: Configuration can be verbose
- **Version upgrades**: Breaking changes between v4 and v5
- **Customization**: Some advanced flows require workarounds
- **Documentation**: Can be confusing for edge cases

### Neutral

- Need to extend types for custom user fields
- Audit logging requires manual implementation

## Alternatives Considered

### Clerk

Managed authentication service.

**Rejected because:**
- Additional vendor dependency
- Recurring cost
- Less control over data
- Overkill for initial launch

### Auth0

Enterprise authentication platform.

**Rejected because:**
- Complex for simple use cases
- Pricing scales with users
- External dependency
- Slower iteration

### Custom JWT Implementation

Build authentication from scratch.

**Rejected because:**
- Security risks with custom auth
- Time to implement properly
- Maintenance burden
- Reinventing the wheel

### Supabase Auth

Supabase's authentication module.

**Rejected because:**
- Ties us to Supabase ecosystem
- Less flexible than NextAuth
- Would need Supabase database too

## Implementation Notes

### Adding Custom User Fields

```typescript
// Extend User type in types/index.ts
interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
}

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}
```

### Role-Based Access Control

```typescript
// Helper functions in src/lib/auth/session.ts
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }
  return user;
}

// Usage in API routes
const user = await requireRole(["ADMIN", "ENTERPRISE_ADMIN"]);
```

### OAuth Provider Setup

| Provider | Callback URL |
|----------|-------------|
| GitHub | `{NEXTAUTH_URL}/api/auth/callback/github` |
| Google | `{NEXTAUTH_URL}/api/auth/callback/google` |

### Session Security

- JWT stored in HTTP-only cookie
- CSRF protection via NextAuth
- Session max age: 30 days
- Rolling sessions on activity

## Migration Path to v5

NextAuth v5 (Auth.js) is in beta. Migration considerations:
- New configuration structure
- Edge runtime support
- Different callback signatures
- Monitor stability before migrating

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Adapter](https://next-auth.js.org/adapters/prisma)
- [JWT vs Database Sessions](https://next-auth.js.org/configuration/options#session)
