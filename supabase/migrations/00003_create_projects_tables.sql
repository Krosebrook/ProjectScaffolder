-- ProjectScaffolder - Supabase Migration: Create Project Tables
-- Migration: 00003_create_projects_tables
-- Description: Create projects, deployments, and code generations tables

-- ==============================================
-- Projects Table
-- ==============================================
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status DEFAULT 'DRAFT' NOT NULL,

  -- Project configuration (stored as JSONB for flexibility)
  tech_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt TEXT,
  generated_files JSONB,

  -- External integrations
  github_repo TEXT,
  deployment_url TEXT,
  vercel_project_id TEXT,
  netlify_id TEXT,

  -- Environment variables (encrypted at application layer)
  env_variables JSONB,

  -- Versioning
  version INTEGER DEFAULT 1 NOT NULL,

  -- Relations
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_deployed_at TIMESTAMPTZ,

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.projects IS 'User projects for code generation';
COMMENT ON COLUMN public.projects.tech_stack IS 'Array of technology choices for the project';
COMMENT ON COLUMN public.projects.generated_files IS 'Generated file tree structure and content';
COMMENT ON COLUMN public.projects.env_variables IS 'Encrypted environment variables';

-- Indexes for projects
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at);
CREATE INDEX idx_projects_deleted_at ON public.projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_github_repo ON public.projects(github_repo) WHERE github_repo IS NOT NULL;

-- GIN index for JSONB tech_stack searches
CREATE INDEX idx_projects_tech_stack ON public.projects USING GIN(tech_stack);

-- ==============================================
-- Deployments Table
-- ==============================================
CREATE TABLE public.deployments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  status public.deployment_status DEFAULT 'PENDING' NOT NULL,
  provider TEXT NOT NULL, -- vercel, netlify, github-pages
  url TEXT,
  logs JSONB,

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.deployments IS 'Deployment history for projects';
COMMENT ON COLUMN public.deployments.provider IS 'Deployment platform (vercel, netlify, github-pages)';

-- Indexes for deployments
CREATE INDEX idx_deployments_project_id ON public.deployments(project_id);
CREATE INDEX idx_deployments_status ON public.deployments(status);
CREATE INDEX idx_deployments_provider ON public.deployments(provider);
CREATE INDEX idx_deployments_started_at ON public.deployments(started_at);

-- ==============================================
-- Code Generations Table
-- ==============================================
CREATE TABLE public.code_generations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  prompt TEXT NOT NULL,
  model TEXT NOT NULL, -- claude-3, gpt-4, gemini-pro
  output JSONB,

  -- Usage tracking
  token_usage JSONB, -- { input: number, output: number }
  duration_ms INTEGER,

  status public.generation_status DEFAULT 'PENDING' NOT NULL,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.code_generations IS 'Code generation requests and results';
COMMENT ON COLUMN public.code_generations.model IS 'AI model used (claude-3, gpt-4, gemini-pro)';
COMMENT ON COLUMN public.code_generations.token_usage IS 'Token usage breakdown {input, output}';

-- Indexes for code_generations
CREATE INDEX idx_code_generations_project_id ON public.code_generations(project_id);
CREATE INDEX idx_code_generations_status ON public.code_generations(status);
CREATE INDEX idx_code_generations_model ON public.code_generations(model);
CREATE INDEX idx_code_generations_created_at ON public.code_generations(created_at);
