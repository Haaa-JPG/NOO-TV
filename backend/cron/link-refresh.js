const cron = require('node-cron')
const pLimit = require('p-limit')
const { createClient } = require('@supabase/supabase-js')
const { scrapeM3u8, isSourceUrl } = require('../services/scraper')

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */2 * * *'
const CONCURRENCY = parseInt(process.env.CRON_CONCURRENCY || '5', 10)
const REFRESH_WINDOW_SECONDS = parseInt(process.env.STREAM_REFRESH_WINDOW_SECONDS || '1800', 10)

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[CRON] Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    process.exit(1)
  }
  return createClient(url, key)
}

async function refreshMovies(supabase) {
  console.log('[CRON] Checking movies for refresh...')

  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, title, source_page_url, active_stream_url, expires_at, stream_status')
    .eq('is_active', true)
    .not('source_page_url', 'is', null)
    .neq('source_page_url', '')

  if (error) {
    console.error('[CRON] Failed to fetch movies:', error.message)
    return { total: 0, success: 0, failed: 0 }
  }

  if (!movies || movies.length === 0) {
    console.log('[CRON] No movies with source_page_url found')
    return { total: 0, success: 0, failed: 0 }
  }

  const now = new Date()
  const needsRefresh = movies.filter((m) => {
    if (!m.active_stream_url || m.stream_status !== 'completed') return true
    if (!m.expires_at) return true
    const expiresAt = new Date(m.expires_at)
    const windowMs = REFRESH_WINDOW_SECONDS * 1000
    return expiresAt.getTime() - now.getTime() <= windowMs
  })

  console.log(`[CRON] Movies: ${movies.length} total, ${needsRefresh.length} need refresh`)

  if (needsRefresh.length === 0) {
    return { total: movies.length, success: 0, failed: 0 }
  }

  const limit = pLimit(CONCURRENCY)
  let success = 0
  let failed = 0

  const tasks = needsRefresh.map((movie) =>
    limit(async () => {
      try {
        await supabase
          .from('movies')
          .update({ stream_status: 'processing' })
          .eq('id', movie.id)

        const { m3u8Url, expiresAt } = await scrapeM3u8(movie.source_page_url)

        await supabase
          .from('movies')
          .update({
            active_stream_url: m3u8Url,
            expires_at: expiresAt,
            last_refreshed: new Date().toISOString(),
            stream_status: 'completed',
            last_error: null,
          })
          .eq('id', movie.id)

        console.log(`[CRON] Movie refreshed: ${movie.title || movie.id}`)
        success++
      } catch (err) {
        console.error(`[CRON] Movie failed: ${movie.title || movie.id} - ${err.message}`)
        await supabase
          .from('movies')
          .update({
            stream_status: 'failed',
            last_error: err.message,
          })
          .eq('id', movie.id)
        failed++
      }
    })
  )

  await Promise.all(tasks)
  return { total: needsRefresh.length, success, failed }
}

async function refreshEpisodes(supabase) {
  console.log('[CRON] Checking episodes for refresh...')

  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('id, source_url, active_stream_url, embed_url, expires_at, stream_status')
    .eq('is_active', true)
    .not('source_url', 'is', null)
    .neq('source_url', '')

  if (error) {
    console.error('[CRON] Failed to fetch episodes:', error.message)
    return { total: 0, success: 0, failed: 0 }
  }

  if (!episodes || episodes.length === 0) {
    console.log('[CRON] No episodes with source_url found')
    return { total: 0, success: 0, failed: 0 }
  }

  const now = new Date()
  const needsRefresh = episodes.filter((ep) => {
    const streamUrl = ep.active_stream_url || ep.embed_url
    if (!streamUrl || !isSourceUrl(streamUrl)) {
      if (!streamUrl) return true
      return false
    }
    if (ep.stream_status !== 'completed') return true
    if (!ep.expires_at) return true
    const expiresAt = new Date(ep.expires_at)
    const windowMs = REFRESH_WINDOW_SECONDS * 1000
    return expiresAt.getTime() - now.getTime() <= windowMs
  })

  console.log(`[CRON] Episodes: ${episodes.length} total, ${needsRefresh.length} need refresh`)

  if (needsRefresh.length === 0) {
    return { total: episodes.length, success: 0, failed: 0 }
  }

  const limit = pLimit(CONCURRENCY)
  let success = 0
  let failed = 0

  const tasks = needsRefresh.map((ep) =>
    limit(async () => {
      try {
        await supabase
          .from('episodes')
          .update({ stream_status: 'processing' })
          .eq('id', ep.id)

        const sourceUrl = ep.source_url
        const { m3u8Url, expiresAt } = await scrapeM3u8(sourceUrl)

        await supabase
          .from('episodes')
          .update({
            active_stream_url: m3u8Url,
            embed_url: m3u8Url,
            expires_at: expiresAt,
            last_refreshed: new Date().toISOString(),
            stream_status: 'completed',
            last_error: null,
          })
          .eq('id', ep.id)

        console.log(`[CRON] Episode refreshed: ${ep.id}`)
        success++
      } catch (err) {
        console.error(`[CRON] Episode failed: ${ep.id} - ${err.message}`)
        await supabase
          .from('episodes')
          .update({
            stream_status: 'failed',
            last_error: err.message,
          })
          .eq('id', ep.id)
        failed++
      }
    })
  )

  await Promise.all(tasks)
  return { total: needsRefresh.length, success, failed }
}

async function runRefreshCycle() {
  const startTime = Date.now()
  console.log(`\n[CRON] === Refresh cycle started at ${new Date().toISOString()} ===`)

  const supabase = getSupabase()

  const movieResults = await refreshMovies(supabase)
  const episodeResults = await refreshEpisodes(supabase)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const totalSuccess = movieResults.success + episodeResults.success
  const totalFailed = movieResults.failed + episodeResults.failed

  console.log(`[CRON] === Cycle completed in ${elapsed}s ===`)
  console.log(`[CRON] Movies: ${movieResults.success}/${movieResults.total} refreshed, ${movieResults.failed} failed`)
  console.log(`[CRON] Episodes: ${episodeResults.success}/${episodeResults.total} refreshed, ${episodeResults.failed} failed`)
  console.log(`[CRON] Total: ${totalSuccess} success, ${totalFailed} failed\n`)
}

function start() {
  console.log('=== NOO TV Link Refresh Cron ===')
  console.log('Schedule:', CRON_SCHEDULE)
  console.log('Concurrency:', CONCURRENCY)
  console.log('Refresh window:', REFRESH_WINDOW_SECONDS, 'seconds')
  console.log('Time:', new Date().toISOString())

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('[CRON] Invalid cron schedule:', CRON_SCHEDULE)
    process.exit(1)
  }

  cron.schedule(CRON_SCHEDULE, () => {
    runRefreshCycle().catch((err) => {
      console.error('[CRON] Unhandled error in cycle:', err.message)
    })
  })

  console.log('[CRON] Cron job registered. Waiting for first trigger...')
  console.log('[CRON] Running initial cycle now...\n')
  runRefreshCycle().catch((err) => {
    console.error('[CRON] Unhandled error in initial cycle:', err.message)
  })
}

if (require.main === module) {
  start()
}

module.exports = { start, runRefreshCycle }
