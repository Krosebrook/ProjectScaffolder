# Environment Configuration Guide

## Quick Start

Choose the appropriate template based on your setup:

### Option 1: Basic Setup (Recommended for Getting Started)
```bash
cp .env.example .env
```
Edit `.env` and fill in your values. This works for:
- Local development with PostgreSQL
- Simple deployments
- Getting started quickly

### Option 2: Supabase Development
```bash
cp .env.local.example .env.local
```
Use this if you're:
- Using Supabase as your backend
- Following the SUPABASE_SETUP.md guide
- Need Supabase-specific features (Auth, Realtime, Storage)

### Option 3: Production Deployment
```bash
# Don't create a local file - add these to your hosting platform
# For Vercel: Project Settings > Environment Variables
# For other platforms: Follow their environment variable setup
```
Use `.env.production.example` as a reference for:
- Production deployments
- Staging environments
- CI/CD pipelines

## Required Environment Variables

At minimum, you need:

1. **Database** (Required)
   ```bash
   DATABASE_URL="postgresql://..."
   ```

2. **NextAuth** (Required)
   ```bash
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   ```

3. **At least ONE AI Provider** (Required for code generation)
   ```bash
   ANTHROPIC_API_KEY="sk-ant-..."
   # OR
   OPENAI_API_KEY="sk-..."
   # OR
   GOOGLE_AI_API_KEY="..."
   ```

## Optional Features

### OAuth Authentication
Add these to enable GitHub/Google login:
```bash
GITHUB_ID="..."
GITHUB_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### GitHub Repository Creation
Add this to enable creating repositories:
```bash
GITHUB_TOKEN="ghp_..."
```

### Vercel Deployment
Add this to enable one-click deployments:
```bash
VERCEL_TOKEN="..."
```

## Security Best Practices

1. **Never commit actual .env files** to git (only .example files)
2. **Use different secrets** for development and production
3. **Generate strong secrets**: `openssl rand -base64 32`
4. **Rotate API keys** regularly in production
5. **Use environment-specific values** (don't reuse production keys in development)

## Troubleshooting

### "DATABASE_URL environment variable is not set"
- Ensure your `.env` file exists and contains `DATABASE_URL`
- Check the format: `postgresql://user:password@host:port/database`
- For Supabase, get it from Dashboard > Settings > Database

### "No AI provider configured"
- At least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY must be set
- Check that your API key is valid and not expired
- Verify there are no extra spaces or quotes around the key

### "NextAuth configuration error"
- Ensure NEXTAUTH_URL matches your application URL
- NEXTAUTH_SECRET must be at least 32 characters
- Generate a new secret: `openssl rand -base64 32`

### OAuth redirect URI mismatch
- Check that callback URLs match in your OAuth app settings
- For GitHub: `{NEXTAUTH_URL}/api/auth/callback/github`
- For Google: `{NEXTAUTH_URL}/api/auth/callback/google`

## File Precedence

Next.js loads environment variables in this order (later files override earlier):

1. `.env` - All environments
2. `.env.local` - Local overrides (ignored by git)
3. `.env.development` - Development only
4. `.env.production` - Production only

For most cases, just use `.env` or `.env.local`.

## Getting API Keys

### Anthropic Claude
1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Copy and add to `ANTHROPIC_API_KEY`

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and add to `OPENAI_API_KEY`

### Google AI
1. Go to https://makersuite.google.com/app/apikey
2. Create an API key
3. Copy and add to `GOOGLE_AI_API_KEY`

### GitHub Token
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`
4. Copy and add to `GITHUB_TOKEN`

### Vercel Token
1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy and add to `VERCEL_TOKEN`

## Need Help?

- Check the [README.md](README.md) for setup instructions
- For Supabase setup, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- Open an issue on GitHub if you're stuck
