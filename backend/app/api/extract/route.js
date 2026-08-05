import { chromium } from 'playwright'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const cache = new Map()
const TTL = 10 * 60 * 60 * 1000

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function cleanupCache() {
  const now = Date.now()
  for (const [key, val] of cache) {
    if (val.expiresAt <= now) cache.delete(key)
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function extractM3u8FromPage(page, sourceUrl) {
  let m3u8Url = null

  const m3u8Promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: m3u8 link not found within 45 seconds'))
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

async function runExtractionJob() {
  const supabase = getSupabase()
  if (!supabase) {
    return { error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.' }
  }

  const { data: episodes, error: fetchError } = await supabase
    .from('episodes')
    .select('id, embed_url, last_refreshed')
    .eq('is_active', true)

  if (fetchError) {
    return { error: `Supabase fetch error: ${fetchError.message}` }
  }

  if (!episodes || episodes.length === 0) {
    return { processed: 0, skipped: 0, failed: 0, message: 'No episodes found' }
  }

  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000

  const needsRefresh = episodes.filter((ep) => {
    if (!ep.embed_url) return true
    if (!ep.last_refreshed) return true
    try {
      const refreshedAt = new Date(ep.last_refreshed).getTime()
      if (isNaN(refreshedAt)) return true
      return refreshedAt < sixHoursAgo
    } catch {
      return true
    }
  })

  if (needsRefresh.length === 0) {
    return { processed: 0, skipped: episodes.length, failed: 0, message: 'All episodes are fresh' }
  }

  let processed = 0
  let failed = 0

  for (const ep of needsRefresh) {
    let browser = null
    try {
      browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })
      const page = await context.newPage()

      const m3u8 = await extractM3u8FromPage(page, ep.embed_url)

      await page.close()
      await context.close()

      if (m3u8) {
        await supabase
          .from('episodes')
          .update({ embed_url: m3u8, last_refreshed: new Date().toISOString() })
          .eq('id', ep.id)
        processed++
      } else {
        failed++
      }
    } catch (err) {
      failed++
    } finally {
      if (browser) {
        try { await browser.close() } catch {}
      }
    }
  }

  return { processed, skipped: episodes.length - needsRefresh.length, failed }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sourceUrl = searchParams.get('url')
  const force = searchParams.get('force') === '1'

  if (!sourceUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400, headers: CORS_HEADERS })
  }

  try { new URL(sourceUrl) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: CORS_HEADERS })
  }

  cleanupCache()

  if (!force) {
    const cached = cache.get(sourceUrl)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ m3u8: cached.m3u8, cached: true }, { headers: CORS_HEADERS })
    }
  }

  let browser = null
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    const m3u8 = await extractM3u8FromPage(page, sourceUrl)

    cache.set(sourceUrl, { m3u8, expiresAt: Date.now() + TTL })

    return NextResponse.json({ m3u8, cached: false }, { headers: CORS_HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

export async function POST() {
  try {
    const result = await runExtractionJob()
    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
