-- ============================================================
-- NOO TV Migration v5 — Streaming API Integration
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Streaming sources table (NO api_key column — use STREAMING_API_KEY env var)
CREATE TABLE IF NOT EXISTS public.streaming_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  source_type TEXT DEFAULT 'generic' CHECK (source_type IN ('generic', '3isk', 'qrmzi', 'anaplayer', 'custom')),
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  avg_response_ms INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Content to streaming source mapping
CREATE TABLE IF NOT EXISTS public.content_streaming_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'episode')),
  source_id UUID REFERENCES public.streaming_sources(id) ON DELETE CASCADE,
  source_content_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_streaming_sources_active ON public.streaming_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_streaming_sources_priority ON public.streaming_sources(priority DESC);
CREATE INDEX IF NOT EXISTS idx_css_content ON public.content_streaming_sources(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_css_source ON public.content_streaming_sources(source_id);

-- 4. Unique constraint: one active mapping per content+source
CREATE UNIQUE INDEX IF NOT EXISTS idx_css_unique_content_source
  ON public.content_streaming_sources(content_id, content_type, source_id)
  WHERE is_active = TRUE;

-- 5. Streaming jobs tracking
CREATE TABLE IF NOT EXISTS public.streaming_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.streaming_sources(id) ON DELETE CASCADE,
  content_id UUID,
  content_type TEXT CHECK (content_type IN ('movie', 'episode')),
  job_type TEXT NOT NULL CHECK (job_type IN ('extract', 'refresh', 'health_check')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  result_url TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_streaming_jobs_status ON public.streaming_jobs(status);
CREATE INDEX IF NOT EXISTS idx_streaming_jobs_source ON public.streaming_jobs(source_id);

-- 6. RPC: claim next streaming job
CREATE OR REPLACE FUNCTION public.claim_next_streaming_job()
RETURNS TABLE (
  id UUID,
  source_id UUID,
  content_id UUID,
  content_type TEXT,
  job_type TEXT,
  attempts INTEGER,
  max_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE public.streaming_jobs sj
  SET status = 'processing', started_at = NOW(), attempts = attempts + 1
  FROM (
    SELECT sj2.id
    FROM public.streaming_jobs sj2
    WHERE sj2.status = 'pending' AND sj2.attempts < sj2.max_attempts
    ORDER BY sj2.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  ) locked
  WHERE sj.id = locked.id
  RETURNING sj.id, sj.source_id, sj.content_id, sj.content_type, sj.job_type, sj.attempts, sj.max_attempts;
END;
$$ LANGUAGE plpgsql;

-- 7. RPC: complete streaming job
CREATE OR REPLACE FUNCTION public.complete_streaming_job(
  p_job_id UUID,
  p_result_url TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.streaming_jobs
  SET status = 'completed', result_url = p_result_url, completed_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- 8. RPC: fail streaming job
CREATE OR REPLACE FUNCTION public.fail_streaming_job(
  p_job_id UUID,
  p_error TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.streaming_jobs
  SET status = 'failed', error_message = p_error, completed_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Drop api_key column if it exists from a previous migration
DO $$ BEGIN
  ALTER TABLE public.streaming_sources DROP COLUMN IF EXISTS api_key;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Done
SELECT '✅ Migration v5 complete! Streaming API integration tables created (no api_key column).' as message;
