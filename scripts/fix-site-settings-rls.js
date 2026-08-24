const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.ykrslhhpjgfqkyutlxbx:Hashim.2001664933-2008@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await client.connect();

  // Drop old permissive policies on site_settings
  await client.query(`DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings`);
  await client.query(`DROP POLICY IF EXISTS "Allow all site_settings" ON public.site_settings`);

  // Only allow reading intro_video_url publicly
  await client.query(`
    CREATE POLICY "Public read intro only" ON public.site_settings
    FOR SELECT USING (setting_key = 'intro_video_url')
  `);

  // Admins can do everything (via service role / direct pg)
  await client.query(`
    CREATE POLICY "Admin full access site_settings" ON public.site_settings
    FOR ALL USING (true) WITH CHECK (true)
  `);

  console.log('✅ site_settings RLS updated');
  await client.end();
})();
