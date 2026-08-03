-- ============================================================
-- NOO TV Database Setup for Supabase
-- Execute this SQL in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1. Users table (extends auth.users)
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

-- 2. Movies table
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
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Series table
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
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Seasons table
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

-- 5. Episodes table
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  embed_url TEXT NOT NULL,
  thumbnail TEXT,
  duration INTEGER,
  views INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content_type TEXT DEFAULT 'movie' CHECK (content_type IN ('movie', 'series')),
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Watchlist table
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

-- 8. Watch History table
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

-- 9. Ratings table
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

-- 10. Comments table
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

-- 11. User Notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Ads table
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

-- 13. Site Settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  value_type TEXT CHECK (value_type IN ('boolean', 'number', 'string')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default site settings
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
('session_duration', '30', 'number')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 2. HELPERS AND TRIGGERS
-- ============================================================

-- Admin check function (SECURITY DEFINER to avoid RLS recursion)
-- This is the single source of truth for admin role checks.
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

-- View count functions (SECURITY DEFINER to bypass RLS)
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

-- Auto-create public.users profile when a new auth user signs up
-- Also auto-confirms email so users can sign in immediately
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-confirm email immediately (skip email verification)
  UPDATE auth.users 
  SET email_confirmed_at = NOW(),
      raw_user_meta_data = raw_user_meta_data || '{"email_confirmed": true}'::jsonb
  WHERE id = NEW.id;

  -- Create public profile
  INSERT INTO public.users (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep public.users in sync when auth metadata changes
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

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- ============================================================
-- 3. ROW LEVEL SECURITY
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

-- ---------- users ----------
-- Users can view/update their own profile; admins can manage everyone.
-- NOTE: admins MUST be able to read this table or is_admin() breaks.
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

-- ---------- movies ----------
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

-- ---------- series ----------
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

-- ---------- seasons ----------
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

-- ---------- episodes ----------
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

-- ---------- categories ----------
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

-- ---------- watchlist ----------
CREATE POLICY "Users can view their own watchlist" ON public.watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their watchlist" ON public.watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist" ON public.watchlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove from their watchlist" ON public.watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- watch_history ----------
CREATE POLICY "Users can view their own watch history" ON public.watch_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their watch history" ON public.watch_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch history" ON public.watch_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch history" ON public.watch_history
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- ratings ----------
CREATE POLICY "Users can view ratings" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.ratings
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- comments ----------
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

-- ---------- user_notifications ----------
CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON public.user_notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications" ON public.user_notifications
  FOR ALL USING (public.is_admin());

-- ---------- ads ----------
CREATE POLICY "Active ads are viewable by everyone" ON public.ads
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all ads" ON public.ads
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage ads" ON public.ads
  FOR ALL USING (public.is_admin());

-- ---------- site_settings ----------
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.site_settings
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_movies_category ON public.movies(category);
CREATE INDEX IF NOT EXISTS idx_movies_active ON public.movies(is_active);
CREATE INDEX IF NOT EXISTS idx_movies_views ON public.movies(views DESC);
CREATE INDEX IF NOT EXISTS idx_series_active ON public.series(is_active);
CREATE INDEX IF NOT EXISTS idx_series_category ON public.series(category);
CREATE INDEX IF NOT EXISTS idx_seasons_series ON public.seasons(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season ON public.episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_active ON public.episodes(is_active);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_movie ON public.watchlist(movie_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_series ON public.watchlist(series_id);
CREATE INDEX IF NOT EXISTS idx_comments_movie ON public.comments(movie_id);
CREATE INDEX IF NOT EXISTS idx_comments_series ON public.comments(series_id);
CREATE INDEX IF NOT EXISTS idx_ratings_movie ON public.ratings(movie_id);
CREATE INDEX IF NOT EXISTS idx_ratings_series ON public.ratings(series_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ============================================================
-- 5. SAMPLE DATA
-- ============================================================

INSERT INTO public.categories (name, content_type, display_order) VALUES
('أكشن', 'movie', 1),
('دراما', 'movie', 2),
('كوميديا', 'movie', 3),
('رومانسي', 'movie', 4),
('رعب', 'movie', 5),
('خيال علمي', 'movie', 6),
('مسلسلات عربية', 'series', 7),
('مسلسلات أجنبية', 'series', 8)
ON CONFLICT DO NOTHING;

-- Sample movie
INSERT INTO public.movies (
  title,
  description,
  embed_url,
  thumbnail,
  category,
  year,
  quality,
  is_active
) VALUES (
  'فيلم تجريبي',
  'هذا فيلم تجريبي لاختبار المنصة. يمكنك حذفه وإضافة أفلامك الخاصة.',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400',
  'أكشن',
  2024,
  'HD',
  true
)
ON CONFLICT DO NOTHING;

-- Sample series with one season and one episode
WITH new_series AS (
  INSERT INTO public.series (
    title,
    description,
    category,
    total_seasons,
    thumbnail,
    is_active,
    display_order
  ) VALUES (
    'مسلسل تجريبي',
    'مسلسل تجريبي لاختبار نظام المواسم والحلقات. يمكنك حذفه وإضافة مسلسلاتك الخاصة.',
    'مسلسلات عربية',
    1,
    'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400',
    true,
    1
  )
  RETURNING id
), new_season AS (
  INSERT INTO public.seasons (series_id, season_number, title, display_order, is_active)
  SELECT id, 1, 'الموسم الأول', 1, true FROM new_series
  RETURNING id
)
INSERT INTO public.episodes (
  season_id,
  episode_number,
  title,
  embed_url,
  thumbnail,
  duration,
  display_order,
  is_active
)
SELECT id, 1, 'الحلقة الأولى', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400', 120, 1, true
FROM new_season
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. SUCCESS MESSAGE
-- ============================================================

SELECT
  '✅ تم إعداد قاعدة البيانات بنجاح!' as message,
  COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
