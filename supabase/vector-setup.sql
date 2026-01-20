-- ProjectScaffolder - Vector Database Setup
-- Description: Enable pgvector extension and create embeddings infrastructure

-- ==============================================
-- Enable pgvector Extension
-- ==============================================

-- Note: pgvector must be enabled in the Supabase dashboard first
-- or via: CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Make vector available in public schema
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================
-- Project Embeddings Table
-- ==============================================

CREATE TABLE public.project_embeddings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Reference to the project
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Content that was embedded
  content_type TEXT NOT NULL, -- 'description', 'prompt', 'readme', 'code_summary'
  content_hash TEXT NOT NULL, -- Hash of content to detect changes

  -- The embedding vector (OpenAI ada-002 uses 1536 dimensions)
  -- Adjust dimension based on your embedding model:
  -- - OpenAI ada-002: 1536
  -- - OpenAI text-embedding-3-small: 1536
  -- - OpenAI text-embedding-3-large: 3072
  -- - Cohere embed-english-v3.0: 1024
  -- - Anthropic (if available): varies
  embedding vector(1536),

  -- Metadata for filtering
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure one embedding per content type per project
  UNIQUE(project_id, content_type)
);

COMMENT ON TABLE public.project_embeddings IS 'Vector embeddings for semantic search over projects';
COMMENT ON COLUMN public.project_embeddings.embedding IS 'OpenAI ada-002 compatible embedding (1536 dimensions)';
COMMENT ON COLUMN public.project_embeddings.content_hash IS 'SHA-256 hash to detect content changes';

-- Indexes for project_embeddings
CREATE INDEX idx_embeddings_project_id ON public.project_embeddings(project_id);
CREATE INDEX idx_embeddings_content_type ON public.project_embeddings(content_type);

-- HNSW index for fast approximate nearest neighbor search
-- This provides better performance than IVFFlat for most use cases
CREATE INDEX idx_embeddings_vector_hnsw ON public.project_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (use for very large datasets)
-- CREATE INDEX idx_embeddings_vector_ivf ON public.project_embeddings
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ==============================================
-- Tech Stack Embeddings Table
-- ==============================================

-- Pre-computed embeddings for technology names (for recommendation)
CREATE TABLE public.tech_stack_embeddings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Technology information
  tech_name TEXT UNIQUE NOT NULL, -- e.g., 'nextjs', 'react', 'prisma'
  category TEXT NOT NULL, -- 'framework', 'database', 'orm', 'styling', etc.
  description TEXT,

  -- Embedding
  embedding vector(1536),

  -- Metadata (popularity, compatibility, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.tech_stack_embeddings IS 'Pre-computed embeddings for technology stack recommendations';

-- Index for tech stack vectors
CREATE INDEX idx_tech_embeddings_vector ON public.tech_stack_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_tech_embeddings_category ON public.tech_stack_embeddings(category);

-- ==============================================
-- Similarity Search Functions
-- ==============================================

-- Search for similar projects by embedding
CREATE OR REPLACE FUNCTION public.search_similar_projects(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_owner_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  project_id TEXT,
  project_name TEXT,
  project_description TEXT,
  similarity FLOAT,
  tech_stack JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as project_id,
    p.name as project_name,
    p.description as project_description,
    1 - (pe.embedding <=> query_embedding) as similarity,
    p.tech_stack
  FROM public.project_embeddings pe
  JOIN public.projects p ON p.id = pe.project_id
  WHERE
    pe.content_type = 'description'
    AND pe.embedding IS NOT NULL
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
    AND p.deleted_at IS NULL
    AND (filter_owner_id IS NULL OR p.owner_id = filter_owner_id)
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search for similar technologies
CREATE OR REPLACE FUNCTION public.search_similar_technologies(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  tech_name TEXT,
  category TEXT,
  description TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tech_name,
    t.category,
    t.description,
    1 - (t.embedding <=> query_embedding) as similarity,
    t.metadata
  FROM public.tech_stack_embeddings t
  WHERE
    t.embedding IS NOT NULL
    AND (filter_category IS NULL OR t.category = filter_category)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Recommend technologies based on current tech stack
CREATE OR REPLACE FUNCTION public.recommend_technologies(
  current_tech_names TEXT[],
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  tech_name TEXT,
  category TEXT,
  description TEXT,
  avg_similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH current_tech AS (
    SELECT embedding
    FROM public.tech_stack_embeddings
    WHERE tech_name = ANY(current_tech_names)
  )
  SELECT
    t.tech_name,
    t.category,
    t.description,
    AVG(1 - (t.embedding <=> ct.embedding))::FLOAT as avg_similarity,
    t.metadata
  FROM public.tech_stack_embeddings t
  CROSS JOIN current_tech ct
  WHERE
    t.tech_name != ALL(current_tech_names)
    AND t.embedding IS NOT NULL
  GROUP BY t.tech_name, t.category, t.description, t.metadata
  ORDER BY avg_similarity DESC
  LIMIT match_count;
END;
$$;

-- ==============================================
-- Embedding Management Functions
-- ==============================================

-- Upsert project embedding
CREATE OR REPLACE FUNCTION public.upsert_project_embedding(
  p_project_id TEXT,
  p_content_type TEXT,
  p_content_hash TEXT,
  p_embedding vector(1536),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id TEXT;
BEGIN
  INSERT INTO public.project_embeddings (
    project_id,
    content_type,
    content_hash,
    embedding,
    metadata
  ) VALUES (
    p_project_id,
    p_content_type,
    p_content_hash,
    p_embedding,
    p_metadata
  )
  ON CONFLICT (project_id, content_type)
  DO UPDATE SET
    content_hash = EXCLUDED.content_hash,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

-- Check if embedding needs update (content changed)
CREATE OR REPLACE FUNCTION public.needs_embedding_update(
  p_project_id TEXT,
  p_content_type TEXT,
  p_content_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_hash TEXT;
BEGIN
  SELECT content_hash INTO existing_hash
  FROM public.project_embeddings
  WHERE project_id = p_project_id
  AND content_type = p_content_type;

  -- Return true if no existing embedding or hash differs
  RETURN existing_hash IS NULL OR existing_hash != p_content_hash;
END;
$$;

-- ==============================================
-- RLS Policies for Embeddings
-- ==============================================

ALTER TABLE public.project_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_stack_embeddings ENABLE ROW LEVEL SECURITY;

-- Project embeddings follow project access rules
CREATE POLICY embeddings_select ON public.project_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_embeddings.project_id
      AND (projects.owner_id = public.get_current_user_id() OR public.is_admin())
    )
  );

CREATE POLICY embeddings_insert ON public.project_embeddings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_id
      AND projects.owner_id = public.get_current_user_id()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY embeddings_update ON public.project_embeddings
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY embeddings_delete ON public.project_embeddings
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Tech stack embeddings are publicly readable
CREATE POLICY tech_embeddings_select ON public.tech_stack_embeddings
  FOR SELECT
  USING (true);

-- Only service role can modify tech embeddings
CREATE POLICY tech_embeddings_modify ON public.tech_stack_embeddings
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==============================================
-- Grant Permissions
-- ==============================================

GRANT SELECT ON public.project_embeddings TO authenticated;
GRANT INSERT ON public.project_embeddings TO authenticated;
GRANT ALL ON public.project_embeddings TO service_role;

GRANT SELECT ON public.tech_stack_embeddings TO authenticated, anon;
GRANT ALL ON public.tech_stack_embeddings TO service_role;

GRANT EXECUTE ON FUNCTION public.search_similar_projects TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_technologies TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.recommend_technologies TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.upsert_project_embedding TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.needs_embedding_update TO authenticated, service_role;
