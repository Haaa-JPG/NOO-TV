import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { requireAdmin } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-health:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('source_id')
    if (!sourceId) return NextResponse.json({ error: 'source_id مطلوب' }, { status: 400 })

    const pool = getDbClient()
    const { rows: sources } = await pool.query(
      `SELECT id, api_base_url, source_type FROM public.streaming_sources WHERE id = $1`,
      [sourceId]
    )
    if (sources.length === 0) {
      return NextResponse.json({ error: 'المصدر غير موجود' }, { status: 404 })
    }

    const source = sources[0]
    const apiKey = process.env.STREAMING_API_KEY
    const baseUrl = source.api_base_url.replace(/\/+$/, '') + '/health'
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const start = Date.now()
    let status = 'down'
    try {
      const res = await fetch(baseUrl, { headers, signal: AbortSignal.timeout(10000) })
      status = res.ok ? 'healthy' : 'degraded'
    } catch {
      status = 'down'
    }
    const elapsed = Date.now() - start

    await pool.query(
      `UPDATE public.streaming_sources
       SET health_status = $1, last_health_check = NOW(), avg_response_ms = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, elapsed, sourceId]
    )

    return NextResponse.json({ status, elapsed_ms: elapsed })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
