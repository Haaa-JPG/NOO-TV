-- ============================================================
-- NOO TV Migration v3 — Token Refresh + Source URL
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Add source_url column to episodes (stores original page URL)
DO $$ BEGIN
  ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS source_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add source_url column to movies
DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS source_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Populate source_url from embed_url where it's a source URL
UPDATE public.episodes
SET source_url = embed_url
WHERE source_url IS NULL
  AND (embed_url LIKE '%3isk%' OR embed_url LIKE '%qrmzi%' OR embed_url LIKE '%krmzi%' OR embed_url LIKE '%anaplayer%');

-- 4. Add refresh_window setting
INSERT INTO public.site_settings (setting_key, setting_value, value_type) VALUES
  ('stream_refresh_window_seconds', '1800', 'number')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Function: get episodes needing refresh (expires soon or already expired)
CREATE OR REPLACE FUNCTION public.get_episodes_needing_refresh(
  p_window_seconds INTEGER DEFAULT 1800
)
RETURNS TABLE (
  episode_id UUID,
  source_url TEXT,
  current_embed_url TEXT,
  expires_at TIMESTAMPTZ,
  time_remaining_seconds INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id as episode_id,
    e.source_url,
    e.embed_url as current_embed_url,
    e.expires_at,
    EXTRACT(EPOCH FROM (e.expires_at - NOW()))::INTEGER as time_remaining_seconds
  FROM public.episodes e
  WHERE e.is_active = true
    AND e.source_url IS NOT NULL
    AND e.source_url != ''
    AND e.stream_status = 'completed'
    AND e.expires_at IS NOT NULL
    AND e.expires_at <= NOW() + (p_window_seconds || ' seconds')::INTERVAL
$$;

-- 6. Create unique index for active refresh jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_active_episode_refresh
  ON public.jobs (episode_id)
  WHERE status IN ('pending', 'processing', 'retrying') AND job_type = 'refresh';

-- Done
SELECT '✅ Migration v3 complete!' as message;
