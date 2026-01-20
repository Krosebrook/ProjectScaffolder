# ProjectScaffolder - Claude Code Instructions

## Project Overview
Enterprise-grade project scaffolding platform that uses AI to generate complete codebases. Built with Next.js 14+, TypeScript, Prisma, and supports multiple LLM providers.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **AI Providers**: Anthropic, OpenAI, Google Gemini
- **Deployment**: Vercel, GitHub Actions
- **Styling**: Tailwind CSS, Radix UI

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth endpoints
│   │   ├── projects/      # Project CRUD
│   │   ├── generate/      # Code generation
│   │   └── deploy/        # Deployment triggers
│   ├── dashboard/         # Dashboard pages
│   └── auth/              # Auth pages
├── lib/
│   ├── db/                # Prisma client
│   ├── ai/                # LLM provider abstraction
│   ├── deploy/            # Vercel/GitHub integrations
│   ├── auth/              # Auth utilities
│   └── compliance/        # Audit logging, GDPR
├── components/
│   ├── ui/                # Base UI components
│   └── dashboard/         # Dashboard components
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

## Key Files
- `prisma/schema.prisma` - Database schema
- `src/lib/auth/config.ts` - NextAuth configuration
- `src/lib/ai/index.ts` - LLM provider factory
- `src/lib/compliance/audit.ts` - Audit logging

## Development Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npx prisma db push   # Sync database schema
npx prisma studio    # Open Prisma Studio
```

## Environment Variables
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth encryption key
- `ANTHROPIC_API_KEY` - For Claude AI
- `GITHUB_TOKEN` - For repo creation
- `VERCEL_TOKEN` - For deployment

## API Endpoints
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `POST /api/generate` - Generate code
- `POST /api/deploy` - Deploy project

## Coding Standards
- Use TypeScript strict mode
- Follow Next.js App Router conventions
- Validate all inputs with Zod
- Log all CRUD operations for audit
- Keep components small and focused
- Use server components by default

## Security Requirements
- Never commit secrets
- Validate all user inputs
- Use parameterized queries (Prisma)
- Implement rate limiting
- Log security-relevant events
- Encrypt sensitive data at rest
