import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const M3U8_REGEX = /(?:https?:)?\/\/[^\s"'<>]*\.m3u8(?:\?[^\s"'<>]*)?/gi

function parseToken(url) {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url)
    const s = parseInt(u.searchParams.get('s'))
    const e = parseInt(u.searchParams.get('e'))
    if (!s || !e) return null
    const expiresAt = s + e
    const now = Math.floor(Date.now() / 1000)
    const remaining = expiresAt - now
    return { expiresAt, remaining, expired: remaining <= 0, urgent: remaining > 0 && remaining < 3600 }
  } catch {
    return null
  }
}

function extractM3u8FromHtml(html) {
  if (!html) return null
  const matches = html.match(M3U8_REGEX)
  if (!matches || matches.length === 0) return null
  let best = null
  let bestScore = -1
  for (let raw of matches) {
    let url = raw.replace(/["'`]/g, '')
    if (url.startsWith('//')) url = 'https:' + url
    if (!url.startsWith('http')) continue
    try {
      const u = new URL(url)
      let score = 0
      if (u.searchParams.has('s')) score += 3
      if (u.searchParams.has('e')) score += 3
      if (u.searchParams.has('t')) score += 2
      if (u.searchParams.has('v')) score += 1
      if (u.searchParams.has('sp')) score += 1
      if (u.searchParams.has('i')) score += 1
      if (score > bestScore) {
        bestScore = score
        best = url
      }
    } catch {}
  }
  return best
}

async function fetchFreshM3u8(embedUrl) {
  try {
    const resp = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        'Referer': 'https://qrmzi.tv/',
      },
      redirect: 'follow',
    })
    if (!resp.ok) return null
    const html = await resp.text()
    return extractM3u8FromHtml(html)
  } catch {
    return null
  }
}

async function refreshIfNeeded(table, id, currentUrl) {
  const token = parseToken(currentUrl)
  if (token && !token.expired && !token.urgent) return currentUrl

  try {
    const { data: record } = await supabaseAdmin
      .from(table)
      .select('embed_url')
      .eq('id', id)
      .single()
    if (!record?.embed_url) return currentUrl

    const freshUrl = await fetchFreshM3u8(record.embed_url)
    if (freshUrl && freshUrl !== currentUrl) {
      await supabaseAdmin.rpc('update_embed_url', {
        p_table: table,
        p_id: id,
        p_new_url: freshUrl,
      })
      return freshUrl
    }
  } catch {}
  return currentUrl
}

function rewriteM3u8Segments(content, baseUrl) {
  const base = new URL(baseUrl)
  return content.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    if (trimmed.startsWith('/api/proxy?')) return line
    try {
      const segUrl = new URL(trimmed, base)
      return `/api/proxy?url=${encodeURIComponent(segUrl.href)}`
    } catch {
      return line
    }
  }).join('\n')
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')
  const contentId = searchParams.get('id')
  const contentType = searchParams.get('type')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try { new URL(targetUrl) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const table = contentType === 'movie' ? 'movies' : 'episodes'
  let finalUrl = targetUrl

  if (contentId && contentType) {
    finalUrl = await refreshIfNeeded(table, contentId, targetUrl)
  }

  try {
    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://qrmzi.tv/',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, {
        status: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    }

    const ct = response.headers.get('content-type') || ''
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8(\?.*)?$/i.test(finalUrl)

    if (isM3u8) {
      const text = await response.text()
      const rewritten = rewriteM3u8Segments(text, finalUrl)
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    const body = await response.arrayBuffer()
    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'public, max-age=3600')
    if (ct) headers.set('Content-Type', ct)
    const cl = response.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    const cr = response.headers.get('content-range')
    if (cr) headers.set('Content-Range', cr)
    const ar = response.headers.get('accept-ranges')
    if (ar) headers.set('Accept-Ranges', ar)

    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy failed', details: error.message }, { status: 500 })
  }
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
