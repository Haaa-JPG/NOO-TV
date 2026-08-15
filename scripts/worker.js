const { createClient } = require('@supabase/supabase-js')
const { scrapeM3u8, isSourceUrl } = require('./scraper')

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)
const POLL_INTERVAL = 5000
const JOB_TIMEOUT = 120000
const REFRESH_WINDOW = parseInt(process.env.STREAM_REFRESH_WINDOW_SECONDS || '1800', 10)

let shuttingDown = false
let currentJobRunning = false

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[WORKER] Missing Supabase credentials')
    return null
  }
  return createClient(url, key)
}

async function recoverStaleJobs(supabase) {
  try {
    const { data, error } = await supabase.rpc('recover_stale_jobs')
    if (data && data > 0) {
      console.log(`[RECOVERY] Recovered ${data} stale jobs`)
    }
  } catch {}
}

async function claimAndProcess(supabase) {
  if (shuttingDown) return false

  const { data: job, error: claimError } = await supabase.rpc('claim_next_job')
  if (claimError || !job) return false

  console.log(`[WORKER] Job claimed: ${job.id} type=${job.job_type}`)
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
        if (job.job_type === 'refresh') updateData.expires_at = expiresAt
        await supabase.from('episodes').update(updateData).eq('id', job.episode_id)
      }

      if (job.movie_id) {
        const updateData = {
          active_stream_url: m3u8Url,
          last_refreshed: new Date().toISOString(),
          stream_status: 'completed',
          last_error: null,
        }
        if (job.job_type === 'refresh') updateData.expires_at = expiresAt
        await supabase.from('movies').update(updateData).eq('id', job.movie_id)
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
  try {
    const { data: episodes } = await supabase
      .from('episodes')
      .select('id, embed_url')
      .eq('is_active', true)
      .or('stream_status.is.null,stream_status.eq.pending')

    if (!episodes || episodes.length === 0) return

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
  } catch (err) {
    console.error('[SCHEDULER] processNewExtractions error:', err.message)
  }
}

async function processRefreshJobs(supabase) {
  try {
    const { data: episodes } = await supabase
      .from('episodes')
      .select('id, source_url, active_stream_url, embed_url, expires_at')
      .eq('is_active', true)
      .not('source_url', 'is', null)
      .neq('source_url', '')
      .eq('stream_status', 'completed')
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date(Date.now() + REFRESH_WINDOW * 1000).toISOString())

    if (!episodes || episodes.length === 0) return

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
  } catch (err) {
    console.error('[SCHEDULER] processRefreshJobs error:', err.message)
  }
}

async function processMovieExtractions(supabase) {
  try {
    const { data: movies } = await supabase
      .from('movies')
      .select('id, source_page_url, active_stream_url')
      .eq('is_active', true)
      .not('source_page_url', 'is', null)
      .neq('source_page_url', '')
      .or('stream_status.is.null,stream_status.eq.pending')

    if (!movies || movies.length === 0) return

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
  } catch (err) {
    console.error('[SCHEDULER] processMovieExtractions error:', err.message)
  }
}

function startWorker() {
  const supabase = getSupabase()
  if (!supabase) {
    console.error('[WORKER] Cannot start - missing Supabase credentials')
    return
  }

  console.log('[WORKER] Background worker started')

  let lastSchedulerRun = 0
  const SCHEDULER_INTERVAL = 60000

  async function tick() {
    if (shuttingDown) return

    try {
      const now = Date.now()

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
  }

  setInterval(tick, POLL_INTERVAL)
  tick()
}

module.exports = { startWorker }
