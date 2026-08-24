import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request) {
  let client
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`admin-users:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح' }, { status: 429 })
    }

    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { action, email, password, displayName, userId } = await request.json()

    client = getDbClient()
    await client.connect()

    if (action === 'create') {
      if (!email || !password) {
        return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 400 })
      }
      const safeName = (displayName || '').replace(/<[^>]*>/g, '').substring(0, 100)
      const result = await client.query(
        `SELECT public.direct_signup($1, $2, $3)`,
        [email, password, safeName]
      )
      const data = result.rows[0].direct_signup
      if (data.error) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, user: { id: data.id, email: data.email } })
    }

    if (action === 'delete') {
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
      }
      await client.query('BEGIN')
      await client.query(`DELETE FROM public.users WHERE id = $1`, [userId])
      await client.query(`DELETE FROM auth.identities WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId])
      await client.query('COMMIT')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Admin users API error:', err)
    if (client) {
      try { await client.query('ROLLBACK') } catch {}
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}

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
