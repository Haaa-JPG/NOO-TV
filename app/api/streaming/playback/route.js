import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { getAuthUser } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

let scrapeModule = null
async function getScraper() {
  if (!scrapeModule) {
    scrapeModule = await import('@/scripts/scraper')
  }
  return scrapeModule
}

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-playback:${ip}`, 30, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('content_id')
    const contentType = searchParams.get('content_type')

    if (!contentId || !contentType) {
      return NextResponse.json({ error: 'content_id و content_type مطلوبان' }, { status: 400 })
    }

    if (!['movie', 'episode'].includes(contentType)) {
      return NextResponse.json({ error: 'نوع المحتوى غير صحيح' }, { status: 400 })
    }

    const pool = getDbClient()

    let contentUrl = null
    let activeStreamUrl = null

    if (contentType === 'movie') {
      const { rows } = await pool.query(
        `SELECT id, embed_url, active_stream_url, extracted_m3u8_url, extracted_m3u8_expires FROM public.movies WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'المحتوى غير موجود' }, { status: 404 })
      }
      contentUrl = rows[0].embed_url
      activeStreamUrl = rows[0].extracted_m3u8_url || rows[0].active_stream_url
      if (activeStreamUrl && rows[0].extracted_m3u8_expires) {
        if (new Date(rows[0].extracted_m3u8_expires) > new Date()) {
          return NextResponse.json({ url: activeStreamUrl, source_name: 'cached' })
        }
      }
    } else if (contentType === 'episode') {
      const { rows } = await pool.query(
        `SELECT id, embed_url, active_stream_url, extracted_m3u8_url, extracted_m3u8_expires FROM public.episodes WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'المحتوى غير موجود' }, { status: 404 })
      }
      contentUrl = rows[0].embed_url
      activeStreamUrl = rows[0].extracted_m3u8_url || rows[0].active_stream_url
      if (activeStreamUrl && rows[0].extracted_m3u8_expires) {
        if (new Date(rows[0].extracted_m3u8_expires) > new Date()) {
          return NextResponse.json({ url: activeStreamUrl, source_name: 'cached' })
        }
      }
    }

    if (!contentUrl) {
      return NextResponse.json({ error: 'لا يوجد رابط تضمين لهذا المحتوى' }, { status: 404 })
    }

    const { isSourceUrl, scrapeM3u8 } = await getScraper()

    if (!isSourceUrl(contentUrl)) {
      return NextResponse.json({ url: contentUrl, source_name: 'direct' })
    }

    try {
      const result = await scrapeM3u8(contentUrl, { timeout: 90000 })

      if (result.m3u8Url) {
        const table = contentType === 'movie' ? 'public.movies' : 'public.episodes'
        await pool.query(
          `UPDATE ${table}
           SET extracted_m3u8_url = $1, extracted_m3u8_expires = $2, active_stream_url = $1, last_refreshed = NOW(), stream_status = 'active'
           WHERE id = $3`,
          [result.m3u8Url, result.expiresAt, contentId]
        )

        return NextResponse.json({
          url: result.m3u8Url,
          source_name: 'extracted',
          expires_at: result.expiresAt,
        })
      }
    } catch (extractErr) {
      console.error('Local extraction failed:', extractErr.message)
    }

    if (contentUrl) {
      return NextResponse.json({ url: contentUrl, source_name: 'embed' })
    }

    return NextResponse.json({ error: 'فشل استخراج رابط الفيديو' }, { status: 502 })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
