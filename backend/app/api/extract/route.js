import { chromium } from 'playwright'
import { NextResponse } from 'next/server'

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

let browserLock = Promise.resolve()

function cleanupCache() {
  const now = Date.now()
  for (const [key, val] of cache) {
    if (val.expiresAt <= now) cache.delete(key)
  }
}

function enqueue(task) {
  const result = browserLock.then(task, task)
  browserLock = result.then(() => {}, () => {})
  return result
}

async function extractM3u8(sourceUrl) {
  cleanupCache()

  const cached = cache.get(sourceUrl)
  if (cached && cached.expiresAt > Date.now()) {
    return { m3u8: cached.m3u8, cached: true }
  }

  const browser = await chromium.launch({
    headless: true,
    args: BROWSER_ARGS,
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

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

    const finalUrl = await m3u8Promise

    cache.set(sourceUrl, { m3u8: finalUrl, expiresAt: Date.now() + TTL })

    return { m3u8: finalUrl, cached: false }
  } finally {
    try { await page.close() } catch {}
    try { await context.close() } catch {}
    try { await browser.close() } catch {}
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sourceUrl = searchParams.get('url')

  if (!sourceUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400, headers: CORS_HEADERS })
  }

  try { new URL(sourceUrl) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: CORS_HEADERS })
  }

  try {
    const result = await enqueue(() => extractM3u8(sourceUrl))
    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}
