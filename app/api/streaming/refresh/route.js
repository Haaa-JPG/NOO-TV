import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

async function getAuthUser(request) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const cookieHeader = request.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
    if (!tokenMatch) return null
    const { data, error } = await supabaseAdmin.auth.getUser(decodeURIComponent(tokenMatch[1]))
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-refresh:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { source_id, content_id, content_type } = await request.json()
    if (!source_id || !content_id || !content_type) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const client = getDbClient()
    await client.connect()
    try {
      // Verify source exists and is active
      const { rows: sources } = await client.query(
        `SELECT * FROM public.streaming_sources WHERE id = $1 AND is_active = TRUE`,
        [source_id]
      )
      if (sources.length === 0) {
        return NextResponse.json({ error: 'المصدر غير موجود أو غير نشط' }, { status: 404 })
      }

      // Check for existing active job
      const { rows: existing } = await client.query(
        `SELECT id FROM public.streaming_jobs
         WHERE source_id = $1 AND content_id = $2 AND content_type = $3
         AND status IN ('pending', 'processing')`,
        [source_id, content_id, content_type]
      )
      if (existing.length > 0) {
        return NextResponse.json({ error: 'يوجد مهمة نشطة بالفعل لهذا المحتوى' }, { status: 409 })
      }

      // Create refresh job
      const { rows } = await client.query(
        `INSERT INTO public.streaming_jobs (source_id, content_id, content_type, job_type, status)
         VALUES ($1, $2, $3, 'refresh', 'pending')
         RETURNING *`,
        [source_id, content_id, content_type]
      )

      return NextResponse.json({ job: rows[0] })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
