import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { requireAdmin, safeSourceRows, safeSourceRow } from '@/lib/streaming-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const pool = getDbClient()
    const { rows } = await pool.query(
      `SELECT id, name, api_base_url, source_type, is_active, priority, config,
              last_health_check, health_status, success_rate, avg_response_ms,
              total_requests, failed_requests, created_at, updated_at
       FROM public.streaming_sources ORDER BY priority DESC, created_at ASC`
    )
    return NextResponse.json({ sources: safeSourceRows(rows) })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-sources:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { name, api_base_url, source_type, priority, config } = await request.json()
    if (!name || !api_base_url) {
      return NextResponse.json({ error: 'الاسم ورابط API مطلوبان' }, { status: 400 })
    }

    const safeName = name.replace(/<[^>]*>/g, '').substring(0, 100)
    const safeUrl = api_base_url.replace(/<[^>]*>/g, '').substring(0, 500)

    const pool = getDbClient()
    const { rows } = await pool.query(
      `INSERT INTO public.streaming_sources (name, api_base_url, source_type, priority, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, api_base_url, source_type, is_active, priority, config,
                 last_health_check, health_status, success_rate, avg_response_ms,
                 total_requests, failed_requests, created_at, updated_at`,
      [safeName, safeUrl, source_type || 'generic', priority || 0, JSON.stringify(config || {})]
    )
    return NextResponse.json({ source: safeSourceRow(rows[0]) })
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
    await pool.query(`DELETE FROM public.streaming_sources WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError === 'unauthenticated') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }
    if (authError === 'unauthorized') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { id, name, api_base_url, source_type, priority, is_active, config } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })

    const pool = getDbClient()
    const sets = []
    const params = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name.replace(/<[^>]*>/g, '').substring(0, 100)) }
    if (api_base_url !== undefined) { sets.push(`api_base_url = $${idx++}`); params.push(api_base_url.replace(/<[^>]*>/g, '').substring(0, 500)) }
    if (source_type !== undefined) { sets.push(`source_type = $${idx++}`); params.push(source_type) }
    if (priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(priority) }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(is_active) }
    if (config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(config)) }

    if (sets.length === 0) return NextResponse.json({ error: 'لا توجد تحديثات' }, { status: 400 })

    sets.push(`updated_at = NOW()`)
    params.push(id)

    const { rows } = await pool.query(
      `UPDATE public.streaming_sources SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, api_base_url, source_type, is_active, priority, config,
                 last_health_check, health_status, success_rate, avg_response_ms,
                 total_requests, failed_requests, created_at, updated_at`,
      params
    )
    return NextResponse.json({ source: safeSourceRow(rows[0]) })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
