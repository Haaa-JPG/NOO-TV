const { chromium } = require('playwright')

const SOURCE_PATTERNS = /3isk|qrmzi|krmzi|anaplayer/i

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function isSourceUrl(url) {
  if (!url) return false
  return SOURCE_PATTERNS.test(url)
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

async function extractM3u8FromPage(page, sourceUrl) {
  let m3u8Url = null

  const m3u8Promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout: m3u8 not found in 60s'))
    }, 60000)

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

    const onCrash = () => {
      clearTimeout(timer)
      page.removeListener('response', onResponse)
      if (!m3u8Url) reject(new Error('Page crashed or closed'))
    }
    page.once('close', onCrash)
    page.once('crash', onCrash)
  })

  await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)

  try {
    const popups = await page.$$('[class*="close"], [class*="Close"], .ad-close, .popup-close')
    for (const popup of popups) {
      try { await popup.click({ timeout: 1000 }) } catch {}
    }
  } catch {}

  try {
    const playBtn = await page.$('#playImage, .play-btn, [class*="play"], .playButton, #player')
    if (playBtn) {
      await playBtn.click({ timeout: 5000 })
      await page.waitForTimeout(3000)
    }
  } catch {}

  try {
    const serverItems = await page.$$('#server-list li, .server-list li, [class*="server"] li, .servers li')
    if (serverItems.length > 0) {
      await serverItems[0].click({ timeout: 5000 })
      await page.waitForTimeout(3000)
    }
  } catch {}

  return m3u8Promise
}

async function scrapeM3u8(sourceUrl, options = {}) {
  const { timeout = 120000 } = options

  if (!sourceUrl) {
    throw new Error('No source URL provided')
  }

  let browser = null
  let context = null
  let page = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })
    context = await browser.newContext({ userAgent: USER_AGENT })
    page = await context.newPage()

    const m3u8Url = await Promise.race([
      extractM3u8FromPage(page, sourceUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Scrape timeout')), timeout)),
    ])

    const expiresAt = parseTokenExpiry(m3u8Url)

    return { m3u8Url, expiresAt }
  } finally {
    if (page) { try { await page.close() } catch {} }
    if (context) { try { await context.close() } catch {} }
    if (browser) { try { await browser.close() } catch {} }
  }
}

module.exports = { scrapeM3u8, isSourceUrl, parseTokenExpiry, SOURCE_PATTERNS }
