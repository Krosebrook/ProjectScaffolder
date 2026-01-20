# Supabase Setup Guide for ProjectScaffolder

This guide covers setting up Supabase as the database backend for ProjectScaffolder and connecting it to Vercel for deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create Supabase Project](#create-supabase-project)
3. [Database Setup](#database-setup)
4. [Authentication Configuration](#authentication-configuration)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [Vercel Integration](#vercel-integration)
7. [Environment Variables](#environment-variables)
8. [Local Development](#local-development)
9. [Production Checklist](#production-checklist)

---

## Prerequisites

- Node.js 18+ installed
- Supabase CLI installed (`npm install -g supabase`)
- Vercel CLI installed (`npm install -g vercel`)
- Git repository initialized
- GitHub/Google OAuth apps created (for authentication)

## Create Supabase Project

### 1. Create Project via Dashboard

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `projectscaffolder`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to initialize (~2 minutes)

### 2. Get Project Credentials

From the Supabase dashboard, navigate to **Settings > API** and note:

- **Project URL**: `https://[project-ref].supabase.co`
- **Project API Key (anon)**: For client-side requests
- **Project API Key (service_role)**: For server-side requests (keep secret!)

## Database Setup

### 1. Run Migrations

Execute migrations in order from the `supabase/migrations/` directory:

```bash
# Connect to your Supabase project
supabase link --project-ref [your-project-ref]

# Push migrations
supabase db push
```

Or manually run via SQL Editor in dashboard:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run files in order:
   - `00001_create_enums.sql`
   - `00002_create_users_tables.sql`
   - `00003_create_projects_tables.sql`
   - `00004_create_audit_tables.sql`
   - `00005_create_api_keys_table.sql`
   - `00006_create_gdpr_tables.sql`

### 2. Apply Additional Configuration

Run these SQL files in order:

```sql
-- 1. Authentication setup
\i supabase/auth-setup.sql

-- 2. Row Level Security policies
\i supabase/rls-policies.sql

-- 3. Database triggers
\i supabase/triggers.sql

-- 4. Vector search setup (requires pgvector)
\i supabase/vector-setup.sql

-- 5. Seed data
\i supabase/seed.sql
```

### 3. Enable pgvector Extension

1. Go to **Database > Extensions**
2. Search for "vector"
3. Enable the `vector` extension
4. Run `supabase/vector-setup.sql`

### 4. Enable Realtime

1. Go to **Database > Replication**
2. Enable replication for:
   - `projects`
   - `deployments`
   - `code_generations`

## Authentication Configuration

### 1. Configure OAuth Providers

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: ProjectScaffolder
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://[project-ref].supabase.co/auth/v1/callback`
4. Save Client ID and Client Secret

In Supabase Dashboard:

1. Go to **Authentication > Providers**
2. Enable GitHub
3. Enter Client ID and Client Secret

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services > Credentials**
4. Click "Create Credentials > OAuth client ID"
5. Configure consent screen if prompted
6. Choose "Web application"
7. Add authorized redirect URI: `https://[project-ref].supabase.co/auth/v1/callback`
8. Save Client ID and Client Secret

In Supabase Dashboard:

1. Go to **Authentication > Providers**
2. Enable Google
3. Enter Client ID and Client Secret

### 2. Configure Email Templates

1. Go to **Authentication > Email Templates**
2. Customize templates for:
   - Confirm signup
   - Magic link
   - Reset password
   - Change email

### 3. Enable Custom JWT Claims

1. Go to **Authentication > Hooks**
2. Enable "Custom Access Token" hook
3. Point to the `custom_access_token_hook` function

### 4. Configure SSO/SAML (Enterprise)

For enterprise SSO:

1. Go to **Authentication > SSO**
2. Click "Add Provider"
3. Enter Identity Provider metadata URL
4. Configure attribute mapping:

```json
{
  "keys": {
    "email": { "name": "email" },
    "name": { "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" }
  }
}
```

## Edge Functions Deployment

### 1. Deploy Functions

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref [your-project-ref]

# Deploy all functions
supabase functions deploy webhook-handler
supabase functions deploy audit-cleanup
```

### 2. Configure Function Secrets

```bash
# Set secrets for webhook handler
supabase secrets set GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
supabase secrets set VERCEL_WEBHOOK_SECRET=your-vercel-webhook-secret

# Verify secrets
supabase secrets list
```

### 3. Set Up Scheduled Cleanup

Create a cron job for audit cleanup using pg_cron:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule(
  'audit-log-cleanup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/audit-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Vercel Integration

### 1. Install Supabase Integration

1. Go to [Vercel Integrations](https://vercel.com/integrations/supabase)
2. Click "Add Integration"
3. Select your Vercel account and project
4. Authorize Supabase access
5. Select your Supabase project

This automatically syncs environment variables.

### 2. Manual Configuration (Alternative)

If not using the integration, add environment variables manually:

```bash
# In your Vercel project directory
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

### 3. Configure Webhook URLs

In Vercel Dashboard:

1. Go to **Settings > Webhooks**
2. Add webhook:
   - **URL**: `https://[project-ref].supabase.co/functions/v1/webhook-handler`
   - **Events**: Deployment Created, Deployment Ready, Deployment Error

In GitHub Repository:

1. Go to **Settings > Webhooks**
2. Add webhook:
   - **Payload URL**: `https://[project-ref].supabase.co/functions/v1/webhook-handler`
   - **Content type**: `application/json`
   - **Secret**: Your GITHUB_WEBHOOK_SECRET
   - **Events**: Push events

## Environment Variables

### Required Variables

Create a `.env.local` file for local development:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NextAuth (for backward compatibility)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Deployment
GITHUB_TOKEN=ghp_...
VERCEL_TOKEN=...
VERCEL_TEAM_ID=team_... (optional)

# Webhooks
GITHUB_WEBHOOK_SECRET=whsec_...
VERCEL_WEBHOOK_SECRET=...

# Optional: Vector embeddings
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Vercel Environment Variables

Add these in Vercel Dashboard (**Settings > Environment Variables**):

| Variable | Environment | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Supabase service role key |
| `ANTHROPIC_API_KEY` | Production, Preview | Anthropic API key |
| `GITHUB_TOKEN` | Production, Preview | GitHub personal access token |
| `VERCEL_TOKEN` | Production, Preview | Vercel API token |

## Local Development

### 1. Start Supabase Locally

```bash
# Initialize Supabase (first time only)
supabase init

# Start local Supabase
supabase start

# This outputs local URLs:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Anon key: eyJ...
# Service role key: eyJ...
```

### 2. Update Local Environment

```bash
# .env.local for local development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (from supabase start output)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (from supabase start output)
```

### 3. Run Migrations Locally

```bash
# Reset and seed local database
supabase db reset

# Or apply individual migrations
supabase db push
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Access Supabase Studio

Open [http://localhost:54323](http://localhost:54323) to access the local Supabase Studio.

## Production Checklist

Before going to production, verify:

### Security

- [ ] RLS policies are enabled on all tables
- [ ] Service role key is only used server-side
- [ ] Webhook secrets are configured
- [ ] OAuth redirect URLs are correct for production domain
- [ ] Email templates use production URLs
- [ ] Rate limiting is configured

### Database

- [ ] All migrations applied successfully
- [ ] Indexes created for frequently queried columns
- [ ] pgvector extension enabled (if using embeddings)
- [ ] Realtime enabled for required tables
- [ ] Backups configured (automatic on paid plans)

### Authentication

- [ ] OAuth providers configured with production credentials
- [ ] Email confirmation enabled
- [ ] Password policies configured
- [ ] Session expiry configured appropriately

### Monitoring

- [ ] Audit logging triggers active
- [ ] Error tracking configured (Sentry recommended)
- [ ] Database metrics monitored
- [ ] Edge function logs accessible

### Edge Functions

- [ ] All functions deployed
- [ ] Secrets configured
- [ ] Scheduled jobs set up (audit cleanup)
- [ ] Webhook endpoints tested

### Vercel

- [ ] Environment variables set for all environments
- [ ] Webhooks configured
- [ ] Preview deployments use preview database (or separate project)
- [ ] Production domain configured

## Troubleshooting

### Common Issues

#### "Permission denied" errors

- Verify RLS policies are correct
- Check that the user has the required role
- Ensure JWT contains `app_user_id` claim

#### Migrations fail

- Check for dependency order
- Ensure extensions are enabled first
- Verify enum types exist before using them

#### Webhooks not receiving events

- Check webhook URL is correct
- Verify webhook secret matches
- Check Edge Function logs in Supabase Dashboard

#### Vector search not working

- Ensure pgvector extension is enabled
- Verify embeddings are populated
- Check vector dimensions match (1536 for OpenAI ada-002)

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

## Quick Reference

### Useful Commands

```bash
# Supabase CLI
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase db reset       # Reset local database
supabase db push        # Push migrations to remote
supabase functions deploy [name]  # Deploy edge function
supabase secrets set KEY=value    # Set function secret

# Database connection
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Generate types (for TypeScript)
supabase gen types typescript --project-id [project-ref] > src/types/database.ts
```

### Key URLs

- Dashboard: `https://supabase.com/dashboard/project/[project-ref]`
- API: `https://[project-ref].supabase.co`
- Studio: `https://supabase.com/dashboard/project/[project-ref]/editor`
- Logs: `https://supabase.com/dashboard/project/[project-ref]/logs`
