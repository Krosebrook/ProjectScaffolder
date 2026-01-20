-- ProjectScaffolder - Supabase Migration: Create User Tables
-- Migration: 00002_create_users_tables
-- Description: Create users, accounts, sessions, and verification tokens tables

-- ==============================================
-- Users Table
-- ==============================================
CREATE TABLE public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  email_verified TIMESTAMPTZ,
  role public.user_role DEFAULT 'USER' NOT NULL,

  -- Supabase Auth integration
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Soft delete support
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.users IS 'Application users with profile information';
COMMENT ON COLUMN public.users.auth_user_id IS 'Reference to Supabase Auth user';
COMMENT ON COLUMN public.users.role IS 'User permission level';

-- Indexes for users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;

-- ==============================================
-- Accounts Table (OAuth Providers)
-- ==============================================
CREATE TABLE public.accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,

  UNIQUE(provider, provider_account_id)
);

COMMENT ON TABLE public.accounts IS 'OAuth provider account connections';
COMMENT ON COLUMN public.accounts.provider IS 'OAuth provider name (github, google, etc)';

-- Indexes for accounts
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_provider ON public.accounts(provider);

-- ==============================================
-- Sessions Table
-- ==============================================
CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.sessions IS 'Active user sessions for NextAuth';

-- Indexes for sessions
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_expires ON public.sessions(expires);

-- ==============================================
-- Verification Tokens Table
-- ==============================================
CREATE TABLE public.verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,

  PRIMARY KEY (identifier, token)
);

COMMENT ON TABLE public.verification_tokens IS 'Email verification and magic link tokens';

-- Index for cleanup
CREATE INDEX idx_verification_tokens_expires ON public.verification_tokens(expires);
