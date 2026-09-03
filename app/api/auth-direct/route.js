import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'
import { isValidEmail, sanitizeText } from '@/lib/security'

export async function POST(request) {
  let client
  try {
    maybeCleanup()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`auth-direct:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة' }, { status: 429 })
    }

    const { email, password, displayName } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'كلمة المرور طويلة جداً' }, { status: 400 })
    }

    client = getDbClient()
    await client.connect()

    const safeName = sanitizeText(displayName || '', 100)

    const result = await client.query(
      `SELECT public.direct_signup($1, $2, $3)`,
      [email, password, safeName]
    )
    const data = result.rows[0].direct_signup

    if (data.error) {
      console.error('Direct signup error:', data.error)
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      user: { id: data.id, email: data.email },
      message: 'تم إنشاء الحساب بنجاح'
    })
  } catch (err) {
    console.error('Auth API error:', err)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}
