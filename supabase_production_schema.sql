-- ============================================================
-- NOO TV - Production Database Schema
-- Version: 3.0.0 (Unified)
-- Date: September 2026
--
-- Execute this ENTIRE script in Supabase SQL Editor.
-- This is the only database file you need.
-- ============================================================


-- ============================================================
-- SECTION 1: TABLES (15 tables)
-- ============================================================

-- 1. Users (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'editor', 'user')),
  language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_quality TEXT DEFAULT 'HD',
  is_banned BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Movies
CREATE TABLE IF NOT EXISTS public.movies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  embed_url TEXT NOT NULL,
  thumbnail TEXT,
  banner TEXT,
  category TEXT,
  year INTEGER,
  language TEXT DEFAULT 'ar',
  quality TEXT DEFAULT 'HD' CHECK (quality IN ('SD', 'HD', 'FHD', '4K')),
  is_translated BOOLEAN DEFAULT FALSE,
  is_dubbed BOOLEAN DEFAULT FALSE,
  views INTEGER DEFAULT 0,
  average_rating DECIMAL(2,1) DEFAULT 0.0,
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  source_page_url TEXT,
  active_stream_url TEXT,
  stream_status TEXT DEFAULT 'pending' CHECK (stream_status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'refresh_pending', 'refreshing')),
  expires_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Series
CREATE TABLE IF NOT EXISTS public.series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  total_seasons INTEGER DEFAULT 1,
  thumbnail TEXT,
  banner TEXT,
  average_rating DECIMAL(2,1) DEFAULT 0.0,
  views INTEGER DEFAULT 0,
  is_translated BOOLEAN DEFAULT FALSE,
  is_dubbed BOOLEAN DEFAULT FALSE,
  release_day TEXT,
  trailer_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  title TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Episodes
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  embed_url TEXT NOT NULL,
  thumbnail TEXT,
  duration INTEGER,
  views INTEGER DEFAULT 0,
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  source_url TEXT,
  active_stream_url TEXT,
  stream_status TEXT DEFAULT 'pending' CHECK (stream_status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'refresh_pending', 'refreshing')),
  expires_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content_type TEXT DEFAULT 'movie' CHECK (content_type IN ('movie', 'series')),
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Watchlist
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_content CHECK (
    (movie_id IS NOT NULL AND series_id IS NULL) OR
    (movie_id IS NULL AND series_id IS NOT NULL)
  )
);

-- 8. Watch History
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID,
  content_type TEXT CHECK (content_type IN ('movie', 'episode')),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  watched_time INTEGER DEFAULT 0,
  duration INTEGER,
  watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Ratings
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, movie_id, series_id, episode_id)
);

-- 10. Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  is_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. User Notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Ads
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ad_type TEXT CHECK (ad_type IN ('image', 'video', 'html')),
  code TEXT,
  position TEXT,
  devices TEXT DEFAULT 'all' CHECK (devices IN ('all', 'mobile', 'desktop')),
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Site Settings (key-value feature flags)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  value_type TEXT CHECK (value_type IN ('boolean', 'number', 'string')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Jobs (extraction/refresh queue)
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

-- 15. Worker Heartbeat
CREATE TABLE IF NOT EXISTS public.worker_heartbeat (
  id TEXT PRIMARY KEY DEFAULT 'main',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'idle',
  jobs_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- SECTION 2: FUNCTIONS (12 functions)
-- ============================================================

-- Admin check (SECURITY DEFINER - single source of truth)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Direct signup (bypasses email confirmation)
CREATE OR REPLACE FUNCTION public.direct_signup(
  p_email TEXT,
  p_password TEXT,
  p_display_name TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Create auth user
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, confirmation_token
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    NOW(), jsonb_build_object('display_name', p_display_name),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    NOW(), NOW(), ''
  );

  -- Create auth identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email', NOW(), NOW(), NOW()
  );

  -- Create public profile
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (v_user_id, p_email, p_display_name, 'user')
  ON CONFLICT (id) DO NOTHING;

  SELECT jsonb_build_object('id', v_user_id, 'email', p_email) INTO v_result;
  RETURN v_result;
END;
$$;

-- View count functions
CREATE OR REPLACE FUNCTION public.increment_movie_views(movie_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.movies SET views = COALESCE(views, 0) + 1 WHERE id = movie_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_series_views(sid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.series SET views = COALESCE(views, 0) + 1 WHERE id = sid;
$$;

CREATE OR REPLACE FUNCTION public.increment_episode_views(ep_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.episodes SET views = COALESCE(views, 0) + 1 WHERE id = ep_id;
$$;

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      raw_user_meta_data = raw_user_meta_data || '{"email_confirmed": true}'::jsonb
  WHERE id = NEW.id;

  INSERT INTO public.users (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

-- Sync user profile on auth changes
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', display_name),
      avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Job queue: claim next job
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

-- Job queue: complete a job
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

-- Job queue: fail a job (with retry logic)
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

-- Job queue: recover stale processing jobs
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

-- Worker heartbeat: update
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

-- Worker heartbeat: check if online
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


-- ============================================================
-- SECTION 3: TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();


-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY (all 15 tables)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users can create their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile" ON public.users
  FOR DELETE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (public.is_admin());

-- Movies
CREATE POLICY "Movies are viewable by everyone" ON public.movies
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all movies" ON public.movies
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert movies" ON public.movies
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update movies" ON public.movies
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Anyone can increment movie views" ON public.movies
  FOR UPDATE USING (true);
CREATE POLICY "Admins can delete movies" ON public.movies
  FOR DELETE USING (public.is_admin());

-- Series
CREATE POLICY "Series are viewable by everyone" ON public.series
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all series" ON public.series
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert series" ON public.series
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update series" ON public.series
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Anyone can increment series views" ON public.series
  FOR UPDATE USING (true);
CREATE POLICY "Admins can delete series" ON public.series
  FOR DELETE USING (public.is_admin());

-- Seasons
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all seasons" ON public.seasons
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert seasons" ON public.seasons
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update seasons" ON public.seasons
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete seasons" ON public.seasons
  FOR DELETE USING (public.is_admin());

-- Episodes
CREATE POLICY "Episodes are viewable by everyone" ON public.episodes
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all episodes" ON public.episodes
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert episodes" ON public.episodes
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update episodes" ON public.episodes
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Anyone can increment episode views" ON public.episodes
  FOR UPDATE USING (true);
CREATE POLICY "Admins can delete episodes" ON public.episodes
  FOR DELETE USING (public.is_admin());

-- Categories
CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all categories" ON public.categories
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete categories" ON public.categories
  FOR DELETE USING (public.is_admin());

-- Watchlist
CREATE POLICY "Users can view their own watchlist" ON public.watchlist
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their watchlist" ON public.watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watchlist" ON public.watchlist
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove from their watchlist" ON public.watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- Watch History
CREATE POLICY "Users can view their own watch history" ON public.watch_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their watch history" ON public.watch_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watch history" ON public.watch_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watch history" ON public.watch_history
  FOR DELETE USING (auth.uid() = user_id);

-- Ratings
CREATE POLICY "Users can view ratings" ON public.ratings
  FOR SELECT USING (true);
CREATE POLICY "Users can create their own ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ratings" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ratings" ON public.ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Approved comments are viewable by everyone" ON public.comments
  FOR SELECT USING (is_approved = true);
CREATE POLICY "Admins can view all comments" ON public.comments
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage comments" ON public.comments
  FOR ALL USING (public.is_admin());

-- User Notifications
CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.user_notifications
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage notifications" ON public.user_notifications
  FOR ALL USING (public.is_admin());

-- Ads
CREATE POLICY "Active ads are viewable by everyone" ON public.ads
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all ads" ON public.ads
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage ads" ON public.ads
  FOR ALL USING (public.is_admin());

-- Site Settings
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings
  FOR ALL USING (public.is_admin());

-- Jobs
CREATE POLICY "Service role can manage jobs" ON public.jobs
  FOR ALL USING (
    current_setting('role') = 'service_role'
    OR public.is_admin()
  );
CREATE POLICY "Admins can view jobs" ON public.jobs
  FOR SELECT USING (public.is_admin());

-- Worker Heartbeat
CREATE POLICY "Service role can manage heartbeat" ON public.worker_heartbeat
  FOR ALL USING (true);
CREATE POLICY "Admins can view heartbeat" ON public.worker_heartbeat
  FOR SELECT USING (public.is_admin());


-- ============================================================
-- SECTION 5: INDEXES (25 indexes)
-- ============================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Movies
CREATE INDEX IF NOT EXISTS idx_movies_category ON public.movies(category);
CREATE INDEX IF NOT EXISTS idx_movies_active ON public.movies(is_active);
CREATE INDEX IF NOT EXISTS idx_movies_views ON public.movies(views DESC);
CREATE INDEX IF NOT EXISTS idx_movies_source_page_url ON public.movies(source_page_url);
CREATE INDEX IF NOT EXISTS idx_movies_stream_status ON public.movies(stream_status);
CREATE INDEX IF NOT EXISTS idx_movies_expires_at ON public.movies(expires_at);

-- Series
CREATE INDEX IF NOT EXISTS idx_series_active ON public.series(is_active);
CREATE INDEX IF NOT EXISTS idx_series_category ON public.series(category);
CREATE INDEX IF NOT EXISTS idx_series_release_day ON public.series(release_day);

-- Seasons
CREATE INDEX IF NOT EXISTS idx_seasons_series ON public.seasons(series_id);

-- Episodes
CREATE INDEX IF NOT EXISTS idx_episodes_season ON public.episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_active ON public.episodes(is_active);
CREATE INDEX IF NOT EXISTS idx_episodes_stream_status ON public.episodes(stream_status);
CREATE INDEX IF NOT EXISTS idx_episodes_expires ON public.episodes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_episodes_active_stream_url ON public.episodes(active_stream_url);

-- Watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_movie ON public.watchlist(movie_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_series ON public.watchlist(series_id);

-- Comments & Ratings
CREATE INDEX IF NOT EXISTS idx_comments_movie ON public.comments(movie_id);
CREATE INDEX IF NOT EXISTS idx_comments_series ON public.comments(series_id);
CREATE INDEX IF NOT EXISTS idx_ratings_movie ON public.ratings(movie_id);
CREATE INDEX IF NOT EXISTS idx_ratings_series ON public.ratings(series_id);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_episode_id ON public.jobs(episode_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON public.jobs(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_next_retry ON public.jobs(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.jobs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_active_episode
  ON public.jobs (episode_id)
  WHERE status IN ('pending', 'processing', 'retrying');
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_active_episode_refresh
  ON public.jobs (episode_id)
  WHERE status IN ('pending', 'processing', 'retrying') AND job_type = 'refresh';


-- ============================================================
-- SECTION 6: SEED DATA
-- ============================================================

-- Worker heartbeat
INSERT INTO public.worker_heartbeat (id, last_seen, status)
VALUES ('main', NOW(), 'idle')
ON CONFLICT (id) DO NOTHING;

-- Default site settings (feature flags)
INSERT INTO public.site_settings (setting_key, setting_value, value_type) VALUES
('registration_enabled', 'true', 'boolean'),
('max_watchlist_items', '100', 'number'),
('max_user_lists', '10', 'number'),
('ratings_enabled', 'true', 'boolean'),
('comments_enabled', 'true', 'boolean'),
('watch_history_enabled', 'true', 'boolean'),
('default_language', 'ar', 'string'),
('default_theme', 'dark', 'string'),
('default_quality', 'HD', 'string'),
('ads_enabled', 'true', 'boolean'),
('pre_roll_ads', 'false', 'boolean'),
('recommendations_enabled', 'true', 'boolean'),
('notification_new_content', 'true', 'boolean'),
('notification_new_episode', 'true', 'boolean'),
('max_login_attempts', '5', 'number'),
('session_duration', '30', 'number'),
('stream_refresh_window_seconds', '1800', 'number'),
('intro_video_url', '', 'string'),
('site_name', 'NOO TV', 'string'),
('site_description', 'منصة البث العربية', 'string'),
('maintenance_mode', 'false', 'boolean')
ON CONFLICT (setting_key) DO NOTHING;

-- Default categories
INSERT INTO public.categories (name, content_type, display_order) VALUES
('أكشن', 'movie', 1),
('دراما', 'movie', 2),
('كوميديا', 'movie', 3),
('رومانسي', 'movie', 4),
('رعب', 'movie', 5),
('خيال علمي', 'movie', 6),
('وثائقي', 'movie', 7),
('مسلسلات عربية', 'series', 8),
('مسلسلات أجنبية', 'series', 9),
('مسلسلات تركية', 'series', 10)
ON CONFLICT DO NOTHING;

-- Sample movie
INSERT INTO public.movies (
  title, description, embed_url, thumbnail, category, year, quality, is_active
) VALUES (
  'فيلم تجريبي',
  'هذا فيلم تجريبي لاختبار المنصة. يمكنك حذفه وإضافة أفلامك الخاصة.',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400',
  'أكشن', 2024, 'HD', true
) ON CONFLICT DO NOTHING;

-- Sample series with season and episode
WITH new_series AS (
  INSERT INTO public.series (
    title, description, category, total_seasons, thumbnail, is_active, display_order
  ) VALUES (
    'مسلسل تجريبي',
    'مسلسل تجريبي لاختبار نظام المواسم والحلقات. يمكنك حذفه وإضافة مسلسلاتك الخاصة.',
    'مسلسلات عربية', 1,
    'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400',
    true, 1
  )
  RETURNING id
), new_season AS (
  INSERT INTO public.seasons (series_id, season_number, title, display_order, is_active)
  SELECT id, 1, 'الموسم الأول', 1, true FROM new_series
  RETURNING id
)
INSERT INTO public.episodes (
  season_id, episode_number, title, embed_url, thumbnail, duration, display_order, is_active
)
SELECT id, 1, 'الحلقة الأولى', 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400', 120, 1, true
FROM new_season
ON CONFLICT DO NOTHING;


-- ============================================================
-- SECTION 7: VERIFICATION
-- ============================================================

SELECT
  'NOO TV - Database setup complete!' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_tables,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') AS total_functions,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_indexes;
