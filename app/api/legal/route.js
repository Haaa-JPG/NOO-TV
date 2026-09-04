import { NextResponse } from 'next/server'
import { getDbClient } from '@/lib/db'

export async function GET() {
  let client
  try {
    client = getDbClient()
    await client.connect()
    const result = await client.query(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('legal_disclaimer', 'legal_privacy')`
    )
    const settings = {}
    for (const row of result.rows) {
      settings[row.setting_key] = row.setting_value || ''
    }
    return NextResponse.json({
      disclaimer: settings.legal_disclaimer || '',
      privacy: settings.legal_privacy || '',
    })
  } catch {
    return NextResponse.json({ disclaimer: '', privacy: '' })
  } finally {
    if (client) await client.end()
  }
}

export async function PUT(request) {
  let client
  try {
    const body = await request.json()
    if (!body.disclaimer && !body.privacy) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    client = getDbClient()
    await client.connect()

    if (body.disclaimer !== undefined) {
      await client.query(
        `INSERT INTO site_settings (setting_key, setting_value, value_type)
         VALUES ('legal_disclaimer', $1, 'text')
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
        [body.disclaimer]
      )
    }
    if (body.privacy !== undefined) {
      await client.query(
        `INSERT INTO site_settings (setting_key, setting_value, value_type)
         VALUES ('legal_privacy', $1, 'text')
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
        [body.privacy]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    if (client) await client.end()
  }
}
