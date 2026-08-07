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

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)

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

async function main() {
  console.log('=== NOO TV Link Updater (Jobs-based) ===')
  console.log('Time:', new Date().toISOString())

  const supabase = getSupabase()

  const { data: episodes, error: fetchError } = await supabase
    .from('episodes')
    .select('id, embed_url, last_refreshed, stream_status')
    .eq('is_active', true)

  if (fetchError) {
    console.error('[ERROR] Fetch failed:', fetchError.message)
    process.exit(1)
  }

  console.log('Total active episodes:', episodes?.length || 0)

  if (!episodes || episodes.length === 0) {
    console.log('No episodes found. Done.')
    return
  }

  const now = Date.now()
  const needsRefresh = episodes.filter((ep) => {
    if (!ep.embed_url) return true
    if (!isSourceUrl(ep.embed_url)) return false
    if (ep.stream_status === 'completed') return false
    if (ep.stream_status === 'processing') return false
    return true
  })

  console.log('Needs extraction:', needsRefresh.length)

  if (needsRefresh.length === 0) {
    console.log('All episodes are fresh. Done.')
    return
  }

  let createdJobs = 0
  for (const ep of needsRefresh) {
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
        priority: 5,
        max_attempts: 3,
      })
      createdJobs++
    }
  }

  console.log(`Created ${createdJobs} jobs`)

  let processed = 0
  let failed = 0

  for (const ep of needsRefresh) {
    const { data: job, error: claimError } = await supabase.rpc('claim_next_job')
    if (claimError || !job) {
      console.log('No more jobs to process')
      break
    }

    console.log(`\n[${processed + failed + 1}/${needsRefresh.length}] Job ${job.id}`)
    console.log('  Episode:', job.episode_id)
    console.log('  URL:', job.source_url?.substring(0, 80))

    let browser = null
    try {
      browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })
      const page = await context.newPage()

      const m3u8 = await extractM3u8(page, job.source_url)

      await page.close()
      await context.close()

      if (m3u8) {
        console.log('  Got m3u8:', m3u8.substring(0, 100))
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

        console.log('  Updated successfully')
        processed++
      } else {
        console.log('  No m3u8 found')
        await supabase.rpc('fail_job', { p_job_id: job.id, p_error: 'No m3u8 found' })
        failed++
      }
    } catch (err) {
      console.error('  Error:', err.message)
      await supabase.rpc('fail_job', { p_job_id: job.id, p_error: err.message })
      failed++
    } finally {
      if (browser) {
        try { await browser.close() } catch {}
      }
    }
  }

  console.log('\n=== Done ===')
  console.log('Processed:', processed)
  console.log('Failed:', failed)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
