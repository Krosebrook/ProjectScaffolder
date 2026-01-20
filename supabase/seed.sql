-- ProjectScaffolder - Seed Data
-- Description: Default roles, system configuration, and tech stack embeddings

-- ==============================================
-- System Configuration Table
-- ==============================================

CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.system_config IS 'System-wide configuration settings';

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/modify system config
CREATE POLICY system_config_select ON public.system_config
  FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY system_config_modify ON public.system_config
  FOR ALL
  USING (public.is_enterprise_admin() OR auth.role() = 'service_role');

-- ==============================================
-- Default System Configuration
-- ==============================================

INSERT INTO public.system_config (key, value, description) VALUES
-- AI Provider Configuration
('ai_providers', '{
  "anthropic": {
    "enabled": true,
    "default_model": "claude-3-5-sonnet-20241022",
    "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"]
  },
  "openai": {
    "enabled": true,
    "default_model": "gpt-4o",
    "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
  },
  "google": {
    "enabled": true,
    "default_model": "gemini-1.5-pro",
    "models": ["gemini-1.5-pro", "gemini-1.5-flash"]
  }
}'::jsonb, 'AI provider configuration'),

-- Rate Limits
('rate_limits', '{
  "generations_per_day": {
    "USER": 10,
    "ADMIN": 100,
    "ENTERPRISE_ADMIN": 1000
  },
  "deployments_per_day": {
    "USER": 5,
    "ADMIN": 50,
    "ENTERPRISE_ADMIN": 500
  },
  "api_requests_per_minute": {
    "USER": 60,
    "ADMIN": 300,
    "ENTERPRISE_ADMIN": 1000
  }
}'::jsonb, 'Rate limits by role'),

-- Feature Flags
('feature_flags', '{
  "enable_github_integration": true,
  "enable_vercel_deployment": true,
  "enable_netlify_deployment": true,
  "enable_vector_search": true,
  "enable_ai_recommendations": true,
  "enable_team_projects": false,
  "enable_billing": false,
  "maintenance_mode": false
}'::jsonb, 'Feature flags'),

-- Default Project Settings
('default_project_settings', '{
  "default_tech_stack": ["nextjs", "typescript", "tailwindcss"],
  "max_files_per_project": 500,
  "max_file_size_kb": 1024,
  "allowed_frameworks": ["nextjs", "react", "vue", "svelte", "express", "fastapi", "django"],
  "allowed_databases": ["postgresql", "mysql", "mongodb", "sqlite"],
  "allowed_orms": ["prisma", "drizzle", "typeorm", "mongoose"]
}'::jsonb, 'Default project configuration'),

-- Audit Log Retention
('audit_retention', '{
  "DEBUG": 7,
  "INFO": 30,
  "WARNING": 90,
  "ERROR": 365,
  "CRITICAL": 730
}'::jsonb, 'Audit log retention in days by severity'),

-- GDPR Settings
('gdpr_settings', '{
  "data_retention_days": 730,
  "dsr_processing_deadline_days": 30,
  "consent_purposes": ["essential", "analytics", "marketing", "personalization"],
  "default_consent": {
    "essential": true,
    "analytics": false,
    "marketing": false,
    "personalization": false
  }
}'::jsonb, 'GDPR compliance settings')

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ==============================================
-- Tech Stack Seed Data (for recommendations)
-- ==============================================

INSERT INTO public.tech_stack_embeddings (tech_name, category, description, metadata) VALUES
-- Frameworks
('nextjs', 'framework', 'React framework for production with hybrid static & server rendering', '{"popularity": 95, "use_cases": ["fullstack", "ssr", "ssg", "api"]}'),
('react', 'framework', 'JavaScript library for building user interfaces', '{"popularity": 98, "use_cases": ["spa", "frontend", "mobile"]}'),
('vue', 'framework', 'Progressive JavaScript framework for building UIs', '{"popularity": 85, "use_cases": ["spa", "frontend"]}'),
('svelte', 'framework', 'Cybernetically enhanced web apps with compile-time framework', '{"popularity": 70, "use_cases": ["spa", "frontend"]}'),
('angular', 'framework', 'Platform for building web applications', '{"popularity": 75, "use_cases": ["enterprise", "spa"]}'),
('express', 'framework', 'Fast, unopinionated, minimalist web framework for Node.js', '{"popularity": 90, "use_cases": ["api", "backend"]}'),
('fastapi', 'framework', 'Modern, fast Python web framework for building APIs', '{"popularity": 80, "use_cases": ["api", "backend", "ml"]}'),
('django', 'framework', 'High-level Python web framework', '{"popularity": 82, "use_cases": ["fullstack", "backend"]}'),
('nestjs', 'framework', 'Progressive Node.js framework for enterprise applications', '{"popularity": 75, "use_cases": ["api", "backend", "enterprise"]}'),

-- Languages
('typescript', 'language', 'Typed superset of JavaScript', '{"popularity": 92, "use_cases": ["frontend", "backend", "fullstack"]}'),
('javascript', 'language', 'Dynamic programming language for web development', '{"popularity": 95, "use_cases": ["frontend", "backend"]}'),
('python', 'language', 'General-purpose programming language', '{"popularity": 93, "use_cases": ["backend", "ml", "scripting"]}'),
('go', 'language', 'Statically typed, compiled language by Google', '{"popularity": 70, "use_cases": ["backend", "microservices"]}'),
('rust', 'language', 'Systems programming language focused on safety', '{"popularity": 65, "use_cases": ["systems", "wasm", "backend"]}'),

-- Databases
('postgresql', 'database', 'Advanced open source relational database', '{"popularity": 90, "use_cases": ["relational", "json", "geospatial"]}'),
('mysql', 'database', 'Popular open source relational database', '{"popularity": 85, "use_cases": ["relational", "web"]}'),
('mongodb', 'database', 'Document-oriented NoSQL database', '{"popularity": 80, "use_cases": ["nosql", "documents", "realtime"]}'),
('redis', 'database', 'In-memory data structure store', '{"popularity": 85, "use_cases": ["cache", "sessions", "realtime"]}'),
('sqlite', 'database', 'Lightweight embedded relational database', '{"popularity": 75, "use_cases": ["embedded", "local", "prototyping"]}'),

-- ORMs
('prisma', 'orm', 'Next-generation ORM for Node.js and TypeScript', '{"popularity": 85, "use_cases": ["typescript", "nodejs"]}'),
('drizzle', 'orm', 'TypeScript ORM with SQL-like syntax', '{"popularity": 70, "use_cases": ["typescript", "nodejs"]}'),
('typeorm', 'orm', 'ORM for TypeScript and JavaScript', '{"popularity": 75, "use_cases": ["typescript", "nodejs"]}'),
('sqlalchemy', 'orm', 'Python SQL toolkit and ORM', '{"popularity": 85, "use_cases": ["python"]}'),
('mongoose', 'orm', 'MongoDB object modeling for Node.js', '{"popularity": 80, "use_cases": ["mongodb", "nodejs"]}'),

-- Styling
('tailwindcss', 'styling', 'Utility-first CSS framework', '{"popularity": 90, "use_cases": ["css", "utility"]}'),
('shadcn-ui', 'styling', 'Re-usable components built with Radix and Tailwind', '{"popularity": 80, "use_cases": ["components", "react"]}'),
('chakra-ui', 'styling', 'Simple, modular React component library', '{"popularity": 75, "use_cases": ["components", "react"]}'),
('material-ui', 'styling', 'React components implementing Material Design', '{"popularity": 80, "use_cases": ["components", "react"]}'),
('styled-components', 'styling', 'CSS-in-JS library for React', '{"popularity": 70, "use_cases": ["css-in-js", "react"]}'),

-- Authentication
('nextauth', 'auth', 'Authentication for Next.js applications', '{"popularity": 85, "use_cases": ["nextjs", "oauth"]}'),
('clerk', 'auth', 'Complete user management and authentication', '{"popularity": 75, "use_cases": ["saas", "fullstack"]}'),
('auth0', 'auth', 'Identity platform for authentication', '{"popularity": 80, "use_cases": ["enterprise", "oauth"]}'),
('supabase-auth', 'auth', 'Open source Firebase alternative authentication', '{"popularity": 75, "use_cases": ["supabase", "oauth"]}'),

-- Deployment
('vercel', 'deployment', 'Platform for frontend frameworks and static sites', '{"popularity": 90, "use_cases": ["nextjs", "frontend", "serverless"]}'),
('netlify', 'deployment', 'Platform for modern web projects', '{"popularity": 80, "use_cases": ["frontend", "jamstack"]}'),
('railway', 'deployment', 'Infrastructure platform for developers', '{"popularity": 70, "use_cases": ["backend", "databases"]}'),
('docker', 'deployment', 'Container platform for applications', '{"popularity": 90, "use_cases": ["containers", "devops"]}'),

-- Testing
('jest', 'testing', 'JavaScript testing framework', '{"popularity": 85, "use_cases": ["unit", "javascript"]}'),
('vitest', 'testing', 'Vite-native unit test framework', '{"popularity": 75, "use_cases": ["unit", "vite"]}'),
('playwright', 'testing', 'End-to-end testing for modern web apps', '{"popularity": 80, "use_cases": ["e2e", "browser"]}'),
('cypress', 'testing', 'JavaScript end-to-end testing framework', '{"popularity": 80, "use_cases": ["e2e", "browser"]}')

ON CONFLICT (tech_name) DO UPDATE SET
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- ==============================================
-- Default Consent Purposes
-- ==============================================

-- Insert default consent purposes for GDPR compliance
-- These will be used when users first sign up

-- Note: Actual consent records are created per-user when they interact with the app

-- ==============================================
-- Storage Buckets
-- ==============================================

-- Create storage buckets for project files
-- Note: Run this via Supabase Dashboard or API

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
-- ('project-files', 'project-files', false, 52428800, ARRAY['text/plain', 'application/json', 'text/javascript', 'text/typescript', 'text/css', 'text/html']),
-- ('backups', 'backups', false, 104857600, ARRAY['application/json', 'application/gzip'])
-- ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- Helper Function for System Config
-- ==============================================

-- Get system config value
CREATE OR REPLACE FUNCTION public.get_system_config(config_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  config_value JSONB;
BEGIN
  SELECT value INTO config_value
  FROM public.system_config
  WHERE key = config_key;

  RETURN config_value;
END;
$$;

-- Set system config value (admin only)
CREATE OR REPLACE FUNCTION public.set_system_config(config_key TEXT, config_value JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_enterprise_admin() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only enterprise admins can modify system configuration';
  END IF;

  INSERT INTO public.system_config (key, value, updated_at)
  VALUES (config_key, config_value, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
END;
$$;

-- Check feature flag
CREATE OR REPLACE FUNCTION public.is_feature_enabled(feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  flags JSONB;
BEGIN
  flags := public.get_system_config('feature_flags');
  RETURN COALESCE((flags->>feature_name)::boolean, false);
END;
$$;

-- Get rate limit for current user
CREATE OR REPLACE FUNCTION public.get_rate_limit(limit_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  limits JSONB;
  user_role TEXT;
BEGIN
  limits := public.get_system_config('rate_limits');
  SELECT role::text INTO user_role FROM public.users WHERE id = public.get_current_user_id();

  IF user_role IS NULL THEN
    user_role := 'USER';
  END IF;

  RETURN COALESCE((limits->limit_type->>user_role)::integer, 0);
END;
$$;

-- Grant permissions
GRANT SELECT ON public.system_config TO authenticated;
GRANT ALL ON public.system_config TO service_role;

GRANT EXECUTE ON FUNCTION public.get_system_config(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_system_config(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_rate_limit(TEXT) TO authenticated;
