import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { requireAdmin } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-refresh:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { source_id, content_id, content_type } = await request.json()
    if (!source_id || !content_id || !content_type) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!['movie', 'episode'].includes(content_type)) {
      return NextResponse.json({ error: 'نوع المحتوى غير صحيح' }, { status: 400 })
    }

    const pool = getDbClient()

    // Verify source exists and is active
    const { rows: sources } = await pool.query(
      `SELECT id FROM public.streaming_sources WHERE id = $1 AND is_active = TRUE`,
      [source_id]
    )
    if (sources.length === 0) {
      return NextResponse.json({ error: 'المصدر غير موجود أو غير نشط' }, { status: 404 })
    }

    // Check for existing active job
    const { rows: existing } = await pool.query(
      `SELECT id FROM public.streaming_jobs
       WHERE source_id = $1 AND content_id = $2 AND content_type = $3
       AND status IN ('pending', 'processing')`,
      [source_id, content_id, content_type]
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'يوجد مهمة نشطة بالفعل لهذا المحتوى' }, { status: 409 })
    }

    // Create refresh job
    const { rows } = await pool.query(
      `INSERT INTO public.streaming_jobs (source_id, content_id, content_type, job_type, status)
       VALUES ($1, $2, $3, 'refresh', 'pending')
       RETURNING id, source_id, content_id, content_type, job_type, status, created_at`,
      [source_id, content_id, content_type]
    )

    return NextResponse.json({ job: rows[0] })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
