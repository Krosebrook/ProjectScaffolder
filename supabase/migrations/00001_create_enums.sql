-- ProjectScaffolder - Supabase Migration: Create Enums
-- Migration: 00001_create_enums
-- Description: Create all enum types used throughout the application

-- ==============================================
-- User Role Enum
-- ==============================================
CREATE TYPE public.user_role AS ENUM (
  'USER',
  'ADMIN',
  'ENTERPRISE_ADMIN'
);

COMMENT ON TYPE public.user_role IS 'User role levels for access control';

-- ==============================================
-- Project Status Enum
-- ==============================================
CREATE TYPE public.project_status AS ENUM (
  'DRAFT',
  'GENERATING',
  'GENERATED',
  'DEPLOYING',
  'DEPLOYED',
  'FAILED'
);

COMMENT ON TYPE public.project_status IS 'Project lifecycle status';

-- ==============================================
-- Deployment Status Enum
-- ==============================================
CREATE TYPE public.deployment_status AS ENUM (
  'PENDING',
  'BUILDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED'
);

COMMENT ON TYPE public.deployment_status IS 'Deployment process status';

-- ==============================================
-- Generation Status Enum
-- ==============================================
CREATE TYPE public.generation_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

COMMENT ON TYPE public.generation_status IS 'Code generation process status';

-- ==============================================
-- Audit Severity Enum
-- ==============================================
CREATE TYPE public.audit_severity AS ENUM (
  'DEBUG',
  'INFO',
  'WARNING',
  'ERROR',
  'CRITICAL'
);

COMMENT ON TYPE public.audit_severity IS 'Audit log severity levels';

-- ==============================================
-- Data Subject Request Type Enum
-- ==============================================
CREATE TYPE public.dsr_type AS ENUM (
  'ACCESS',
  'DELETION',
  'RECTIFICATION',
  'PORTABILITY',
  'OBJECTION'
);

COMMENT ON TYPE public.dsr_type IS 'GDPR data subject request types';

-- ==============================================
-- Data Subject Request Status Enum
-- ==============================================
CREATE TYPE public.dsr_status AS ENUM (
  'PENDING',
  'VERIFIED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED'
);

COMMENT ON TYPE public.dsr_status IS 'Data subject request processing status';
