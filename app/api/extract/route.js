import { NextResponse } from 'next/server'

let scraper = null

async function getScraper() {
  if (!scraper) {
    scraper = await import('@/scripts/scraper')
  }
  return scraper
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
    }

    const { isSourceUrl, scrapeM3u8 } = await getScraper()

    if (!isSourceUrl(url)) {
      return NextResponse.json({ error: 'Unsupported source URL' }, { status: 400 })
    }

    const result = await scrapeM3u8(url, { timeout: 90000 })

    if (result.m3u8Url) {
      return NextResponse.json({ m3u8: result.m3u8Url, expires_at: result.expiresAt })
    }

    return NextResponse.json({ error: 'Extraction failed' }, { status: 502 })
  } catch (err) {
    console.error('Extract error:', err.message)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
