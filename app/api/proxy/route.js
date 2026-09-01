import { NextResponse } from 'next/server'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'

const ALLOWED_HOSTS = [
  'cdnz.quest',
  'cdnwistia.com',
  'wistia.ostrovok.ru',
  'vid.ytimg',
  'i.ytimg.com',
  's.muxcdn.com',
  'test-streams.mux.dev',
  'cph-p2p-msl.akamaized.net',
  '.cloudfront.net',
  '.akamaized.net',
  '.cdn77.org',
  '.bunnycdn.com',
  '.hwcdn.net',
  '.fastly.net',
  '.stackpathdns.com',
  'ujeklsj.site',
]

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^::1$/,
  /^\[::1\]$/,
]

const PROXY_TIMEOUT = 30000

function isAllowedUrl(urlString) {
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const hostname = url.hostname.toLowerCase()
    for (const blocked of BLOCKED_IP_RANGES) {
      if (blocked.test(hostname)) return false
    }
    for (const host of ALLOWED_HOSTS) {
      if (host.startsWith('.')) {
        if (hostname.endsWith(host) || hostname === host.slice(1)) return true
      } else {
        if (hostname === host || hostname.endsWith('.' + host)) return true
      }
    }
    return false
  } catch {
    return false
  }
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
  let client
  try {
    maybeCleanup()
    const { searchParams } = new URL(request.url)
    const targetUrl = searchParams.get('url')

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`proxy:${ip}`, 60, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    if (!isAllowedUrl(targetUrl)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT)

    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': new URL(targetUrl).origin,
    }
    const range = request.headers.get('range')
    if (range) requestHeaders['Range'] = range

    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return new NextResponse(null, {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const ct = response.headers.get('content-type') || ''
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8(\?.*)?$/i.test(targetUrl)
    const isVideo = ct.includes('video/') || /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(targetUrl)

    if (isM3u8) {
      const text = await response.text()
      const rewritten = rewriteM3u8Segments(text, targetUrl)
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', '*')
    if (ct) headers.set('Content-Type', ct)
    const cl = response.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    const cr = response.headers.get('content-range')
    if (cr) headers.set('Content-Range', cr)
    const ar = response.headers.get('accept-ranges')
    if (ar) headers.set('Accept-Ranges', ar)

    if (isVideo && response.body) {
      return new NextResponse(response.body, {
        status: range ? 206 : 200,
        headers,
      })
    }

    const body = await response.arrayBuffer()
    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Proxy timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 })
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
