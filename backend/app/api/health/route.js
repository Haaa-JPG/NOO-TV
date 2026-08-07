import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ status: 'error', reason: 'Supabase not configured' }, { status: 500, headers: CORS_HEADERS })
  }

  try {
    const [pending, processing, completed, failed] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    ])

    const [totalEp, readyEp] = await Promise.all([
      supabase.from('episodes').select('*', { count: 'exact', head: true }),
      supabase.from('episodes').select('*', { count: 'exact', head: true }).eq('stream_status', 'completed'),
    ])

    let workerOnline = false
    let workerStatus = 'unknown'
    let workerLastSeen = null
    try {
      const { data: hb } = await supabase
        .from('worker_heartbeat')
        .select('last_seen, status')
        .eq('id', 'main')
        .single()

      if (hb) {
        workerLastSeen = hb.last_seen
        workerStatus = hb.status || 'unknown'
        const lastSeenTime = new Date(hb.last_seen).getTime()
        workerOnline = (Date.now() - lastSeenTime) < 120000
      }
    } catch {}

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      worker: {
        online: workerOnline,
        status: workerStatus,
        last_seen: workerLastSeen,
      },
      queue: {
        pending: pending.count || 0,
        processing: processing.count || 0,
        completed: completed.count || 0,
        failed: failed.count || 0,
      },
      episodes: {
        total: totalEp.count || 0,
        ready: readyEp.count || 0,
      },
    }, { headers: CORS_HEADERS })
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      reason: err.message,
    }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
