import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'

export async function GET() {
  let client
  try {
    client = getDbClient()
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
