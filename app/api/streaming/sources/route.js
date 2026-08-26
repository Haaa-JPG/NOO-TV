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

async function requireAdmin(request) {
  const user = await getAuthUser(request)
  if (!user) return null
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: profile } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).maybeSingle()
  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function GET(request) {
  try {
    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const client = getDbClient()
    await client.connect()
    try {
      const { rows } = await client.query(
        `SELECT * FROM public.streaming_sources ORDER BY priority DESC, created_at ASC`
      )
      return NextResponse.json({ sources: rows })
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
    if (!checkRateLimit(`streaming-sources:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { name, api_base_url, api_key, source_type, priority, config } = await request.json()
    if (!name || !api_base_url) {
      return NextResponse.json({ error: 'الاسم ورابط API مطلوبان' }, { status: 400 })
    }

    const safeName = name.replace(/<[^>]*>/g, '').substring(0, 100)
    const safeUrl = api_base_url.replace(/<[^>]*>/g, '').substring(0, 500)

    const client = getDbClient()
    await client.connect()
    try {
      const { rows } = await client.query(
        `INSERT INTO public.streaming_sources (name, api_base_url, api_key, source_type, priority, config)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [safeName, safeUrl, api_key || null, source_type || 'generic', priority || 0, JSON.stringify(config || {})]
      )
      return NextResponse.json({ source: rows[0] })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })

    const client = getDbClient()
    await client.connect()
    try {
      await client.query(`DELETE FROM public.streaming_sources WHERE id = $1`, [id])
      return NextResponse.json({ success: true })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { id, name, api_base_url, api_key, source_type, priority, is_active, config } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })

    const client = getDbClient()
    await client.connect()
    try {
      const sets = []
      const params = []
      let idx = 1

      if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name.replace(/<[^>]*>/g, '').substring(0, 100)) }
      if (api_base_url !== undefined) { sets.push(`api_base_url = $${idx++}`); params.push(api_base_url.replace(/<[^>]*>/g, '').substring(0, 500)) }
      if (api_key !== undefined) { sets.push(`api_key = $${idx++}`); params.push(api_key || null) }
      if (source_type !== undefined) { sets.push(`source_type = $${idx++}`); params.push(source_type) }
      if (priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(priority) }
      if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(is_active) }
      if (config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(config)) }

      if (sets.length === 0) return NextResponse.json({ error: 'لا توجد تحديثات' }, { status: 400 })

      sets.push(`updated_at = NOW()`)
      params.push(id)

      const { rows } = await client.query(
        `UPDATE public.streaming_sources SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      )
      return NextResponse.json({ source: rows[0] })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
