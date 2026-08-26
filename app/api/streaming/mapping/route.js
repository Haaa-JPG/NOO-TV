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

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-mapping:${ip}`, 20, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const contentId = searchParams.get('content_id')
    const contentType = searchParams.get('content_type')

    if (!contentId || !contentType) {
      return NextResponse.json({ error: 'content_id و content_type مطلوبان' }, { status: 400 })
    }

    const client = getDbClient()
    await client.connect()
    try {
      const { rows } = await client.query(
        `SELECT css.*, ss.name as source_name, ss.api_base_url, ss.source_type, ss.health_status
         FROM public.content_streaming_sources css
         JOIN public.streaming_sources ss ON ss.id = css.source_id
         WHERE css.content_id = $1 AND css.content_type = $2
         ORDER BY css.priority DESC, ss.priority DESC`,
        [contentId, contentType]
      )
      return NextResponse.json({ mappings: rows })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`streaming-mapping:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { content_id, content_type, source_id, source_content_id, priority } = await request.json()
    if (!content_id || !content_type || !source_id) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const client = getDbClient()
    await client.connect()
    try {
      // Verify source exists
      const { rows: sources } = await client.query(
        `SELECT id FROM public.streaming_sources WHERE id = $1`,
        [source_id]
      )
      if (sources.length === 0) {
        return NextResponse.json({ error: 'المصدر غير موجود' }, { status: 404 })
      }

      // Upsert mapping
      const { rows } = await client.query(
        `INSERT INTO public.content_streaming_sources (content_id, content_type, source_id, source_content_id, priority)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (content_id, content_type, source_id) WHERE is_active = TRUE
         DO UPDATE SET source_content_id = EXCLUDED.source_content_id, priority = EXCLUDED.priority
         RETURNING *`,
        [content_id, content_type, source_id, source_content_id || null, priority || 0]
      )
      return NextResponse.json({ mapping: rows[0] })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })

    const client = getDbClient()
    await client.connect()
    try {
      await client.query(`DELETE FROM public.content_streaming_sources WHERE id = $1`, [id])
      return NextResponse.json({ success: true })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
