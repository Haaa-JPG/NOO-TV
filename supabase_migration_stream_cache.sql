-- Add extracted m3u8 cache columns for the /api/stream proxy
-- These columns store the server-side extracted m3u8 URLs with short TTL

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS extracted_m3u8_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_m3u8_expires TIMESTAMPTZ;

ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS extracted_m3u8_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_m3u8_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_episodes_extracted_expires
  ON public.episodes(extracted_m3u8_expires)
  WHERE extracted_m3u8_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movies_extracted_expires
  ON public.movies(extracted_m3u8_expires)
  WHERE extracted_m3u8_url IS NOT NULL;
