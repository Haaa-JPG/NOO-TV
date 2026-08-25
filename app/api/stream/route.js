import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'

const EXTERNAL_EXTRACT_API = process.env.NEXT_PUBLIC_EXTRACT_URL || ''

const SOURCE_PATTERNS = [
  /z\.3isk\.news/i,
  /qrmzi\.tv/i,
  /3isk/i,
  /krmzi\.space/i,
  /anaplayer/i,
]

const M3U8_REGEX = /(?:https?:)?\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi
const IFRAME_SRC_REGEX = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi
const DATA_SRC_REGEX = /(?:data-src|data-url|file)\s*[:=]\s*["']([^"']+)["']/gi
const SOURCE_ATTR_REGEX = /(?:source|src|url|file|link)\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/gi

function isSourcePage(url) {
  return SOURCE_PATTERNS.some(p => p.test(url))
}

function parseTokenExpiry(m3u8Url) {
  try {
    const u = new URL(m3u8Url.startsWith('//') ? 'https:' + m3u8Url : m3u8Url)
    const s = parseInt(u.searchParams.get('s') || '0', 10)
    const e = parseInt(u.searchParams.get('e') || '0', 10)
    if (e > 0) return new Date(e * 1000)
    if (s > 0 && e > s) return new Date(e * 1000)
  } catch {}
  return new Date(Date.now() + 30 * 60 * 1000)
}

async function extractFromPage(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ar,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return null

  const html = await res.text()
  const m3u8Urls = new Set()

  const patterns = [SOURCE_ATTR_REGEX, M3U8_REGEX, DATA_SRC_REGEX]
  for (const pattern of patterns) {
    let match
    pattern.lastIndex = 0
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1] || match[0]
      if (url && url.includes('.m3u8')) {
        const full = url.startsWith('//') ? 'https:' + url : url
        m3u8Urls.add(full)
      }
    }
  }

  const iframeSrcs = []
  let m
  IFRAME_SRC_REGEX.lastIndex = 0
  while ((m = IFRAME_SRC_REGEX.exec(html)) !== null) {
    iframeSrcs.push(m[1])
  }

  for (const iframeSrc of iframeSrcs) {
    if (m3u8Urls.size > 0) break
    try {
      const iframeUrl = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, sourceUrl).href
      const iframeRes = await fetch(iframeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': sourceUrl,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      })
      if (!iframeRes.ok) continue
      const iframeHtml = await iframeRes.text()
      let im
      SOURCE_ATTR_REGEX.lastIndex = 0
      while ((im = SOURCE_ATTR_REGEX.exec(iframeHtml)) !== null) {
        const url = im[1]
        if (url && url.includes('.m3u8')) {
          m3u8Urls.add(url.startsWith('//') ? 'https:' + url : url)
        }
      }
      M3U8_REGEX.lastIndex = 0
      while ((im = M3U8_REGEX.exec(iframeHtml)) !== null) {
        const url = im[0]
        if (url) m3u8Urls.add(url.startsWith('//') ? 'https:' + url : url)
      }
    } catch {}
  }

  if (m3u8Urls.size === 0) return null

  const urls = Array.from(m3u8Urls)
  const preferred = urls.find(u => /token|auth|expired|sign/i.test(u)) || urls[0]
  return preferred
}

async function extractViaExternalApi(sourceUrl) {
  if (!EXTERNAL_EXTRACT_API) return null
  try {
    const encoded = encodeURIComponent(sourceUrl)
    const res = await fetch(`${EXTERNAL_EXTRACT_API}/api/extract?url=${encoded}`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    return data.m3u8 || null
  } catch {
    return null
  }
}

async function getSourceUrlFromDb(client, id, type) {
  const table = type === 'episode' ? 'episodes' : 'movies'
  const { rows } = await client.query(
    `SELECT embed_url, source_url, source_page_url, active_stream_url, expires_at
     FROM ${table} WHERE id = $1`,
    [id]
  )
  return rows[0] || null
}

async function getCachedUrl(client, id, type) {
  const table = type === 'episode' ? 'episodes' : 'movies'
  const cacheCol = type === 'episode' ? 'extracted_m3u8_url' : 'extracted_m3u8_url'
  const expiryCol = type === 'episode' ? 'extracted_m3u8_expires' : 'extracted_m3u8_expires'
  try {
    const { rows } = await client.query(
      `SELECT ${cacheCol}, ${expiryCol} FROM ${table} WHERE id = $1`,
      [id]
    )
    if (rows[0] && rows[0][cacheCol] && rows[0][expiryCol]) {
      if (new Date(rows[0][expiryCol]) > new Date()) {
        return rows[0][cacheCol]
      }
    }
  } catch {}
  return null
}

async function cacheUrl(client, id, type, m3u8Url) {
  const table = type === 'episode' ? 'episodes' : 'movies'
  const expiresAt = parseTokenExpiry(m3u8Url)
  try {
    await client.query(
      `UPDATE ${table}
       SET extracted_m3u8_url = $2, extracted_m3u8_expires = $3, last_refreshed = NOW()
       WHERE id = $1`,
      [id, m3u8Url, expiresAt.toISOString()]
    )
  } catch {}
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') || 'movie'
  const directUrl = searchParams.get('url')

  if (!id && !directUrl) {
    return NextResponse.json({ error: 'Missing id or url parameter' }, { status: 400 })
  }

  let sourceUrl = directUrl
  let contentId = id
  let contentType = type

  if (id) {
    const client = getDbClient()
    try {
      await client.connect()

      const cached = await getCachedUrl(client, id, contentType)
      if (cached) {
        return NextResponse.redirect(cached, 302)
      }

      const record = await getSourceUrlFromDb(client, id, contentType)
      if (!record) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 })
      }

      if (record.active_stream_url && record.active_stream_url.includes('.m3u8')) {
        if (!record.expires_at || new Date(record.expires_at) > new Date()) {
          return NextResponse.redirect(record.active_stream_url, 302)
        }
      }

      sourceUrl = record.source_page_url || record.source_url || record.embed_url
    } finally {
      await client.end()
    }
  }

  if (!sourceUrl) {
    return NextResponse.json({ error: 'No source URL found' }, { status: 404 })
  }

  let m3u8Url = null

  if (isSourcePage(sourceUrl)) {
    m3u8Url = await extractFromPage(sourceUrl)

    if (!m3u8Url) {
      m3u8Url = await extractViaExternalApi(sourceUrl)
    }
  } else if (sourceUrl.includes('.m3u8')) {
    m3u8Url = sourceUrl
  } else {
    m3u8Url = await extractViaExternalApi(sourceUrl)
  }

  if (!m3u8Url) {
    return NextResponse.json({ error: 'Could not extract m3u8 URL' }, { status: 404 })
  }

  if (contentId) {
    const client = getDbClient()
    try {
      await client.connect()
      await cacheUrl(client, contentId, contentType, m3u8Url)
    } catch {} finally {
      await client.end()
    }
  }

  if (searchParams.get('format') === 'json') {
    return NextResponse.json({ m3u8: m3u8Url, expires_at: parseTokenExpiry(m3u8Url).toISOString() })
  }

  return NextResponse.redirect(m3u8Url, 302)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  })
}
