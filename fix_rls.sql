-- ============================================================
-- FIX: تفعيل المشاهدات + سجل المشاهدة + التقييم + التعليقات
-- ============================================================
-- انسخ هذا الكود والصقه في SQL Editor على Supabase Dashboard ثم اضغط Run

-- 1. دوال تحديث المشاهدات (تتجاوز RLS)
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

-- 2. السماح لأي مستخدم مسجل بتسجيل المشاهدة
DROP POLICY IF EXISTS "Users can add to their watch history" ON public.watch_history;
CREATE POLICY "Users can add to their watch history" ON public.watch_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. السماح لأي مستخدم مسجل بالتقييم
DROP POLICY IF EXISTS "Users can create their own ratings" ON public.ratings;
CREATE POLICY "Users can create their own ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ratings" ON public.ratings;
CREATE POLICY "Users can update their own ratings" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. السماح بأي تعليقات
DROP POLICY IF EXISTS "Approved comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone" ON public.comments
  FOR SELECT USING (true);

-- 5. السماح بأي مشاهدات (تحديث العدّاد)
DROP POLICY IF EXISTS "Anyone can increment movie views" ON public.movies;
CREATE POLICY "Anyone can increment movie views" ON public.movies
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can increment series views" ON public.series;
CREATE POLICY "Anyone can increment series views" ON public.series
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can increment episode views" ON public.episodes;
CREATE POLICY "Anyone can increment episode views" ON public.episodes
  FOR UPDATE USING (true);
