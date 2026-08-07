const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
]

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

function isSourceUrl(url) {
  if (!url) return false
  return /3isk|qrmzi|krmzi|anaplayer/i.test(url)
}

async function extractM3u8(page, sourceUrl) {
  let m3u8Url = null

  const m3u8Promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: m3u8 not found in 45s'))
    }, 45000)

    const onResponse = (response) => {
      const url = response.url()
      if (url.includes('.m3u8') && !m3u8Url) {
        m3u8Url = url
        clearTimeout(timer)
        page.removeListener('response', onResponse)
        resolve(url)
      }
    }

    page.on('response', onResponse)

    page.once('close', () => {
      clearTimeout(timer)
      page.removeListener('response', onResponse)
      if (!m3u8Url) reject(new Error('Page closed before m3u8 found'))
    })
  })

  await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(3000)

  try {
    const playBtn = await page.$('#playImage')
    if (playBtn) await playBtn.click({ timeout: 3000 })
  } catch {}

  try {
    const serverItems = await page.$$('#server-list li')
    if (serverItems.length > 0) {
      await serverItems[0].click({ timeout: 3000 })
    }
  } catch {}

  return m3u8Promise
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

  let browser = null
  let context = null
  let page = null
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    page = await context.newPage()

    const m3u8 = await Promise.race([
      extractM3u8(page, job.source_url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT)),
    ])

    if (m3u8) {
      await supabase.rpc('complete_job', { p_job_id: job.id, p_result_url: m3u8 })

      if (job.episode_id) {
        const updateData = {
          embed_url: m3u8,
          last_refreshed: new Date().toISOString(),
          stream_status: 'completed',
          last_error: null,
        }

        if (job.job_type === 'refresh') {
          updateData.expires_at = parseTokenExpiry(m3u8)
        }

        await supabase
          .from('episodes')
          .update(updateData)
          .eq('id', job.episode_id)
      }

      console.log(`[WORKER] Job completed: ${job.id}`)
      jobsProcessed++
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
    if (page) { try { await page.close() } catch {} }
    if (context) { try { await context.close() } catch {} }
    if (browser) { try { await browser.close() } catch {} }
    currentJobRunning = false
  }
}

function parseTokenExpiry(m3u8Url) {
  try {
    const u = new URL(m3u8Url)
    const s = parseInt(u.searchParams.get('s'))
    const e = parseInt(u.searchParams.get('e'))
    if (s && e) {
      return new Date((s + e) * 1000).toISOString()
    }
  } catch {}
  return new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
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
    .select('id, source_url, embed_url, expires_at')
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
