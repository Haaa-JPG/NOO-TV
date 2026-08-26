import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { requireAdmin } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-jobs:${ip}`, 30, 60000)) {
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const pool = getDbClient()
    let query = `SELECT sj.id, sj.source_id, sj.content_id, sj.content_type, sj.job_type,
                        sj.status, sj.error_message, sj.attempts, sj.created_at,
                        ss.name as source_name
                 FROM public.streaming_jobs sj
                 LEFT JOIN public.streaming_sources ss ON ss.id = sj.source_id`
    const params = []
    const conditions = []

    if (sourceId) {
      params.push(sourceId)
      conditions.push(`sj.source_id = $${params.length}`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    params.push(limit)
    query += ` ORDER BY sj.created_at DESC LIMIT $${params.length}`

    const { rows } = await pool.query(query, params)
    return NextResponse.json({ jobs: rows })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
