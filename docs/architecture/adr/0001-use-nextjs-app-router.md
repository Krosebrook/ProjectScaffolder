# ADR-0001: Use Next.js App Router

## Status

Accepted

## Date

2024-01-15

## Context

ProjectScaffolder needs a modern web framework that supports:
- Server-side rendering for SEO and performance
- API routes for backend logic
- TypeScript for type safety
- Easy deployment to edge networks
- React Server Components for improved performance

We need to choose between Next.js Pages Router (legacy) and App Router (new).

## Decision

Use Next.js 14+ with the App Router architecture.

**Key implementation details:**
- All routes in `src/app/` directory
- Server Components by default
- Client Components with `"use client"` directive
- API routes in `src/app/api/`
- Layouts for shared UI structure

## Consequences

### Positive

- **Performance**: React Server Components reduce client-side JavaScript
- **SEO**: Server-side rendering for better search indexing
- **DX**: Co-located layouts, loading states, and error boundaries
- **Streaming**: Incremental page rendering
- **Future-proof**: App Router is Next.js's recommended approach

### Negative

- **Learning curve**: Team needs to learn new patterns
- **Library compatibility**: Some libraries not yet App Router compatible
- **Complexity**: Server vs Client component boundaries require careful thought
- **Caching**: More complex caching behavior to understand

### Neutral

- Migration path from Pages Router exists if needed
- Community still adopting, fewer examples available

## Alternatives Considered

### Next.js Pages Router

The legacy routing system with `pages/` directory.

**Rejected because:**
- No React Server Components support
- Less performant for data fetching
- Being phased out as primary recommendation

### Remix

Full-stack React framework with nested routing.

**Rejected because:**
- Smaller ecosystem
- Less Vercel integration
- Team more familiar with Next.js

### Vite + React

Client-side only React with Vite bundler.

**Rejected because:**
- No SSR out of the box
- Requires manual API setup
- No built-in deployment optimization

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
