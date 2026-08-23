import { NextResponse } from 'next/server'
import { Client } from 'pg'

const getClient = () => new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ykrslhhpjgfqkyutlxbx:Hashim.2001664933-2008@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
})

export async function POST(request) {
  let client
  try {
    const { email, password, displayName } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 })
    }

    client = getClient()
    await client.connect()

    const result = await client.query(
      `SELECT public.direct_signup($1, $2, $3)`,
      [email, password, displayName || '']
    )
    const data = result.rows[0].direct_signup

    if (data.error) {
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
