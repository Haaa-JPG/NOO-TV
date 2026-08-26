import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('content_id')
    const contentType = searchParams.get('content_type')

    if (!contentId || !contentType) {
      return NextResponse.json({ error: 'content_id و content_type مطلوبان' }, { status: 400 })
    }

    const client = getDbClient()
    await client.connect()
    try {
      // Get active streaming sources for this content, ordered by priority
      const { rows: mappings } = await client.query(
        `SELECT css.source_content_id, css.priority as content_priority,
                ss.id as source_id, ss.name as source_name, ss.api_base_url,
                ss.api_key, ss.source_type, ss.health_status, ss.is_active
         FROM public.content_streaming_sources css
         JOIN public.streaming_sources ss ON ss.id = css.source_id
         WHERE css.content_id = $1 AND css.content_type = $2
           AND css.is_active = TRUE AND ss.is_active = TRUE
         ORDER BY css.priority DESC, ss.priority DESC`,
        [contentId, contentType]
      )

      if (mappings.length === 0) {
        return NextResponse.json({ error: 'لا يوجد مصدر بث نشط لهذا المحتوى' }, { status: 404 })
      }

      // Try each source in priority order
      for (const mapping of mappings) {
        if (mapping.health_status === 'down') continue

        const apiKey = mapping.api_key || process.env.STREAMING_API_KEY
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
            }),
            signal: AbortSignal.timeout(30000),
          })

          const data = await res.json()

          if (res.ok && data.url) {
            // Log successful request
            await client.query(
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
        } catch (err) {
          // Log failed request for this source
          await client.query(
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
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
