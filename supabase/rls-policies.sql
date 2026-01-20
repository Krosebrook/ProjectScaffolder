-- ProjectScaffolder - Supabase Row Level Security Policies
-- Description: Comprehensive RLS policies for multi-tenant data isolation

-- ==============================================
-- Enable RLS on all tables
-- ==============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Helper Functions
-- ==============================================

-- Get current user's application ID from auth metadata
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_id TEXT;
BEGIN
  -- First try to get from JWT claim
  user_id := current_setting('request.jwt.claims', true)::json->>'app_user_id';

  IF user_id IS NULL THEN
    -- Fall back to looking up by auth.uid()
    SELECT u.id INTO user_id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid();
  END IF;

  RETURN user_id;
END;
$$;

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = public.get_current_user_id();

  RETURN user_role IN ('ADMIN', 'ENTERPRISE_ADMIN');
END;
$$;

-- Check if current user is an enterprise admin
CREATE OR REPLACE FUNCTION public.is_enterprise_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = public.get_current_user_id();

  RETURN user_role = 'ENTERPRISE_ADMIN';
END;
$$;

-- ==============================================
-- Users Table Policies
-- ==============================================

-- Users can view their own profile
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (
    id = public.get_current_user_id()
    OR public.is_admin()
  );

-- Users can update their own profile (not role)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = public.get_current_user_id())
  WITH CHECK (
    id = public.get_current_user_id()
    -- Prevent users from changing their own role
    AND role = (SELECT role FROM public.users WHERE id = public.get_current_user_id())
  );

-- Only admins can insert users (or system via service role)
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Only enterprise admins can delete users
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE
  USING (public.is_enterprise_admin());

-- ==============================================
-- Accounts Table Policies
-- ==============================================

-- Users can view their own OAuth accounts
CREATE POLICY accounts_select_own ON public.accounts
  FOR SELECT
  USING (user_id = public.get_current_user_id());

-- Users can manage their own OAuth accounts
CREATE POLICY accounts_insert_own ON public.accounts
  FOR INSERT
  WITH CHECK (user_id = public.get_current_user_id() OR auth.role() = 'service_role');

CREATE POLICY accounts_update_own ON public.accounts
  FOR UPDATE
  USING (user_id = public.get_current_user_id());

CREATE POLICY accounts_delete_own ON public.accounts
  FOR DELETE
  USING (user_id = public.get_current_user_id());

-- ==============================================
-- Sessions Table Policies
-- ==============================================

-- Users can view their own sessions
CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT
  USING (user_id = public.get_current_user_id());

-- System can manage sessions
CREATE POLICY sessions_manage_system ON public.sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==============================================
-- Verification Tokens Policies
-- ==============================================

-- Only service role can manage verification tokens
CREATE POLICY verification_tokens_system ON public.verification_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==============================================
-- Projects Table Policies
-- ==============================================

-- Project owners can view their own projects
CREATE POLICY projects_select_own ON public.projects
  FOR SELECT
  USING (
    owner_id = public.get_current_user_id()
    OR public.is_admin()
  );

-- Users can create projects for themselves
CREATE POLICY projects_insert_own ON public.projects
  FOR INSERT
  WITH CHECK (owner_id = public.get_current_user_id());

-- Project owners can update their projects
CREATE POLICY projects_update_own ON public.projects
  FOR UPDATE
  USING (owner_id = public.get_current_user_id())
  WITH CHECK (owner_id = public.get_current_user_id());

-- Project owners can delete their projects
CREATE POLICY projects_delete_own ON public.projects
  FOR DELETE
  USING (
    owner_id = public.get_current_user_id()
    OR public.is_enterprise_admin()
  );

-- ==============================================
-- Deployments Table Policies
-- ==============================================

-- Users can view deployments for their projects
CREATE POLICY deployments_select_own ON public.deployments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = deployments.project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR public.is_admin()
  );

-- Users can create deployments for their projects
CREATE POLICY deployments_insert_own ON public.deployments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR auth.role() = 'service_role'
  );

-- Users can update deployments for their projects
CREATE POLICY deployments_update_own ON public.deployments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = deployments.project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR auth.role() = 'service_role'
  );

-- ==============================================
-- Code Generations Table Policies
-- ==============================================

-- Users can view generations for their projects
CREATE POLICY generations_select_own ON public.code_generations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = code_generations.project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR public.is_admin()
  );

-- Users can create generations for their projects
CREATE POLICY generations_insert_own ON public.code_generations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR auth.role() = 'service_role'
  );

-- Service role can update generation status
CREATE POLICY generations_update_system ON public.code_generations
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ==============================================
-- Audit Logs Policies (Read-Only)
-- ==============================================

-- Users can view their own audit logs
-- Admins can view all audit logs
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT
  USING (
    user_id = public.get_current_user_id()
    OR public.is_admin()
  );

-- Only service role can insert audit logs (prevents tampering)
CREATE POLICY audit_logs_insert_system ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- No update policy - audit logs are immutable
-- No delete policy - audit logs cannot be deleted

-- ==============================================
-- API Keys Policies (Owner-Only)
-- ==============================================

-- Users can only view their own API keys
CREATE POLICY api_keys_select_own ON public.api_keys
  FOR SELECT
  USING (user_id = public.get_current_user_id());

-- Users can create API keys for themselves
CREATE POLICY api_keys_insert_own ON public.api_keys
  FOR INSERT
  WITH CHECK (user_id = public.get_current_user_id());

-- Users can update (revoke) their own API keys
CREATE POLICY api_keys_update_own ON public.api_keys
  FOR UPDATE
  USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- Users can delete their own API keys
CREATE POLICY api_keys_delete_own ON public.api_keys
  FOR DELETE
  USING (user_id = public.get_current_user_id());

-- ==============================================
-- Data Subject Requests Policies
-- ==============================================

-- Users can view DSRs for their email
-- Admins can view all DSRs
CREATE POLICY dsr_select ON public.data_subject_requests
  FOR SELECT
  USING (
    email = (SELECT email FROM public.users WHERE id = public.get_current_user_id())
    OR public.is_admin()
  );

-- Anyone can create a DSR (for GDPR compliance)
CREATE POLICY dsr_insert ON public.data_subject_requests
  FOR INSERT
  WITH CHECK (true);

-- Only admins/service role can update DSRs
CREATE POLICY dsr_update_admin ON public.data_subject_requests
  FOR UPDATE
  USING (public.is_admin() OR auth.role() = 'service_role');

-- ==============================================
-- Consent Records Policies
-- ==============================================

-- Users can view their own consent records
CREATE POLICY consent_select_own ON public.consent_records
  FOR SELECT
  USING (
    user_id = public.get_current_user_id()
    OR email = (SELECT email FROM public.users WHERE id = public.get_current_user_id())
    OR public.is_admin()
  );

-- Anyone can create consent records
CREATE POLICY consent_insert ON public.consent_records
  FOR INSERT
  WITH CHECK (true);

-- Users can update (revoke) their own consent
CREATE POLICY consent_update_own ON public.consent_records
  FOR UPDATE
  USING (
    user_id = public.get_current_user_id()
    OR email = (SELECT email FROM public.users WHERE id = public.get_current_user_id())
  );

-- ==============================================
-- Grant necessary permissions
-- ==============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enterprise_admin() TO authenticated;

-- Grant table permissions (RLS handles row-level access)
GRANT SELECT ON public.users TO authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT DELETE ON public.users TO authenticated;

GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.verification_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deployments TO authenticated;
GRANT SELECT, INSERT ON public.code_generations TO authenticated;
GRANT UPDATE ON public.code_generations TO service_role;

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;

GRANT ALL ON public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT UPDATE ON public.data_subject_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.consent_records TO authenticated;
