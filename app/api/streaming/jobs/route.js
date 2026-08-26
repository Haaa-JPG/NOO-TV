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
    if (!checkRateLimit(`streaming-jobs:${ip}`, 30, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('source_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const client = getDbClient()
    await client.connect()
    try {
      let query = `SELECT sj.*, ss.name as source_name
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

      const { rows } = await client.query(query, params)
      return NextResponse.json({ jobs: rows })
    } finally {
      await client.end()
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
