# NOO TV - Deployment Guide

## What You Get

A complete Netflix-like Arabic streaming platform:

- Next.js 14 frontend with Arabic RTL UI
- Supabase database with full RLS security
- Background worker for automatic link refresh
- Cron job for expired content renewal
- Playwright scraper for stream extraction
- P2P video delivery (WebTorrent)
- Admin panel with user management
- User dashboard with watch history

---

## Step 1: Database Setup (1-Click)

1. Go to supabase.com and create a new project
2. Open the SQL Editor in your dashboard
3. Copy the entire contents of `supabase_production_schema.sql`
4. Paste it into the SQL Editor and click Run
5. Wait for the success message

This creates:
- 15 database tables with full RLS policies
- 12 database functions (admin checks, job queue, view counters)
- 25+ performance indexes
- Default categories and platform settings
- Sample content for testing

---

## Step 2: Get Your Supabase Keys

In your Supabase dashboard, go to Settings > API and copy:

- NEXT_PUBLIC_SUPABASE_URL - Settings > API > Project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY - Settings > API > anon key
- SUPABASE_SERVICE_ROLE_KEY - Settings > API > service_role key (secret!)
- DATABASE_URL - Settings > Database > Connection string > URI

---

## Step 3: Deploy to Render

1. Fork or clone this repository to your GitHub account
2. Go to render.com and create a new Web Service
3. Connect your GitHub repository
4. Configure:
   - Build Command: `npm install && npx playwright install --with-deps chromium && npm run build`
   - Start Command: `node server.js`
5. Add these environment variables:

```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=<your project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_URL=<your project URL>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
DATABASE_URL=<your database URL>
ENABLE_WORKER=true
ENABLE_CRON=true
CRON_SCHEDULE=0 */2 * * *
WORKER_CONCURRENCY=1
CRON_CONCURRENCY=5
STREAM_REFRESH_WINDOW_SECONDS=1800
```

6. Click Create Web Service

---

## Step 4: Create Admin Account

After deployment, create your first admin account:

1. Open your deployed site
2. Go to /auth and sign up with any email/password
3. In Supabase SQL Editor, run:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
```

4. Log out and log back in
5. You now have full admin access at /admin

---

## Step 5: Add Content

1. Go to /admin
2. Use the Movies tab to add movies (YouTube URLs, .mp4 links, or iframe embeds)
3. Use the Series tab to add series with seasons and episodes
4. Use the Hero Banner tab to feature content on the homepage

---

## Architecture Overview

```
/
  app/              - Next.js pages and API routes
    admin/          - Admin panel
    api/            - Backend API endpoints
    auth/           - Login/signup page
    series/         - Series listing and detail pages
    watch/          - Video player pages
    user/           - User dashboard
  components/       - React components
    ui/             - shadcn/ui components
    video-player.jsx - Main video player with P2P
  lib/              - Shared utilities
    security.js     - Input sanitization
    rate-limit.js   - API rate limiting
  scripts/          - Background services
    worker.js       - Stream extraction worker
    cron.js         - Link refresh scheduler
    scraper.js      - Playwright scraper
  server.js         - Unified server (Next.js + worker + cron)
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Your Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Supabase anonymous/public key |
| SUPABASE_URL | Yes | Same as above (for server-side) |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key (secret) |
| DATABASE_URL | Yes | PostgreSQL connection string |
| ENABLE_WORKER | No | Enable background worker (default: false) |
| ENABLE_CRON | No | Enable cron job (default: false) |
| CRON_SCHEDULE | No | Cron schedule (default: 0 */2 * * *) |
| WORKER_CONCURRENCY | No | Worker parallel jobs (default: 1) |
| CRON_CONCURRENCY | No | Cron parallel jobs (default: 5) |
| STREAM_REFRESH_WINDOW_SECONDS | No | Refresh window (default: 1800) |

---

## Support

For issues or questions, refer to the codebase comments or open a GitHub issue.
