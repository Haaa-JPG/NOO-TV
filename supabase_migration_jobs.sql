-- ============================================================
-- NOO TV Jobs Queue Migration
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Jobs table for extraction queue
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL DEFAULT 'extract' CHECK (job_type IN ('extract', 'refresh')),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  content_type TEXT CHECK (content_type IN ('episode', 'movie')),
  content_id UUID,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  priority INTEGER DEFAULT 5,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  result_url TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for queue performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_episode_id ON public.jobs(episode_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON public.jobs(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_next_retry ON public.jobs(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.jobs(created_at);

-- 3. Add stream_status column to episodes if not exists
DO $$ BEGIN
  ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS stream_status TEXT DEFAULT 'pending'
    CHECK (stream_status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'refresh_pending', 'refreshing'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Add expires_at column to episodes if not exists
DO $$ BEGIN
  ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add last_error column to episodes if not exists
DO $$ BEGIN
  ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS last_error TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Add stream_status + expires_at columns to movies if not exists
DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS stream_status TEXT DEFAULT 'pending'
    CHECK (stream_status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'refresh_pending', 'refreshing'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 7. Indexes for episodes stream_status
CREATE INDEX IF NOT EXISTS idx_episodes_stream_status ON public.episodes(stream_status);
CREATE INDEX IF NOT EXISTS idx_episodes_expires ON public.episodes(expires_at) WHERE expires_at IS NOT NULL;

-- 8. RLS for jobs (admin only)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage jobs" ON public.jobs
  FOR ALL USING (true);

CREATE POLICY "Admins can view jobs" ON public.jobs
  FOR SELECT USING (public.is_admin());

-- 9. Function: claim next pending job (atomic)
CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job public.jobs%ROWTYPE;
BEGIN
  UPDATE public.jobs
  SET status = 'processing',
      started_at = NOW(),
      updated_at = NOW(),
      attempts = attempts + 1
  WHERE id = (
    SELECT id FROM public.jobs
    WHERE status IN ('pending', 'retrying')
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_job;

  RETURN claimed_job;
END;
$$;

-- 10. Function: complete a job
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id UUID,
  p_result_url TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.jobs
  SET status = 'completed',
      result_url = p_result_url,
      finished_at = NOW(),
      updated_at = NOW()
  WHERE id = p_job_id;
$$;

-- 11. Function: fail a job
CREATE OR REPLACE FUNCTION public.fail_job(
  p_job_id UUID,
  p_error TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;

  IF v_job.attempts >= v_job.max_attempts THEN
    UPDATE public.jobs
    SET status = 'failed',
        last_error = p_error,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.jobs
    SET status = 'retrying',
        last_error = p_error,
        next_retry_at = NOW() + (v_job.attempts * 30 * INTERVAL '1 second'),
        updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$;

-- 12. Function: recover stale processing jobs (stuck > 5 minutes)
CREATE OR REPLACE FUNCTION public.recover_stale_jobs()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recovered AS (
    UPDATE public.jobs
    SET status = CASE
      WHEN attempts >= max_attempts THEN 'failed'
      ELSE 'retrying'
    END,
    last_error = CASE
      WHEN attempts >= max_attempts THEN 'Max attempts exceeded (stale recovery)'
      ELSE 'Stale processing reset'
    END,
    next_retry_at = CASE
      WHEN attempts >= max_attempts THEN NULL
      ELSE NOW() + INTERVAL '30 seconds'
    END,
    updated_at = NOW()
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*) FROM recovered;
$$;

-- 13. Update stream_status for all episodes based on current embed_url
UPDATE public.episodes
SET stream_status = CASE
  WHEN embed_url IS NULL OR embed_url = '' THEN 'pending'
  WHEN embed_url LIKE '%3isk%' OR embed_url LIKE '%qrmzi%' OR embed_url LIKE '%krmzi%' OR embed_url LIKE '%anaplayer%' THEN 'pending'
  WHEN embed_url LIKE '%.m3u8%' THEN 'completed'
  ELSE 'completed'
END,
last_error = NULL
WHERE stream_status IS NULL OR stream_status = '';

-- Done
SELECT '✅ Jobs queue migration complete!' as message;
