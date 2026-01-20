-- ProjectScaffolder - Supabase Migration: Create API Keys Table
-- Migration: 00005_create_api_keys_table
-- Description: Create API keys table for programmatic access

-- ==============================================
-- API Keys Table
-- ==============================================
CREATE TABLE public.api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL, -- SHA-256 hashed API key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification (ps_xxxxxxxx)

  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Permissions & scopes (array of strings)
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0 NOT NULL,

  -- Expiration
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters for key identification';
COMMENT ON COLUMN public.api_keys.scopes IS 'Array of permission scopes (read:projects, write:projects, etc)';

-- Indexes for api_keys
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_expires_at ON public.api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_revoked_at ON public.api_keys(revoked_at) WHERE revoked_at IS NULL;

-- Partial index for active (non-revoked, non-expired) keys
CREATE INDEX idx_api_keys_active ON public.api_keys(key_hash)
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- GIN index for scopes array searches
CREATE INDEX idx_api_keys_scopes ON public.api_keys USING GIN(scopes);
