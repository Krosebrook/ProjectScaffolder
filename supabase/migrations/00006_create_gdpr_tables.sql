-- ProjectScaffolder - Supabase Migration: Create GDPR Tables
-- Migration: 00006_create_gdpr_tables
-- Description: Create GDPR compliance tables for data subject requests and consent records

-- ==============================================
-- Data Subject Requests Table
-- ==============================================
CREATE TABLE public.data_subject_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Request details
  email TEXT NOT NULL,
  request_type public.dsr_type NOT NULL,
  status public.dsr_status DEFAULT 'PENDING' NOT NULL,

  -- Processing info
  processed_by TEXT, -- User ID who processed
  processed_at TIMESTAMPTZ,
  notes TEXT,

  -- Verification
  verification_token TEXT UNIQUE,
  verified_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.data_subject_requests IS 'GDPR data subject requests (access, deletion, etc)';
COMMENT ON COLUMN public.data_subject_requests.request_type IS 'Type of GDPR request';
COMMENT ON COLUMN public.data_subject_requests.verification_token IS 'Token for email verification';

-- Indexes for data_subject_requests
CREATE INDEX idx_dsr_email ON public.data_subject_requests(email);
CREATE INDEX idx_dsr_status ON public.data_subject_requests(status);
CREATE INDEX idx_dsr_request_type ON public.data_subject_requests(request_type);
CREATE INDEX idx_dsr_created_at ON public.data_subject_requests(created_at);
CREATE INDEX idx_dsr_verification_token ON public.data_subject_requests(verification_token) WHERE verification_token IS NOT NULL;

-- ==============================================
-- Consent Records Table
-- ==============================================
CREATE TABLE public.consent_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,

  -- Consent details
  purpose TEXT NOT NULL, -- marketing, analytics, essential, etc.
  granted BOOLEAN NOT NULL,
  method TEXT NOT NULL, -- checkbox, banner, api, etc.

  -- Tracking
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE public.consent_records IS 'User consent records for GDPR compliance';
COMMENT ON COLUMN public.consent_records.purpose IS 'Purpose of consent (marketing, analytics, etc)';
COMMENT ON COLUMN public.consent_records.method IS 'How consent was collected (checkbox, banner, etc)';

-- Indexes for consent_records
CREATE INDEX idx_consent_email ON public.consent_records(email);
CREATE INDEX idx_consent_user_id ON public.consent_records(user_id);
CREATE INDEX idx_consent_purpose ON public.consent_records(purpose);
CREATE INDEX idx_consent_created_at ON public.consent_records(created_at);
CREATE INDEX idx_consent_granted ON public.consent_records(granted);

-- Composite index for finding active consents
CREATE INDEX idx_consent_active ON public.consent_records(email, purpose)
  WHERE granted = true AND revoked_at IS NULL;
