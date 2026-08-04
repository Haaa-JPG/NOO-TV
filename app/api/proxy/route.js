import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    new URL(targetUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(targetUrl).origin,
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, {
        status: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    }

    const contentType = response.headers.get('content-type') || ''
    const isM3u8 = contentType.includes('mpegurl') || contentType.includes('m3u8') || /\.m3u8(\?.*)?$/i.test(targetUrl)

    if (isM3u8) {
      const text = await response.text()
      const rewritten = rewriteM3u8(text, targetUrl)
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

    if (contentType) headers.set('Content-Type', contentType)
    const contentLength = response.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)
    const contentRange = response.headers.get('content-range')
    if (contentRange) headers.set('Content-Range', contentRange)
    const acceptRanges = response.headers.get('accept-ranges')
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges)

    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy failed', details: error.message }, { status: 500 })
  }
}

function rewriteM3u8(content, baseUrl) {
  const base = new URL(baseUrl)
  const lines = content.split('\n')

  return lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line

    if (trimmed.startsWith('/api/proxy?url=')) return line

    let segmentUrl
    try {
      segmentUrl = new URL(trimmed, base)
    } catch {
      return line
    }

    const proxyUrl = `/api/proxy?url=${encodeURIComponent(segmentUrl.href)}`
    return proxyUrl
  }).join('\n')
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
