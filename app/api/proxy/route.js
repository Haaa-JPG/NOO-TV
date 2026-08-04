import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function parseToken(embedUrl) {
  if (!embedUrl) return null
  try {
    const u = new URL(embedUrl)
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

function extractFreshUrl(html) {
  if (!html) return null
  const patterns = [
    /(?:src|file|source)\s*[:=]\s*["']([^"']*\.m3u8[^"']*)/gi,
    /(https?:\/\/[^"'\s]*\.m3u8[^"'\s]*)/gi,
  ]
  for (const pat of patterns) {
    const match = pat.exec(html)
    if (match && match[1]) {
      let url = match[1]
      if (url.startsWith('//')) url = 'https:' + url
      else if (!url.startsWith('http')) continue
      try { new URL(url); return url } catch {}
    }
  }
  return null
}

async function refreshEmbedUrl(table, id) {
  try {
    const { data: record } = await supabaseAdmin
      .from(table)
      .select('embed_url')
      .eq('id', id)
      .single()
    if (!record?.embed_url) return null

    const htmlResp = await fetch(record.embed_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(record.embed_url).origin,
      },
      redirect: 'follow',
    })
    if (!htmlResp.ok) return null

    const contentType = htmlResp.headers.get('content-type') || ''
    if (contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      const text = await htmlResp.text()
      const freshUrl = extractFreshUrl(text) || record.embed_url
      await supabaseAdmin.rpc('update_embed_url', { p_table: table, p_id: id, p_new_url: freshUrl })
      return freshUrl
    }

    const html = await htmlResp.text()
    const freshUrl = extractFreshUrl(html)
    if (freshUrl && freshUrl !== record.embed_url) {
      await supabaseAdmin.rpc('update_embed_url', { p_table: table, p_id: id, p_new_url: freshUrl })
      return freshUrl
    }
    return null
  } catch {
    return null
  }
}

function rewriteM3u8(content, baseUrl) {
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

  const tokenInfo = parseToken(targetUrl)
  let finalUrl = targetUrl

  if (tokenInfo && (tokenInfo.expired || tokenInfo.urgent) && contentId && contentType) {
    const refreshed = await refreshEmbedUrl(contentType === 'movie' ? 'movies' : 'episodes', contentId)
    if (refreshed) finalUrl = refreshed
  }

  try {
    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(finalUrl).origin,
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
      const rewritten = rewriteM3u8(text, finalUrl)
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
