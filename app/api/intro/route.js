import { NextResponse } from 'next/server'
import { Client } from 'pg'

export async function GET() {
  let client
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ykrslhhpjgfqkyutlxbx:Hashim.2001664933-2008@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      ssl: { rejectUnauthorized: false }
    })
    await client.connect()
    const result = await client.query(
      `SELECT setting_value FROM site_settings WHERE setting_key = 'intro_video_url'`
    )
    const url = result.rows[0]?.setting_value || null
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ url: null })
  } finally {
    if (client) await client.end()
  }
}
