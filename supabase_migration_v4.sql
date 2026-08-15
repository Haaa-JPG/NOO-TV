-- ============================================================
-- NOO TV Migration v4 — source_page_url + active_stream_url
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Add source_page_url + active_stream_url + stream tracking to movies
DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS source_page_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS active_stream_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS stream_status TEXT DEFAULT 'pending'
    CHECK (stream_status IN ('pending', 'processing', 'completed', 'failed'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS last_error TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add active_stream_url to episodes (source_url already exists from v3)
DO $$ BEGIN
  ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS active_stream_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Migrate existing data for movies
-- Copy source_url -> source_page_url where it exists
UPDATE public.movies
SET source_page_url = source_url
WHERE source_page_url IS NULL AND source_url IS NOT NULL AND source_url != '';

-- Copy embed_url -> active_stream_url where embed_url is an m3u8 (already extracted)
UPDATE public.movies
SET active_stream_url = embed_url,
    stream_status = 'completed'
WHERE active_stream_url IS NULL
  AND embed_url IS NOT NULL
  AND embed_url LIKE '%.m3u8%';

-- For source page URLs that haven't been extracted yet, keep embed_url as source_page_url
UPDATE public.movies
SET source_page_url = embed_url
WHERE source_page_url IS NULL
  AND embed_url IS NOT NULL
  AND (embed_url LIKE '%3isk%' OR embed_url LIKE '%qrmzi%' OR embed_url LIKE '%krmzi%' OR embed_url LIKE '%anaplayer%');

-- 4. Migrate existing data for episodes
-- Copy embed_url -> active_stream_url where it's an m3u8
UPDATE public.episodes
SET active_stream_url = embed_url,
    stream_status = 'completed'
WHERE active_stream_url IS NULL
  AND embed_url IS NOT NULL
  AND embed_url LIKE '%.m3u8%';

-- 5. Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_movies_source_page_url ON public.movies(source_page_url);
CREATE INDEX IF NOT EXISTS idx_movies_stream_status ON public.movies(stream_status);
CREATE INDEX IF NOT EXISTS idx_movies_expires_at ON public.movies(expires_at);
CREATE INDEX IF NOT EXISTS idx_episodes_active_stream_url ON public.episodes(active_stream_url);

-- 6. Unique index for active refresh jobs on movies
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_active_movie_refresh
  ON public.jobs (episode_id)
  WHERE status IN ('pending', 'processing', 'retrying') AND job_type = 'refresh';

-- Done
SELECT '✅ Migration v4 complete! source_page_url + active_stream_url added.' as message;
