import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`complaint:${ip}`, 3, 300000)) {
      return NextResponse.json({ error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد 5 دقائق' }, { status: 429 })
    }

    const { email, subject, message } = await request.json()

    if (!email || !subject || !message) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
    }

    if (subject.length > 200) {
      return NextResponse.json({ error: 'الموضوع طويل جداً' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 })
    }

    const safeSubject = subject.replace(/<[^>]*>/g, '').substring(0, 200)
    const safeMessage = message.replace(/<[^>]*>/g, '').substring(0, 2000)
    const safeEmail = email.replace(/<[^>]*>/g, '').substring(0, 200)

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
