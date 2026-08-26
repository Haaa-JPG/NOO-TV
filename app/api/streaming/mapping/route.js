import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { requireAdmin } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-mapping:${ip}`, 20, 60000)) {
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
    const contentId = searchParams.get('content_id')
    const contentType = searchParams.get('content_type')

    if (!contentId || !contentType) {
      return NextResponse.json({ error: 'content_id و content_type مطلوبان' }, { status: 400 })
    }

    const pool = getDbClient()
    const { rows } = await pool.query(
      `SELECT css.id, css.content_id, css.content_type, css.source_id, css.source_content_id,
              css.is_active, css.priority, css.created_at,
              ss.name as source_name, ss.source_type, ss.health_status
       FROM public.content_streaming_sources css
       JOIN public.streaming_sources ss ON ss.id = css.source_id
       WHERE css.content_id = $1 AND css.content_type = $2
       ORDER BY css.priority DESC, ss.priority DESC`,
      [contentId, contentType]
    )
    return NextResponse.json({ mappings: rows })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-mapping:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { content_id, content_type, source_id, source_content_id, priority } = await request.json()
    if (!content_id || !content_type || !source_id) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!['movie', 'episode'].includes(content_type)) {
      return NextResponse.json({ error: 'نوع المحتوى غير صحيح' }, { status: 400 })
    }

    const pool = getDbClient()

    // Verify source exists
    const { rows: sources } = await pool.query(
      `SELECT id FROM public.streaming_sources WHERE id = $1`,
      [source_id]
    )
    if (sources.length === 0) {
      return NextResponse.json({ error: 'المصدر غير موجود' }, { status: 404 })
    }

    // Upsert mapping
    const { rows } = await pool.query(
      `INSERT INTO public.content_streaming_sources (content_id, content_type, source_id, source_content_id, priority)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (content_id, content_type, source_id) WHERE is_active = TRUE
       DO UPDATE SET source_content_id = EXCLUDED.source_content_id, priority = EXCLUDED.priority
       RETURNING id, content_id, content_type, source_id, source_content_id, is_active, priority, created_at`,
      [content_id, content_type, source_id, source_content_id || null, priority || 0]
    )
    return NextResponse.json({ mapping: rows[0] })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })

    const pool = getDbClient()
    await pool.query(`DELETE FROM public.content_streaming_sources WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
