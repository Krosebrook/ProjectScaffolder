# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for ProjectScaffolder.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help:

- Document why decisions were made
- Provide context for future team members
- Enable revisiting decisions when context changes
- Create accountability for technical choices

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0000](0000-adr-template.md) | ADR Template | Template | - |
| [0001](0001-use-nextjs-app-router.md) | Use Next.js App Router | Accepted | 2024-01-15 |
| [0002](0002-multi-provider-llm-abstraction.md) | Multi-Provider LLM Abstraction | Accepted | 2024-01-15 |
| [0003](0003-prisma-with-postgresql.md) | Prisma ORM with PostgreSQL | Accepted | 2024-01-15 |
| [0004](0004-nextauth-for-authentication.md) | NextAuth.js for Authentication | Accepted | 2024-01-15 |
| [0005](0005-comprehensive-audit-logging.md) | Comprehensive Audit Logging | Accepted | 2024-01-15 |

## ADR Status Definitions

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet accepted |
| **Accepted** | Decision has been made and is in effect |
| **Deprecated** | No longer recommended, but may still be in use |
| **Superseded** | Replaced by another ADR |

## Creating a New ADR

1. Copy `0000-adr-template.md` to a new file
2. Name it `NNNN-short-title.md` where NNNN is the next number
3. Fill in all sections
4. Submit for review via PR
5. Update this README index

## When to Write an ADR

Write an ADR when:
- Choosing between technologies or frameworks
- Making significant architectural changes
- Establishing patterns or conventions
- Making trade-offs that affect the system
- Decisions that are hard to reverse

## ADR Review Process

1. Author creates ADR with status "Proposed"
2. Team reviews and discusses
3. Once consensus reached, status changes to "Accepted"
4. Implementation can proceed

## References

- [Michael Nygard's ADR Article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
