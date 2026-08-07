import { chromium } from 'playwright'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
]

const JOB_TIMEOUT = 120000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
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

async function extractSingleEpisode(supabase, sourceUrl) {
  let browser = null
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    const m3u8 = await extractM3u8(page, sourceUrl)
    await page.close()
    await context.close()

    if (m3u8) {
      const { data: ep } = await supabase
        .from('episodes')
        .select('id')
        .eq('embed_url', sourceUrl)
        .limit(1)
        .maybeSingle()

      if (ep) {
        await supabase
          .from('episodes')
          .update({
            embed_url: m3u8,
            last_refreshed: new Date().toISOString(),
            stream_status: 'completed',
            last_error: null,
          })
          .eq('id', ep.id)
      }

      return { success: true, m3u8, episodeId: ep?.id }
    }

    return { success: false, error: 'No m3u8 found' }
  } catch (err) {
    return { success: false, error: err.message }
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sourceUrl = searchParams.get('url')
  const statusOnly = searchParams.get('status')
  const jobId = searchParams.get('job_id')

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: CORS_HEADERS })
  }

  if (statusOnly === 'true') {
    const [pending, processing, completed, failed] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    ])

    const [totalEp, readyEp, pendingEp, failedEp] = await Promise.all([
      supabase.from('episodes').select('*', { count: 'exact', head: true }),
      supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('stream_status', 'completed'),
      supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('stream_status', 'pending'),
      supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('stream_status', 'failed'),
    ])

    return NextResponse.json({
      status: 'ok',
      queue: {
        pending: pending.count || 0,
        processing: processing.count || 0,
        completed: completed.count || 0,
        failed: failed.count || 0,
      },
      episodes: {
        total: totalEp.count || 0,
        ready: readyEp.count || 0,
        pending: pendingEp.count || 0,
        failed: failedEp.count || 0,
      },
    }, { headers: CORS_HEADERS })
  }

  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    return NextResponse.json({ job }, { headers: CORS_HEADERS })
  }

  if (!sourceUrl) {
    const { data: pendingJobs } = await supabase
      .from('jobs')
      .select('id, source_url, status, attempts, created_at')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      status: 'ok',
      pending_jobs: pendingJobs || [],
    }, { headers: CORS_HEADERS })
  }

  try {
    new URL(sourceUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: CORS_HEADERS })
  }

  if (isSourceUrl(sourceUrl)) {
    const result = await extractSingleEpisode(supabase, sourceUrl)
    if (result.success) {
      return NextResponse.json({ m3u8: result.m3u8, status: 'extracted' }, { headers: CORS_HEADERS })
    }
    return NextResponse.json({ error: result.error, status: 'extraction_failed' }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ m3u8: sourceUrl, status: 'already_extracted' }, { headers: CORS_HEADERS })
}

export async function POST(request) {
  let body = {}
  try {
    body = await request.json()
  } catch {}

  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: CORS_HEADERS })
  }

  const { action, episode_ids, source_url } = body

  if (action === 'create_jobs' && episode_ids?.length > 0) {
    const jobs = []
    for (const epId of episode_ids) {
      const { data: ep } = await supabase
        .from('episodes')
        .select('id, embed_url')
        .eq('id', epId)
        .single()

      if (ep?.embed_url && isSourceUrl(ep.embed_url)) {
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id')
          .eq('episode_id', epId)
          .in('status', ['pending', 'processing', 'retrying'])
          .limit(1)
          .maybeSingle()

        if (!existingJob) {
          jobs.push({
            job_type: 'extract',
            episode_id: epId,
            content_type: 'episode',
            source_url: ep.embed_url,
            status: 'pending',
            priority: 5,
            max_attempts: 3,
          })
        }
      }
    }

    if (jobs.length > 0) {
      await supabase.from('jobs').insert(jobs)
    }

    return NextResponse.json({
      status: 'ok',
      jobs_created: jobs.length,
    }, { headers: CORS_HEADERS })
  }

  if (action === 'recover_stale') {
    const { data: stale } = await supabase.rpc('recover_stale_jobs')
    return NextResponse.json({
      status: 'ok',
      recovered: stale || 0,
    }, { headers: CORS_HEADERS })
  }

  if (action === 'process_queue') {
    const result = await processNextJob(supabase)
    return NextResponse.json(result, { headers: CORS_HEADERS })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: CORS_HEADERS })
}

async function processNextJob(supabase) {
  const { data: job, error: claimError } = await supabase.rpc('claim_next_job')

  if (claimError || !job) {
    return { status: 'no_jobs', message: 'No pending jobs to process' }
  }

  console.log(`[QUEUE] Job claimed: ${job.id} (${job.source_url?.substring(0, 60)}...)`)

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

      console.log(`[QUEUE] Job completed: ${job.id} -> m3u8 extracted`)
      return { status: 'completed', job_id: job.id, m3u8 }
    }

    await supabase.rpc('fail_job', { p_job_id: job.id, p_error: 'No m3u8 found' })
    console.log(`[QUEUE] Job failed: ${job.id} - No m3u8 found`)
    return { status: 'failed', job_id: job.id, error: 'No m3u8 found' }
  } catch (err) {
    await supabase.rpc('fail_job', { p_job_id: job.id, p_error: err.message })
    console.error(`[QUEUE] Job error: ${job.id} - ${err.message}`)
    return { status: 'error', job_id: job.id, error: err.message }
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
