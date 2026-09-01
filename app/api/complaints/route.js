import { NextResponse } from 'next/server'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'
import { isValidEmail, sanitizeText } from '@/lib/security'

export async function POST(request) {
  try {
    maybeCleanup()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`complaint:${ip}`, 3, 300000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد 5 دقائق' }, { status: 429 })
    }

    const { email, subject, message } = await request.json()

    if (!email || !subject || !message) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
    }

    if (subject.length > 200) {
      return NextResponse.json({ error: 'الموضوع طويل جداً' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 })
    }

    const safeSubject = sanitizeText(subject, 200)
    const safeMessage = sanitizeText(message, 2000)
    const safeEmail = sanitizeText(email, 200)

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey
    )

    const { error } = await supabaseAdmin.from('complaints').insert({
      email: safeEmail,
      subject: safeSubject,
      message: safeMessage,
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Complaints API error:', err)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
