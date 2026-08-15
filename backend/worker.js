const { createClient } = require('@supabase/supabase-js')
const { scrapeM3u8, isSourceUrl, parseTokenExpiry } = require('./services/scraper')

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)
const POLL_INTERVAL = 5000
const JOB_TIMEOUT = 120000
const REFRESH_WINDOW = parseInt(process.env.STREAM_REFRESH_WINDOW_SECONDS || '1800', 10)

let shuttingDown = false
let currentJobRunning = false

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[ERROR] Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    process.exit(1)
  }
  return createClient(url, key)
}

async function recoverStaleJobs(supabase) {
  const { data, error } = await supabase.rpc('recover_stale_jobs')
  if (data && data > 0) {
    console.log(`[RECOVERY] Recovered ${data} stale jobs`)
  }
}

async function claimAndProcess(supabase) {
  if (shuttingDown) return false

  const { data: job, error: claimError } = await supabase.rpc('claim_next_job')
  if (claimError || !job) return false

  console.log(`[WORKER] Job claimed: ${job.id} type=${job.job_type} (${job.source_url?.substring(0, 60)}...)`)
  currentJobRunning = true

  try {
    const { m3u8Url, expiresAt } = await Promise.race([
      scrapeM3u8(job.source_url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT)),
    ])

    if (m3u8Url) {
      await supabase.rpc('complete_job', { p_job_id: job.id, p_result_url: m3u8Url })

      if (job.episode_id) {
        const updateData = {
          active_stream_url: m3u8Url,
          embed_url: m3u8Url,
          last_refreshed: new Date().toISOString(),
          stream_status: 'completed',
          last_error: null,
        }

        if (job.job_type === 'refresh') {
          updateData.expires_at = expiresAt
        }

        await supabase
          .from('episodes')
          .update(updateData)
          .eq('id', job.episode_id)
      }

      if (job.movie_id) {
        const updateData = {
          active_stream_url: m3u8Url,
          last_refreshed: new Date().toISOString(),
          stream_status: 'completed',
          last_error: null,
        }

        if (job.job_type === 'refresh') {
          updateData.expires_at = expiresAt
        }

        await supabase
          .from('movies')
          .update(updateData)
          .eq('id', job.movie_id)
      }

      console.log(`[WORKER] Job completed: ${job.id}`)
      return true
    }

    await supabase.rpc('fail_job', { p_job_id: job.id, p_error: 'No m3u8 found' })
    console.log(`[WORKER] Job failed: ${job.id} - No m3u8 found`)
    return true
  } catch (err) {
    await supabase.rpc('fail_job', { p_job_id: job.id, p_error: err.message })
    console.error(`[WORKER] Job error: ${job.id} - ${err.message}`)
    return true
  } finally {
    currentJobRunning = false
  }
}

async function processNewExtractions(supabase) {
  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('id, embed_url')
    .eq('is_active', true)
    .or('stream_status.is.null,stream_status.eq.pending')

  if (error || !episodes || episodes.length === 0) return

  const sourceEpisodes = episodes.filter(ep => ep.embed_url && isSourceUrl(ep.embed_url))
  if (sourceEpisodes.length === 0) return

  const epIds = sourceEpisodes.map(ep => ep.id)
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('episode_id')
    .in('episode_id', epIds)
    .in('status', ['pending', 'processing', 'retrying'])

  const existingJobEps = new Set((existingJobs || []).map(j => j.episode_id))

  const newJobs = sourceEpisodes
    .filter(ep => !existingJobEps.has(ep.id))
    .map(ep => ({
      job_type: 'extract',
      episode_id: ep.id,
      content_type: 'episode',
      source_url: ep.embed_url,
      status: 'pending',
      priority: 3,
      max_attempts: 3,
    }))

  if (newJobs.length > 0) {
    await supabase.from('jobs').insert(newJobs)
    console.log(`[SCHEDULER] Created ${newJobs.length} extraction jobs`)
  }
}

async function processRefreshJobs(supabase) {
  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('id, source_url, active_stream_url, embed_url, expires_at')
    .eq('is_active', true)
    .not('source_url', 'is', null)
    .neq('source_url', '')
    .eq('stream_status', 'completed')
    .not('expires_at', 'is', null)
    .lte('expires_at', new Date(Date.now() + REFRESH_WINDOW * 1000).toISOString())

  if (error || !episodes || episodes.length === 0) return

  const epIds = episodes.map(ep => ep.id)
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('episode_id')
    .in('episode_id', epIds)
    .in('status', ['pending', 'processing', 'retrying'])

  const existingJobEps = new Set((existingJobs || []).map(j => j.episode_id))

  const newJobs = episodes
    .filter(ep => !existingJobEps.has(ep.id))
    .map(ep => ({
      job_type: 'refresh',
      episode_id: ep.id,
      content_type: 'episode',
      source_url: ep.source_url,
      status: 'pending',
      priority: 8,
      max_attempts: 3,
    }))

  if (newJobs.length > 0) {
    await supabase.from('jobs').insert(newJobs)
    console.log(`[SCHEDULER] Created ${newJobs.length} refresh jobs`)
  }
}

async function processMovieExtractions(supabase) {
  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, source_page_url, active_stream_url')
    .eq('is_active', true)
    .not('source_page_url', 'is', null)
    .neq('source_page_url', '')
    .or('stream_status.is.null,stream_status.eq.pending')

  if (error || !movies || movies.length === 0) return

  const needExtraction = movies.filter(m => !m.active_stream_url)
  if (needExtraction.length === 0) return

  const movieIds = needExtraction.map(m => m.id)
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('movie_id')
    .in('movie_id', movieIds)
    .in('status', ['pending', 'processing', 'retrying'])

  const existingJobMovies = new Set((existingJobs || []).map(j => j.movie_id))

  const newJobs = needExtraction
    .filter(m => !existingJobMovies.has(m.id))
    .map(m => ({
      job_type: 'extract',
      movie_id: m.id,
      content_type: 'movie',
      source_url: m.source_page_url,
      status: 'pending',
      priority: 3,
      max_attempts: 3,
    }))

  if (newJobs.length > 0) {
    await supabase.from('jobs').insert(newJobs)
    console.log(`[SCHEDULER] Created ${newJobs.length} movie extraction jobs`)
  }
}

async function main() {
  console.log('=== NOO TV Background Worker ===')
  console.log('Concurrency:', CONCURRENCY)
  console.log('Refresh window:', REFRESH_WINDOW, 'seconds')
  console.log('Time:', new Date().toISOString())

  const supabase = getSupabase()

  let lastSchedulerRun = 0
  let lastHeartbeat = 0
  const SCHEDULER_INTERVAL = 60000
  const HEARTBEAT_INTERVAL = 30000
  let jobsProcessed = 0

  async function sendHeartbeat(status, extraJobs) {
    try {
      await supabase.rpc('update_worker_heartbeat', {
        p_status: status,
        p_jobs_processed: extraJobs || 0,
      })
    } catch {}
  }

  process.on('SIGTERM', async () => {
    console.log('[WORKER] SIGTERM received. Waiting for current job to finish...')
    shuttingDown = true
    const checkExit = setInterval(() => {
      if (!currentJobRunning) {
        clearInterval(checkExit)
        console.log('[WORKER] Shutdown complete.')
        process.exit(0)
      }
    }, 1000)
  })

  process.on('SIGINT', () => {
    console.log('[WORKER] SIGINT received. Waiting for current job to finish...')
    shuttingDown = true
    const checkExit = setInterval(() => {
      if (!currentJobRunning) {
        clearInterval(checkExit)
        console.log('[WORKER] Shutdown complete.')
        process.exit(0)
      }
    }, 1000)
  })

  while (true) {
    if (shuttingDown && !currentJobRunning) {
      console.log('[WORKER] Shutting down (no active job).')
      process.exit(0)
    }

    try {
      const now = Date.now()

      if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
        const status = currentJobRunning ? 'processing' : 'idle'
        await sendHeartbeat(status, jobsProcessed)
        jobsProcessed = 0
        lastHeartbeat = now
      }

      if (now - lastSchedulerRun > SCHEDULER_INTERVAL) {
        await recoverStaleJobs(supabase)
        await processNewExtractions(supabase)
        await processRefreshJobs(supabase)
        await processMovieExtractions(supabase)
        lastSchedulerRun = now
      }

      let processed = 0
      while (processed < CONCURRENCY && !shuttingDown) {
        const didWork = await claimAndProcess(supabase)
        if (!didWork) break
        processed++
      }
    } catch (err) {
      console.error('[WORKER] Cycle error:', err.message)
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
