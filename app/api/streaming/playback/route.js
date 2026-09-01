import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { getAuthUser } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

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
    const table = contentType === 'movie' ? 'public.movies' : 'public.episodes'

    const { rows } = await pool.query(
      `SELECT id, embed_url, extracted_m3u8_url, extracted_m3u8_expires FROM ${table} WHERE id = $1 AND is_active = TRUE`,
      [contentId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'المحتوى غير موجود' }, { status: 404 })
    }

    const content = rows[0]

    // 1. Return cached m3u8 if still valid
    if (content.extracted_m3u8_url && content.extracted_m3u8_expires) {
      if (new Date(content.extracted_m3u8_expires) > new Date()) {
        return NextResponse.json({ url: content.extracted_m3u8_url, source_name: 'cached', expires_at: content.extracted_m3u8_expires })
      }
    }

    // 2. Try streaming API if configured
    if (content.embed_url && process.env.STREAMING_API_URL) {
      try {
        const apiKey = process.env.STREAMING_API_KEY
        const baseUrl = process.env.STREAMING_API_URL.replace(/\/+$/, '')
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

        const res = await fetch(`${baseUrl}/playback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content_id: contentId,
            content_type: contentType,
            source_url: content.embed_url,
          }),
          signal: AbortSignal.timeout(120000),
        })

        const data = await res.json()
        if (res.ok && data.url) {
          await pool.query(
            `UPDATE ${table} SET extracted_m3u8_url = $1, extracted_m3u8_expires = $2, active_stream_url = $1, last_refreshed = NOW(), stream_status = 'active' WHERE id = $3`,
            [data.url, data.expires_at || new Date(Date.now() + 12 * 3600 * 1000).toISOString(), contentId]
          )
          return NextResponse.json({ url: data.url, source_name: 'streaming-api', expires_at: data.expires_at })
        }
      } catch {}
    }

    // 3. Return the raw embed URL — VideoPlayer SourceExtracting will handle extraction
    if (content.embed_url) {
      return NextResponse.json({ url: content.embed_url, source_name: 'embed' })
    }

    return NextResponse.json({ error: 'لا يوجد رابط تضمين' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
