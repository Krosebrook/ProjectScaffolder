-- ProjectScaffolder - Supabase Migration: Create Audit Tables
-- Migration: 00004_create_audit_tables
-- Description: Create audit logs table for compliance tracking

-- ==============================================
-- Audit Logs Table
-- ==============================================
CREATE TABLE public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Actor information
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,

  -- Action details
  action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, READ, LOGIN, etc.
  resource TEXT NOT NULL, -- User, Project, Deployment, etc.
  resource_id TEXT,

  -- Change tracking (stored as JSONB for flexibility)
  old_value JSONB,
  new_value JSONB,
  details JSONB,

  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  request_id TEXT, -- For request correlation

  -- Compliance fields
  severity public.audit_severity DEFAULT 'INFO' NOT NULL,
  category TEXT, -- authentication, data_access, system, etc.

  -- Timestamp (immutable)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for compliance';
COMMENT ON COLUMN public.audit_logs.action IS 'Action type (CREATE, UPDATE, DELETE, etc)';
COMMENT ON COLUMN public.audit_logs.resource IS 'Resource type affected';
COMMENT ON COLUMN public.audit_logs.request_id IS 'Correlation ID for request tracing';
COMMENT ON COLUMN public.audit_logs.severity IS 'Log severity level';
COMMENT ON COLUMN public.audit_logs.category IS 'Audit category (authentication, data_access, etc)';

-- Indexes for audit_logs (optimized for common query patterns)
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource);
CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX idx_audit_logs_request_id ON public.audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Composite index for time-based queries with filters
CREATE INDEX idx_audit_logs_created_user ON public.audit_logs(created_at DESC, user_id);
CREATE INDEX idx_audit_logs_created_resource ON public.audit_logs(created_at DESC, resource);

-- Partitioning hint: Consider partitioning by created_at for large deployments
-- See: https://supabase.com/docs/guides/database/partitions
