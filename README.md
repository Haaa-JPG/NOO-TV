# NOO TV - Arabic Streaming Platform

A complete Netflix-like streaming platform built with Next.js 14, Supabase, and Playwright.

## Features

- Arabic RTL UI with dark theme
- Movie and series streaming with HLS support
- P2P video delivery via WebTorrent
- Admin panel with user management
- User dashboard with watch history
- Background worker for automatic link refresh
- Cron job for expired content renewal
- Playwright scraper for stream extraction

## Quick Start

1. See `BUYER_GUIDE.md` for complete deployment instructions
2. Run `supabase_production_schema.sql` in Supabase SQL Editor
3. Deploy to Render with the required environment variables

## Tech Stack

- Frontend: Next.js 14, React 18, Tailwind CSS
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Video: HLS.js, WebTorrent
- Scraper: Playwright
- Hosting: Render

## License

Proprietary - All rights reserved.
