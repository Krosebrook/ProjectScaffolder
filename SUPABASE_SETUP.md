# Supabase Setup Guide for ProjectScaffolder

This guide covers the complete setup of Supabase as the backend database for ProjectScaffolder, including authentication, Row Level Security (RLS), vector search, and GDPR compliance.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Environment Variables](#environment-variables)
4. [Database Schema](#database-schema)
5. [Authentication Setup](#authentication-setup)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Vector Database (pgvector)](#vector-database-pgvector)
8. [Triggers and Functions](#triggers-and-functions)
9. [Edge Functions](#edge-functions)
10. [Webhooks](#webhooks)
11. [GDPR Compliance](#gdpr-compliance)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Supabase Account](https://supabase.com)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional for local development)
- Node.js 18+
- PostgreSQL knowledge (helpful)

```bash
# Install Supabase CLI (optional)
npm install -g supabase
```

---

## Project Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Configure:
   - **Name**: `projectscaffolder`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Plan**: Free tier works for development

### 2. Get Project Credentials

After creation, navigate to **Settings > API** to find:
- **Project URL**: `https://[project-ref].supabase.co`
- **Anon/Public Key**: For client-side access
- **Service Role Key**: For server-side access (keep secret!)

### 3. Initialize Local Development (Optional)

```bash
cd project-scaffolder

# Initialize Supabase
supabase init

# Link to your project
supabase link --project-ref [your-project-ref]

# Start local development
supabase start
```

---

## Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Database Direct Connection (for Prisma migrations)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# OAuth Providers (configure in Supabase Dashboard too)
GITHUB_CLIENT_ID=[github-oauth-client-id]
GITHUB_CLIENT_SECRET=[github-oauth-client-secret]
GOOGLE_CLIENT_ID=[google-oauth-client-id]
GOOGLE_CLIENT_SECRET=[google-oauth-client-secret]
```

---

## Database Schema

### Run Migrations

Execute migrations in order via Supabase SQL Editor or CLI:

```bash
# Via CLI
supabase db push

# Or run each migration file manually in SQL Editor
```

### Migration Files

| Order | File | Description |
|-------|------|-------------|
| 1 | `00001_create_enums.sql` | User roles, project status, deployment status enums |
| 2 | `00002_create_users_tables.sql` | Users, accounts, sessions tables |
| 3 | `00003_create_projects_tables.sql` | Projects, deployments, code generations |
| 4 | `00004_create_audit_tables.sql` | Audit logs with severity levels |
| 5 | `00005_create_api_keys_table.sql` | API keys with hashing |
| 6 | `00006_create_gdpr_tables.sql` | Consent records, data requests |

### Core Tables

```
public.users              - Application users (synced from auth.users)
public.accounts           - OAuth account links
public.sessions           - Active user sessions
public.projects           - User projects
public.deployments        - Deployment history
public.code_generations   - AI generation history
public.audit_logs         - Compliance audit trail
public.api_keys           - API key management
public.consent_records    - GDPR consent tracking
public.data_subject_requests - GDPR DSR handling
```

---

## Authentication Setup

### 1. Configure OAuth Providers

In Supabase Dashboard > **Authentication > Providers**:

#### GitHub OAuth
1. Create OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)
2. Set callback URL: `https://[project-ref].supabase.co/auth/v1/callback`
3. Enter Client ID and Secret in Supabase Dashboard

#### Google OAuth
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set authorized redirect URI: `https://[project-ref].supabase.co/auth/v1/callback`
3. Enter Client ID and Secret in Supabase Dashboard

### 2. Configure Email Templates

Upload custom email templates from `supabase/templates/`:
- `confirmation.html` - Email verification
- `recovery.html` - Password reset
- `magic_link.html` - Passwordless login
- `invite.html` - Team invitations
- `email_change.html` - Email change confirmation

### 3. Auth Settings

In **Authentication > Settings**:

| Setting | Value |
|---------|-------|
| Site URL | `https://your-domain.com` |
| Additional redirect URLs | `https://*.vercel.app/**` |
| JWT expiry | 3600 (1 hour) |
| Enable refresh token rotation | Yes |
| Secure email change | Yes |

### 4. Apply Auth Hooks

Run `supabase/auth-setup.sql` to set up:
- Auto-create app user on signup
- OAuth profile sync
- Custom JWT claims with user role
- Session management functions

---

## Row Level Security (RLS)

**CRITICAL**: RLS must be enabled on all tables to protect data.

### Apply RLS Policies

Run `supabase/rls-policies.sql` to configure:

```sql
-- Example: Users can only see their own data
CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (id = public.get_current_user_id() OR public.is_admin());

-- Example: Projects belong to their owner
CREATE POLICY projects_select ON public.projects
  FOR SELECT
  USING (owner_id = public.get_current_user_id() OR public.is_admin());
```

### Helper Functions

| Function | Purpose |
|----------|---------|
| `get_current_user_id()` | Get authenticated user's app ID |
| `is_admin()` | Check if user has ADMIN role |
| `is_enterprise_admin()` | Check if user has ENTERPRISE_ADMIN role |

### Test RLS Policies

```sql
-- Test as a specific user
SET request.jwt.claims = '{"app_user_id": "user-123", "user_role": "USER"}';

-- Should only return user's projects
SELECT * FROM projects;
```

---

## Vector Database (pgvector)

### 1. Enable Extension

In SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Apply Vector Setup

Run `supabase/vector-setup.sql` to create:

#### Tables
- `project_embeddings` - Embeddings for project search
- `tech_stack_embeddings` - Pre-computed technology vectors

#### Search Functions

```sql
-- Find similar projects
SELECT * FROM search_similar_projects(
  '[embedding-vector]'::vector(1536),
  0.7,  -- similarity threshold
  10    -- max results
);

-- Get technology recommendations
SELECT * FROM recommend_technologies(
  ARRAY['nextjs', 'typescript', 'tailwind'],
  5  -- number of recommendations
);
```

### 3. Embedding Dimensions

Configure based on your embedding model:

| Model | Dimensions |
|-------|------------|
| OpenAI ada-002 | 1536 |
| OpenAI text-embedding-3-small | 1536 |
| OpenAI text-embedding-3-large | 3072 |
| Cohere embed-english-v3.0 | 1024 |

### 4. Index Types

- **HNSW** (default): Best for most use cases, faster queries
- **IVFFlat**: Better for very large datasets (>1M vectors)

---

## Triggers and Functions

### Apply Triggers

Run `supabase/triggers.sql` to enable:

### Auto-Update Timestamps
```sql
-- Automatically updates updated_at on any change
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();
```

### Audit Logging
```sql
-- Logs all CRUD operations for compliance
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();
```

### Status Transitions
- Validates project status changes (e.g., DRAFT → GENERATING → GENERATED)
- Updates project status when deployment/generation completes

### Realtime Subscriptions
```sql
-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
```

---

## Edge Functions

### Deploy Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy webhook-handler
```

### Available Functions

#### `webhook-handler`
Handles incoming webhooks from:
- GitHub (push events, PR events)
- Vercel (deployment status)
- Stripe (payment events)

```typescript
// Invoke via HTTP
POST https://[project-ref].supabase.co/functions/v1/webhook-handler
Authorization: Bearer [anon-key]
Content-Type: application/json

{
  "source": "github",
  "payload": { ... }
}
```

#### `audit-cleanup`
Automated cleanup of old audit logs based on retention policy.

```bash
# Schedule via cron (in Supabase Dashboard)
# Run daily at 2 AM UTC
0 2 * * *
```

---

## Webhooks

### Configure Database Webhooks

In **Database > Webhooks**:

1. **Project Created**
   - Table: `projects`
   - Events: `INSERT`
   - URL: `https://your-app.vercel.app/api/webhooks/project-created`

2. **Deployment Status**
   - Table: `deployments`
   - Events: `UPDATE`
   - URL: `https://your-app.vercel.app/api/webhooks/deployment-status`

### Webhook Security

Always verify webhook signatures:

```typescript
import { createHmac } from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === `sha256=${expected}`;
}
```

---

## GDPR Compliance

### Data Subject Requests (DSR)

The system supports:
- **Access Request**: Export all user data
- **Deletion Request**: Right to be forgotten
- **Rectification Request**: Correct inaccurate data
- **Portability Request**: Export data in machine-readable format

### Consent Management

```sql
-- Record user consent
INSERT INTO consent_records (user_id, purpose, granted, ip_address)
VALUES ('user-123', 'analytics', true, '192.168.1.1');

-- Revoke consent
UPDATE consent_records
SET revoked_at = NOW()
WHERE user_id = 'user-123' AND purpose = 'marketing';
```

### Data Retention

Configure in `system_config`:

```sql
SELECT public.get_system_config('audit_retention');
-- Returns: {"DEBUG": 7, "INFO": 30, "WARNING": 90, "ERROR": 365, "CRITICAL": 730}
```

### Process DSR

```sql
-- Mark request as processing
UPDATE data_subject_requests
SET status = 'PROCESSING', processed_by = 'admin-user-id'
WHERE id = 'request-123';

-- Complete request
UPDATE data_subject_requests
SET status = 'COMPLETED', completed_at = NOW()
WHERE id = 'request-123';
```

---

## Deployment

### Production Checklist

- [ ] Enable RLS on ALL tables
- [ ] Configure OAuth providers with production URLs
- [ ] Set strong database password
- [ ] Enable Point-in-Time Recovery (PITR)
- [ ] Configure email provider (not Supabase default for production)
- [ ] Set up monitoring alerts
- [ ] Review and test all RLS policies
- [ ] Configure rate limiting
- [ ] Enable SSL enforcement

### Environment-Specific Settings

```env
# Production
NEXT_PUBLIC_SUPABASE_URL=https://[prod-project].supabase.co

# Staging
NEXT_PUBLIC_SUPABASE_URL=https://[staging-project].supabase.co
```

### Connect to Vercel

1. In Vercel Dashboard, go to your project > **Settings > Environment Variables**
2. Add all Supabase environment variables
3. Install Supabase Vercel Integration (optional, for auto-sync)

---

## Troubleshooting

### Common Issues

#### RLS Policy Blocking Access
```sql
-- Debug: Check current user context
SELECT
  auth.uid() as auth_uid,
  public.get_current_user_id() as app_user_id,
  public.is_admin() as is_admin;
```

#### Migration Errors
```bash
# Reset database (WARNING: destroys data)
supabase db reset

# Check migration status
supabase migration list
```

#### Authentication Issues
- Verify redirect URLs match exactly
- Check OAuth client IDs/secrets
- Ensure site URL is correct in Auth settings

#### Vector Search Not Working
```sql
-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check embedding dimensions match
SELECT vector_dims(embedding) FROM project_embeddings LIMIT 1;
```

### Useful SQL Commands

```sql
-- List all tables with RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check table policies
SELECT * FROM pg_policies WHERE tablename = 'projects';

-- View active sessions
SELECT * FROM public.get_user_sessions();

-- Check audit logs
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Local development configuration |
| `supabase/auth-setup.sql` | Authentication triggers and functions |
| `supabase/rls-policies.sql` | Row Level Security policies |
| `supabase/vector-setup.sql` | pgvector tables and search functions |
| `supabase/triggers.sql` | Database triggers for timestamps, auditing |
| `supabase/seed.sql` | Default system configuration and tech stack data |
| `supabase/migrations/*.sql` | Database schema migrations |
| `supabase/functions/` | Edge Functions |
| `supabase/templates/` | Email templates |
