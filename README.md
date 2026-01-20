# ProjectScaffolder

Enterprise-grade project scaffolding platform that uses AI to generate complete, production-ready codebases.

## Features

- **AI-Powered Code Generation**: Generate complete project codebases using Claude, GPT-4, or Gemini
- **Multi-Provider LLM Support**: Choose your preferred AI provider (Anthropic, OpenAI, Google)
- **One-Click Deployment**: Deploy to Vercel or push to GitHub with a single click
- **Enterprise Compliance**: SOC 2 Type II and GDPR-ready with full audit logging
- **Role-Based Access Control**: User, Admin, and Enterprise Admin roles
- **Project Management**: Track projects, code generations, and deployments

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **AI Providers**: Anthropic Claude, OpenAI GPT-4, Google Gemini
- **Deployment**: Vercel
- **Styling**: Tailwind CSS, Radix UI

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- At least one AI provider API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/project-scaffolder.git
cd project-scaffolder
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npx prisma db push
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | Auth encryption key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | One of* |
| `OPENAI_API_KEY` | OpenAI API key | One of* |
| `GOOGLE_AI_API_KEY` | Google AI API key | One of* |
| `GITHUB_TOKEN` | GitHub personal access token | Optional |
| `VERCEL_TOKEN` | Vercel API token | Optional |

*At least one AI provider API key is required.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── auth/              # Auth pages
├── lib/
│   ├── db/                # Prisma client
│   ├── ai/                # LLM providers
│   ├── deploy/            # Deployment integrations
│   ├── auth/              # Auth utilities
│   └── compliance/        # Audit & GDPR
├── components/            # React components
├── hooks/                 # Custom hooks
└── types/                 # TypeScript types
```

## API Reference

### Projects

- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

### Code Generation

- `POST /api/generate` - Generate code for a project
- `GET /api/generate?projectId=xxx` - Get generation history

### Deployment

- `POST /api/deploy` - Deploy a project
- `GET /api/deploy?projectId=xxx` - Get deployment history

## Compliance

### SOC 2 Type II

- Comprehensive audit logging for all operations
- Role-based access control (RBAC)
- Encrypted data at rest
- Secure session management
- Input validation on all endpoints

### GDPR

- Data Subject Access Request (DSAR) support
- Right to deletion (Right to be Forgotten)
- Consent management
- Data processing records
- Privacy by design

## Development

```bash
# Run development server
npm run dev

# Run linting
npm run lint

# Run type checking
npx tsc --noEmit

# Run tests
npm test

# Build for production
npm run build
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy

### Manual

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
