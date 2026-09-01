import { NextResponse } from 'next/server'

const ALLOWED_VIDEO_HOSTS = [
  'ujeklsj.site',
  'vid1.ujeklsj.site',
  'q-drama.com',
]

const PROXY_TIMEOUT = 15000

function isAllowedVideoHost(urlString) {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname.toLowerCase()
    return ALLOWED_VIDEO_HOSTS.some(host =>
      hostname === host || hostname.endsWith('.' + host)
    )
  } catch {
    return false
  }
}

function buildCorsHeaders(responseHeaders, isPreflight = false) {
  const headers = new Headers(responseHeaders)

  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, RANGE')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Content-Length, Accept-Ranges')
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type')
  headers.set('Access-Control-Max-Age', '86400')

  if (!isPreflight) {
    headers.set('Referrer-Policy', 'no-referrer')
  }

  return headers
}

export async function OPTIONS(request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl || !isAllowedVideoHost(targetUrl)) {
    return new NextResponse(null, { status: 403 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT)

    const response = await fetch(targetUrl, {
      method: 'OPTIONS',
      signal: controller.signal,
      headers: {
        'Origin': 'https://q-drama.com',
        'Referer': 'https://q-drama.com/',
        'Access-Control-Request-Method': request.headers.get('access-control-request-method') || 'GET',
        'Access-Control-Request-Headers': request.headers.get('access-control-request-headers') || 'Range',
      },
    })

    clearTimeout(timeout)

    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(response.headers, true),
    })
  } catch {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(new Headers(), true),
    })
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl || !isAllowedVideoHost(targetUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed video host' }, { status: 403 })
  }

  const range = request.headers.get('range')
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://q-drama.com/',
    'Origin': 'https://q-drama.com',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
  }

  if (range) {
    requestHeaders['Range'] = range
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT)

    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok && response.status !== 206) {
      return new NextResponse(null, {
        status: 502,
        headers: buildCorsHeaders(new Headers()),
      })
    }

    const headers = buildCorsHeaders(response.headers)

    const cl = response.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    const cr = response.headers.get('content-range')
    if (cr) headers.set('Content-Range', cr)
    const ar = response.headers.get('accept-ranges')
    if (ar) headers.set('Accept-Ranges', ar)
    const ct = response.headers.get('content-type')
    if (ct) headers.set('Content-Type', ct)
    const ce = response.headers.get('content-encoding')
    if (ce) headers.set('Content-Encoding', ce)

    if (!response.body) {
      return new NextResponse(null, { status: 204, headers })
    }

    return new Response(response.body, {
      status: range ? 206 : response.status,
      headers,
    })
  } catch {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 })
  }
}

export async function HEAD(request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl || !isAllowedVideoHost(targetUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed video host' }, { status: 403 })
  }

  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://q-drama.com/',
    'Origin': 'https://q-drama.com',
    'Accept': '*/*',
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT)

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      headers: requestHeaders,
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const headers = buildCorsHeaders(response.headers)

    const cl = response.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    const ar = response.headers.get('accept-ranges')
    if (ar) headers.set('Accept-Ranges', ar)
    const ct = response.headers.get('content-type')
    if (ct) headers.set('Content-Type', ct)

    return new Response(null, { status: response.status, headers })
  } catch {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 })
  }
}
