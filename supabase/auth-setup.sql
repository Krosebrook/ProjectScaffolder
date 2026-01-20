-- ProjectScaffolder - Supabase Authentication Setup
-- Description: Configure Supabase Auth, OAuth providers, SSO/SAML, and password policies

-- ==============================================
-- Auth Schema Extensions
-- ==============================================

-- Add custom claims to auth.users
-- This allows storing app-specific data in the JWT

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id TEXT;
BEGIN
  -- Generate a new user ID for the application
  new_user_id := gen_random_uuid()::text;

  -- Create the application user record
  INSERT INTO public.users (
    id,
    email,
    name,
    image,
    email_verified,
    auth_user_id,
    role
  ) VALUES (
    new_user_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email_confirmed_at,
    NEW.id,
    'USER'
  );

  -- Update the auth user's app_metadata with the application user ID
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('app_user_id', new_user_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger to create app user when auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- OAuth Provider Sync
-- ==============================================

-- Sync OAuth account data when user signs in with OAuth
CREATE OR REPLACE FUNCTION public.handle_oauth_signin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id TEXT;
  provider_name TEXT;
BEGIN
  -- Get the application user ID
  SELECT raw_app_meta_data->>'app_user_id' INTO app_user_id
  FROM auth.users WHERE id = NEW.id;

  -- Skip if no app user found (should be created by handle_new_user)
  IF app_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the provider from the identity
  provider_name := NEW.raw_app_meta_data->>'provider';

  -- Update user profile with latest OAuth data if available
  UPDATE public.users SET
    name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', users.name),
    image = COALESCE(NEW.raw_user_meta_data->>'avatar_url', users.image),
    email_verified = COALESCE(NEW.email_confirmed_at, users.email_verified),
    updated_at = NOW()
  WHERE id = app_user_id;

  RETURN NEW;
END;
$$;

-- Trigger for OAuth sign-in updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_oauth_signin();

-- ==============================================
-- Email Verification Handling
-- ==============================================

-- Update email_verified when auth email is confirmed
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.users
    SET email_verified = NEW.email_confirmed_at, updated_at = NOW()
    WHERE auth_user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmation();

-- ==============================================
-- Custom JWT Claims Hook
-- ==============================================

-- Add custom claims to the JWT token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_data record;
BEGIN
  -- Fetch user data from our users table
  SELECT id, role INTO user_data
  FROM public.users
  WHERE auth_user_id = (event->>'user_id')::uuid;

  -- Build custom claims
  claims := event->'claims';

  IF user_data.id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_user_id}', to_jsonb(user_data.id));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_data.role::text));
  END IF;

  -- Return the modified claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public and anon
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ==============================================
-- SSO/SAML Configuration Templates
-- ==============================================

-- Function to configure SAML provider (call via service role)
-- Note: Actual SAML configuration is done via Supabase Dashboard or API
CREATE OR REPLACE FUNCTION public.configure_saml_provider(
  provider_id TEXT,
  metadata_url TEXT,
  attribute_mapping JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This is a placeholder function
  -- SAML providers must be configured via:
  -- 1. Supabase Dashboard (Settings > Auth > SSO Providers)
  -- 2. Supabase Management API
  --
  -- Example attribute mapping:
  -- {
  --   "keys": {
  --     "email": {
  --       "name": "email",
  --       "default": null
  --     },
  --     "name": {
  --       "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  --       "default": null
  --     }
  --   }
  -- }

  RETURN jsonb_build_object(
    'status', 'info',
    'message', 'SAML must be configured via Supabase Dashboard or Management API',
    'provider_id', provider_id,
    'metadata_url', metadata_url
  );
END;
$$;

-- ==============================================
-- Password Policy Enforcement
-- ==============================================

-- Password strength validation function
CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Minimum 8 characters
  IF length(password) < 8 THEN
    RETURN FALSE;
  END IF;

  -- At least one uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN FALSE;
  END IF;

  -- At least one lowercase letter
  IF password !~ '[a-z]' THEN
    RETURN FALSE;
  END IF;

  -- At least one digit
  IF password !~ '[0-9]' THEN
    RETURN FALSE;
  END IF;

  -- At least one special character
  IF password !~ '[!@#$%^&*()_+\-=\[\]{};'':"\\|,.<>\/?]' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Note: Supabase Auth has built-in password requirements
-- Configure additional requirements in config.toml or Dashboard:
-- - Minimum password length: 8 (default)
-- - Maximum password length: 72 (bcrypt limit)

-- ==============================================
-- Auth Helper Functions
-- ==============================================

-- Get authenticated user's email
CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Check if user email is verified
CREATE OR REPLACE FUNCTION public.auth_email_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = auth.uid();
$$;

-- Get user's OAuth providers
CREATE OR REPLACE FUNCTION public.get_user_providers(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(provider TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    identity_data->>'provider' as provider,
    identities.created_at
  FROM auth.identities
  WHERE user_id = user_uuid;
$$;

-- ==============================================
-- Account Linking Functions
-- ==============================================

-- Check if an identity can be linked
CREATE OR REPLACE FUNCTION public.can_link_identity(provider_name TEXT, provider_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_user_id UUID;
BEGIN
  -- Check if this provider identity already exists
  SELECT user_id INTO existing_user_id
  FROM auth.identities
  WHERE provider = provider_name
  AND identity_data->>'sub' = provider_id;

  -- If no existing link, can link
  IF existing_user_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- If linked to current user, already linked
  IF existing_user_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Linked to different user
  RETURN FALSE;
END;
$$;

-- ==============================================
-- Session Management
-- ==============================================

-- Get all active sessions for current user
CREATE OR REPLACE FUNCTION public.get_user_sessions()
RETURNS TABLE(
  session_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as session_id,
    s.created_at,
    s.updated_at,
    s.user_agent,
    s.ip::text
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
  ORDER BY s.updated_at DESC;
END;
$$;

-- ==============================================
-- Grant Permissions
-- ==============================================

GRANT EXECUTE ON FUNCTION public.validate_password_strength(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_verified() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_providers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_link_identity(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_sessions() TO authenticated;
