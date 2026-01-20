-- ProjectScaffolder - Database Triggers
-- Description: Auto-update timestamps, audit logging, and soft delete handling

-- ==============================================
-- Updated At Timestamp Triggers
-- ==============================================

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to all relevant tables

-- Users
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Projects
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Project Embeddings
DROP TRIGGER IF EXISTS set_embeddings_updated_at ON public.project_embeddings;
CREATE TRIGGER set_embeddings_updated_at
  BEFORE UPDATE ON public.project_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- ==============================================
-- Audit Logging Triggers
-- ==============================================

-- Generic audit log function
CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
  user_id TEXT;
  severity public.audit_severity;
BEGIN
  -- Determine action type
  CASE TG_OP
    WHEN 'INSERT' THEN
      action_type := 'CREATE';
      old_data := NULL;
      new_data := to_jsonb(NEW);
      severity := 'INFO';
    WHEN 'UPDATE' THEN
      action_type := 'UPDATE';
      old_data := to_jsonb(OLD);
      new_data := to_jsonb(NEW);
      severity := 'INFO';
    WHEN 'DELETE' THEN
      action_type := 'DELETE';
      old_data := to_jsonb(OLD);
      new_data := NULL;
      severity := 'WARNING';
  END CASE;

  -- Get current user ID
  user_id := public.get_current_user_id();

  -- Skip audit for system operations if no user context
  IF user_id IS NULL AND current_setting('request.jwt.claims', true) IS NULL THEN
    -- Check if this is a service role operation
    IF current_setting('role', true) = 'service_role' THEN
      -- Log system operations with NULL user
      NULL;
    ELSE
      -- Return without logging for anonymous operations
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- Remove sensitive fields from audit data
  IF new_data IS NOT NULL THEN
    new_data := new_data - ARRAY['access_token', 'refresh_token', 'id_token', 'key_hash', 'env_variables'];
  END IF;
  IF old_data IS NOT NULL THEN
    old_data := old_data - ARRAY['access_token', 'refresh_token', 'id_token', 'key_hash', 'env_variables'];
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    old_value,
    new_value,
    severity,
    category,
    ip_address,
    request_id
  ) VALUES (
    user_id,
    action_type,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    old_data,
    new_data,
    severity,
    'data_access',
    NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::inet,
    current_setting('request.headers', true)::json->>'x-request-id'
  );

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Apply audit triggers to main tables

-- Users audit
DROP TRIGGER IF EXISTS audit_users ON public.users;
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();

-- Projects audit
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();

-- Deployments audit
DROP TRIGGER IF EXISTS audit_deployments ON public.deployments;
CREATE TRIGGER audit_deployments
  AFTER INSERT OR UPDATE OR DELETE ON public.deployments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();

-- Code generations audit
DROP TRIGGER IF EXISTS audit_code_generations ON public.code_generations;
CREATE TRIGGER audit_code_generations
  AFTER INSERT OR UPDATE OR DELETE ON public.code_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();

-- API Keys audit
DROP TRIGGER IF EXISTS audit_api_keys ON public.api_keys;
CREATE TRIGGER audit_api_keys
  AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_audit_log();

-- ==============================================
-- Soft Delete Handling
-- ==============================================

-- Function to handle soft deletes (set deleted_at instead of hard delete)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Instead of deleting, set deleted_at
  UPDATE public.users SET deleted_at = NOW() WHERE id = OLD.id;

  -- Also create audit log for soft delete
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    old_value,
    severity,
    category
  ) VALUES (
    public.get_current_user_id(),
    'SOFT_DELETE',
    TG_TABLE_NAME,
    OLD.id,
    to_jsonb(OLD) - ARRAY['access_token', 'refresh_token', 'id_token'],
    'WARNING',
    'data_access'
  );

  -- Return NULL to cancel the actual delete
  RETURN NULL;
END;
$$;

-- Apply soft delete to users table
-- Note: Uncomment to enable soft delete instead of hard delete
-- DROP TRIGGER IF EXISTS soft_delete_users ON public.users;
-- CREATE TRIGGER soft_delete_users
--   BEFORE DELETE ON public.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_soft_delete();

-- ==============================================
-- Project Status Transition Triggers
-- ==============================================

-- Validate project status transitions
CREATE OR REPLACE FUNCTION public.trigger_validate_project_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions JSONB;
BEGIN
  -- Define valid status transitions
  valid_transitions := '{
    "DRAFT": ["GENERATING", "FAILED"],
    "GENERATING": ["GENERATED", "FAILED"],
    "GENERATED": ["DEPLOYING", "DRAFT", "FAILED"],
    "DEPLOYING": ["DEPLOYED", "FAILED"],
    "DEPLOYED": ["DEPLOYING", "DRAFT"],
    "FAILED": ["DRAFT", "GENERATING", "DEPLOYING"]
  }'::jsonb;

  -- Allow same status (no change)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate transition
  IF NOT (valid_transitions->OLD.status::text) ? NEW.status::text THEN
    RAISE EXCEPTION 'Invalid project status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_project_status ON public.projects;
CREATE TRIGGER validate_project_status
  BEFORE UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_project_status();

-- ==============================================
-- Deployment Completion Trigger
-- ==============================================

-- Update project when deployment completes
CREATE OR REPLACE FUNCTION public.trigger_deployment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Update project on successful deployment
  IF NEW.status = 'SUCCESS' THEN
    UPDATE public.projects
    SET
      status = 'DEPLOYED',
      deployment_url = COALESCE(NEW.url, deployment_url),
      last_deployed_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;

  -- Update project on failed deployment
  IF NEW.status = 'FAILED' THEN
    UPDATE public.projects
    SET
      status = 'FAILED',
      updated_at = NOW()
    WHERE id = NEW.project_id
    AND status = 'DEPLOYING'; -- Only if currently deploying
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deployment_completed ON public.deployments;
CREATE TRIGGER deployment_completed
  AFTER UPDATE OF status ON public.deployments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_deployment_completed();

-- ==============================================
-- Code Generation Completion Trigger
-- ==============================================

-- Update project when code generation completes
CREATE OR REPLACE FUNCTION public.trigger_generation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Update project on successful generation
  IF NEW.status = 'COMPLETED' THEN
    UPDATE public.projects
    SET
      status = 'GENERATED',
      generated_files = COALESCE(NEW.output, generated_files),
      version = version + 1,
      updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;

  -- Update project on failed generation
  IF NEW.status = 'FAILED' THEN
    UPDATE public.projects
    SET
      status = 'FAILED',
      updated_at = NOW()
    WHERE id = NEW.project_id
    AND status = 'GENERATING'; -- Only if currently generating
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generation_completed ON public.code_generations;
CREATE TRIGGER generation_completed
  AFTER UPDATE OF status ON public.code_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generation_completed();

-- ==============================================
-- API Key Usage Tracking
-- ==============================================

-- Function to update API key usage (called from application)
CREATE OR REPLACE FUNCTION public.track_api_key_usage(p_key_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys
  SET
    last_used_at = NOW(),
    usage_count = usage_count + 1
  WHERE key_hash = p_key_hash
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_api_key_usage(TEXT) TO service_role;

-- ==============================================
-- Session Cleanup Trigger
-- ==============================================

-- Automatically delete expired sessions (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.sessions
  WHERE expires < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO service_role;

-- ==============================================
-- Consent Record Tracking
-- ==============================================

-- Log consent changes for audit trail
CREATE OR REPLACE FUNCTION public.trigger_consent_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    old_value,
    new_value,
    severity,
    category
  ) VALUES (
    NEW.user_id,
    CASE
      WHEN TG_OP = 'INSERT' AND NEW.granted THEN 'CONSENT_GRANTED'
      WHEN TG_OP = 'INSERT' AND NOT NEW.granted THEN 'CONSENT_DENIED'
      WHEN TG_OP = 'UPDATE' AND NEW.revoked_at IS NOT NULL THEN 'CONSENT_REVOKED'
      ELSE 'CONSENT_UPDATED'
    END,
    'ConsentRecord',
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    'INFO',
    'compliance'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_changed ON public.consent_records;
CREATE TRIGGER consent_changed
  AFTER INSERT OR UPDATE ON public.consent_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_consent_changed();

-- ==============================================
-- Realtime Subscriptions Setup
-- ==============================================

-- Enable realtime for specific tables
-- Note: Also configure in Supabase Dashboard > Database > Replication

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_generations;

-- Set replica identity for realtime updates
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.deployments REPLICA IDENTITY FULL;
ALTER TABLE public.code_generations REPLICA IDENTITY FULL;
