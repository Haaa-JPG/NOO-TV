import { NextResponse } from 'next/server'
import { Client } from 'pg'

const getClient = () => new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export async function POST(request) {
  let client
  try {
    const { action, email, password, displayName, userId } = await request.json()

    client = getClient()
    await client.connect()

    if (action === 'create') {
      if (!email || !password) {
        return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 })
      }
      const result = await client.query(
        `SELECT public.direct_signup($1, $2, $3)`,
        [email, password, displayName || '']
      )
      const data = result.rows[0].direct_signup
      if (data.error) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, user: { id: data.id, email: data.email } })
    }

    if (action === 'delete') {
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 })
      }
      await client.query(`DELETE FROM public.users WHERE id = $1`, [userId])
      await client.query(`DELETE FROM auth.identities WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Admin users API error:', err)
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}
