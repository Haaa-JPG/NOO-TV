-- Translation Cache Table
-- Stores cached translations to avoid redundant API calls
-- Created: September 2026

CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang VARCHAR(10) NOT NULL DEFAULT 'en',
  target_lang VARCHAR(10) NOT NULL DEFAULT 'ar',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint to prevent duplicate translations
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_cache_unique 
  ON translation_cache (source_text, source_lang, target_lang);

-- Index for fast lookups by source text
CREATE INDEX IF NOT EXISTS idx_translation_cache_source 
  ON translation_cache (source_text);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_translation_cache_created 
  ON translation_cache (created_at);

-- Function to get or create translation
CREATE OR REPLACE FUNCTION get_or_create_translation(
  p_source_text TEXT,
  p_source_lang VARCHAR(10),
  p_target_lang VARCHAR(10)
) RETURNS TABLE (
  translated_text TEXT,
  was_cached BOOLEAN
) AS $$
DECLARE
  v_cached_text TEXT;
  v_result_text TEXT;
BEGIN
  -- Try to get from cache first
  SELECT tc.translated_text INTO v_cached_text
  FROM translation_cache tc
  WHERE tc.source_text = p_source_text
    AND tc.source_lang = p_source_lang
    AND tc.target_lang = p_target_lang
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_cached_text, TRUE;
    RETURN;
  END IF;

  -- Not found, will be inserted by application after translation
  RETURN QUERY SELECT NULL::TEXT, FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk insert translations
CREATE OR REPLACE FUNCTION bulk_insert_translations(
  p_translations JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_translations)
  LOOP
    INSERT INTO translation_cache (source_text, translated_text, source_lang, target_lang)
    VALUES (
      v_item->>'source_text',
      v_item->>'translated_text',
      v_item->>'source_lang',
      v_item->>'target_lang'
    )
    ON CONFLICT (source_text, source_lang, target_lang) 
    DO UPDATE SET 
      translated_text = EXCLUDED.translated_text,
      updated_at = NOW();
    
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;

-- RLS policies (admin only for management, public for reads)
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (translations are not sensitive)
CREATE POLICY "Public can read translations" ON translation_cache
  FOR SELECT USING (true);

-- Allow authenticated users to insert (for translation requests)
CREATE POLICY "Authenticated can insert translations" ON translation_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow admin to manage all translations
CREATE POLICY "Admin can manage translations" ON translation_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Comment for documentation
COMMENT ON TABLE translation_cache IS 'Caches machine translations for content (titles, descriptions, etc.)';
COMMENT ON COLUMN translation_cache.source_text IS 'Original text before translation';
COMMENT ON COLUMN translation_cache.translated_text IS 'Translated text result';
COMMENT ON COLUMN translation_cache.source_lang IS 'Source language code (e.g., en, ar)';
COMMENT ON COLUMN translation_cache.target_lang IS 'Target language code (e.g., ar, en)';
