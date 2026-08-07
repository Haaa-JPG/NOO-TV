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
const STALE_MINUTES = 5
const JOB_TIMEOUT = 120000

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

    page.on('response', (response) => {
      const url = response.url()
      if (url.includes('.m3u8') && !m3u8Url) {
        m3u8Url = url
        clearTimeout(timer)
        resolve(url)
      }
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
  const { data: job, error: claimError } = await supabase.rpc('claim_next_job')
  if (claimError || !job) return false

  console.log(`[WORKER] Job claimed: ${job.id} (${job.source_url?.substring(0, 60)}...)`)

  let browser = null
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    const m3u8 = await Promise.race([
      extractM3u8(page, job.source_url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT))
    ])

    await page.close()
    await context.close()

    if (m3u8) {
      await supabase.rpc('complete_job', { p_job_id: job.id, p_result_url: m3u8 })

      if (job.episode_id) {
        await supabase
          .from('episodes')
          .update({
            embed_url: m3u8,
            last_refreshed: new Date().toISOString(),
            stream_status: 'completed',
            last_error: null,
          })
          .eq('id', job.episode_id)
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
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

async function processEpisodesNeedingRefresh(supabase) {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, embed_url')
    .eq('is_active', true)
    .or('stream_status.is.null,stream_status.eq.pending')

  if (!episodes || episodes.length === 0) return

  for (const ep of episodes) {
    if (!ep.embed_url || !isSourceUrl(ep.embed_url)) continue

    const { data: existing } = await supabase
      .from('jobs')
      .select('id')
      .eq('episode_id', ep.id)
      .in('status', ['pending', 'processing', 'retrying'])
      .limit(1)
      .maybeSingle()

    if (!existing) {
      await supabase.from('jobs').insert({
        job_type: 'extract',
        episode_id: ep.id,
        content_type: 'episode',
        source_url: ep.embed_url,
        status: 'pending',
        priority: 3,
        max_attempts: 3,
      })
      console.log(`[SCHEDULER] Created job for episode: ${ep.id}`)
    }
  }
}

async function main() {
  console.log('=== NOO TV Background Worker ===')
  console.log('Concurrency:', CONCURRENCY)
  console.log('Time:', new Date().toISOString())

  const supabase = getSupabase()

  let lastSchedulerRun = 0
  const SCHEDULER_INTERVAL = 60000

  const runCycle = async () => {
    const now = Date.now()

    if (now - lastSchedulerRun > SCHEDULER_INTERVAL) {
      await recoverStaleJobs(supabase)
      await processEpisodesNeedingRefresh(supabase)
      lastSchedulerRun = now
    }

    let processed = 0
    while (processed < CONCURRENCY) {
      const didWork = await claimAndProcess(supabase)
      if (!didWork) break
      processed++
    }
  }

  const loop = async () => {
    while (true) {
      try {
        await runCycle()
      } catch (err) {
        console.error('[WORKER] Cycle error:', err.message)
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
    }
  }

  process.on('SIGTERM', () => {
    console.log('[WORKER] Shutting down gracefully...')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('[WORKER] Shutting down gracefully...')
    process.exit(0)
  })

  await loop()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
