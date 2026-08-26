# Streaming API Integration Plan

## Discovery Report

### Current Architecture
- Admin manually enters `embed_url` for movies/episodes (can be m3u8, YouTube embed, or source page URLs)
- Source page URLs (3isk, qrmzi, anaplayer, etc.) are auto-extracted by the background worker
- Video player uses `active_stream_url` (extracted m3u8) or falls back to `embed_url`
- Refresh happens via cron when `expires_at` approaches
- Resume playback tracked via `watch_history` table

### What Streaming API Integration Adds
Instead of relying on manual URLs and background scraping, the Streaming API provides:
- **Centralized source management:** Admin creates named "sources" with provider config
- **Server-side playback resolution:** Browser never sees raw m3u8, server mediates all calls
- **Automatic source failover:** If one source fails, try next configured source
- **Job monitoring:** Real-time status of extraction/refresh jobs per source
- **Source health:** Track success rates, avg response times, last errors per source

### Implementation Scope

| Step | File | Description |
|------|------|-------------|
| 1 | `supabase_migration_streaming_api.sql` | Add `streaming_sources` table, link to episodes/movies |
| 2 | `lib/streaming-api.js` | Server-side client for Streaming API calls |
| 3 | `app/api/streaming/sources/route.js` | CRUD endpoints for streaming sources |
| 4 | `app/api/streaming/playback/[sourceId]/route.js` | Resolve playback URL via Streaming API |
| 5 | `app/api/streaming/refresh/route.js` | Trigger manual refresh of sources |
| 6 | `app/api/streaming/jobs/route.js` | List/monitor active jobs |
| 7 | `app/admin/page.js` | Add streaming sources tab to admin panel |
| 8 | `components/video-player.jsx` | Fetch playback from server API instead of direct URL |
| 9 | `.env.example` | Add STREAMING_API_URL + STREAMING_API_KEY vars |
| 10 | `STREAMING_API_INTEGRATION_REPORT.md` | Final verification report |

### Security Rules
- `STREAMING_API_KEY` is **server-side only** - never `NEXT_PUBLIC_*`
- Browser requests go through `/api/streaming/playback/*` which calls the API server-side
- API key never appears in client bundle, network requests, or browser dev tools

### Database Changes
- New `streaming_sources` table: `id, name, api_base_url, api_key_hash, is_active, priority, source_type, config, created_at`
- New `content_streaming_sources` junction: `content_id, content_type, source_id, source_content_id, is_active`
- Episodes/movies gain optional `streaming_source_id` FK

### Playback Flow
```
Browser → /api/streaming/playback/[sourceId] → Streaming API → playback URL → Server → Browser
```
