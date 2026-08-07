-- ============================================================
-- NOO TV Migration v2 — Fixes
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Unique constraint: prevent duplicate active jobs per episode
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_active_episode
  ON public.jobs (episode_id)
  WHERE status IN ('pending', 'processing', 'retrying');

-- 2. Worker heartbeat table
CREATE TABLE IF NOT EXISTS public.worker_heartbeat (
  id TEXT PRIMARY KEY DEFAULT 'main',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'idle',
  jobs_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial heartbeat row
INSERT INTO public.worker_heartbeat (id, last_seen, status)
VALUES ('main', NOW(), 'idle')
ON CONFLICT (id) DO NOTHING;

-- 3. Function: update worker heartbeat
CREATE OR REPLACE FUNCTION public.update_worker_heartbeat(
  p_status TEXT DEFAULT 'idle',
  p_jobs_processed INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.worker_heartbeat (id, last_seen, status, jobs_processed)
  VALUES ('main', NOW(), p_status, p_jobs_processed)
  ON CONFLICT (id) DO UPDATE
  SET last_seen = NOW(),
      status = p_status,
      jobs_processed = worker_heartbeat.jobs_processed + p_jobs_processed;
$$;

-- 4. Function: check if worker is online (last seen < 2 minutes)
CREATE OR REPLACE FUNCTION public.is_worker_online()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worker_heartbeat
    WHERE id = 'main' AND last_seen > NOW() - INTERVAL '2 minutes'
  );
$$;

-- 5. RLS for worker_heartbeat
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage heartbeat" ON public.worker_heartbeat
  FOR ALL USING (true);

CREATE POLICY "Admins can view heartbeat" ON public.worker_heartbeat
  FOR SELECT USING (public.is_admin());

-- 6. Fix RLS for jobs - restrict to admin and service role only
DROP POLICY IF EXISTS "Service role can manage jobs" ON public.jobs;
CREATE POLICY "Service role can manage jobs" ON public.jobs
  FOR ALL USING (
    current_setting('role') = 'service_role'
    OR public.is_admin()
  );

-- Done
SELECT '✅ Migration v2 complete!' as message;
