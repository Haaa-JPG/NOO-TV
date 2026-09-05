import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'
import { sanitizeText, isCleanString } from '@/lib/security'

async function getAuthUser(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return null
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const cookieHeader = request.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
    if (!tokenMatch) return null
    const { data, error } = await supabaseAdmin.auth.getUser(decodeURIComponent(tokenMatch[1]))
    if (error || !data?.user) return null
    return data.user
  } catch { return null }
}

export async function GET(request) {
  let client
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 })
    }

    client = getDbClient()
    await client.connect()

    const result = await client.query(
      'SELECT slug, title, content, updated_at FROM pages WHERE slug = $1',
      [slug]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('GET /api/legal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}

export async function PUT(request) {
  let client
  try {
    maybeCleanup()
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: profile } = await supabaseAdmin
      .from('users').select('role').eq('id', user.id).maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { slug, title, content } = await request.json()
    if (!slug || !title || content === undefined) {
      return NextResponse.json({ error: 'slug, title, content required' }, { status: 400 })
    }

    const safeTitle = sanitizeText(title, 200)
    if (!isCleanString(content, 100000)) {
      return NextResponse.json({ error: 'المحتوى غير صحيح' }, { status: 400 })
    }
    const safeContent = content

    client = getDbClient()
    await client.connect()

    const result = await client.query(
      `INSERT INTO pages (slug, title, content, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (slug)
       DO UPDATE SET title = $2, content = $3, updated_at = NOW()
       RETURNING slug, title, content, updated_at`,
      [slug, safeTitle, safeContent]
    )

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/legal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}
