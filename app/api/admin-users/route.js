import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  } catch { return null }
}

async function getAuthUser(request) {
  try {
    let token = null
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || ''
      const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
      if (tokenMatch) token = decodeURIComponent(tokenMatch[1])
    }
    if (!token) return null
    const payload = decodeJwtPayload(token)
    if (!payload || !payload.sub) return null
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return { id: payload.sub, email: payload.email || '' }
  } catch { return null }
}

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

    client = getDbClient()
    const { rows } = await client.query('SELECT role FROM public.users WHERE id = $1', [user.id])
    if (!rows.length || rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { action, email, password, displayName, userId } = await request.json()

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
