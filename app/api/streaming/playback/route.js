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

    // Verify content exists and user can access it
    if (contentType === 'movie') {
      const { rows } = await pool.query(
        `SELECT id FROM public.movies WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'المحتوى غير موجود' }, { status: 404 })
      }
    } else if (contentType === 'episode') {
      const { rows } = await pool.query(
        `SELECT id FROM public.episodes WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'المحتوى غير موجود' }, { status: 404 })
      }
    }

    // Get embed_url from the content itself for direct extraction fallback
    let sourceUrl = null
    if (contentType === 'movie') {
      const { rows: movieRows } = await pool.query(
        `SELECT embed_url FROM public.movies WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      sourceUrl = movieRows[0]?.embed_url || null
    } else if (contentType === 'episode') {
      const { rows: epRows } = await pool.query(
        `SELECT embed_url FROM public.episodes WHERE id = $1 AND is_active = TRUE`,
        [contentId]
      )
      sourceUrl = epRows[0]?.embed_url || null
    }

    // Get active streaming sources for this content, ordered by priority
    const { rows: mappings } = await pool.query(
      `SELECT css.source_content_id, css.priority as content_priority,
              ss.id as source_id, ss.name as source_name, ss.api_base_url,
              ss.source_type, ss.health_status
       FROM public.content_streaming_sources css
       JOIN public.streaming_sources ss ON ss.id = css.source_id
       WHERE css.content_id = $1 AND css.content_type = $2
         AND css.is_active = TRUE AND ss.is_active = TRUE
       ORDER BY css.priority DESC, ss.priority DESC`,
      [contentId, contentType]
    )

    if (mappings.length === 0) {
      // No explicit mapping — try direct extraction if we have source_url and STREAMING_API_URL
      if (sourceUrl && process.env.STREAMING_API_URL) {
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
              source_url: sourceUrl,
            }),
            signal: AbortSignal.timeout(120000),
          })

          const data = await res.json()
          if (res.ok && data.url) {
            return NextResponse.json({
              url: data.url,
              source_name: 'direct',
              expires_at: data.expires_at || null,
            })
          }
        } catch {}
      }
      return NextResponse.json({ error: 'لا يوجد مصدر بث نشط لهذا المحتوى' }, { status: 404 })
    }

    // Try each source in priority order
    for (const mapping of mappings) {
      if (mapping.health_status === 'down') continue

      const apiKey = process.env.STREAMING_API_KEY
      const baseUrl = mapping.api_base_url.replace(/\/+$/, '')

      try {
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

        const res = await fetch(`${baseUrl}/playback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content_id: mapping.source_content_id || contentId,
            content_type: contentType,
            source_url: sourceUrl,
          }),
          signal: AbortSignal.timeout(120000),
        })

        const data = await res.json()

        if (res.ok && data.url) {
          await pool.query(
            `UPDATE public.streaming_sources
             SET total_requests = total_requests + 1, updated_at = NOW()
             WHERE id = $1`,
            [mapping.source_id]
          )

          return NextResponse.json({
            url: data.url,
            source_name: mapping.source_name,
            expires_at: data.expires_at || null,
          })
        }
      } catch {
        await pool.query(
          `UPDATE public.streaming_sources
           SET failed_requests = failed_requests + 1, total_requests = total_requests + 1,
               success_rate = CASE WHEN total_requests + 1 > 0
                 THEN ROUND((total_requests - failed_requests - 1)::numeric / (total_requests + 1) * 100, 2)
                 ELSE 0 END,
               updated_at = NOW()
           WHERE id = $1`,
          [mapping.source_id]
        )
        continue
      }
    }

    return NextResponse.json({ error: 'فشل جميع مصادر البث' }, { status: 502 })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
