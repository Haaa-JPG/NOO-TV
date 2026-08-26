import { createClient } from '@supabase/supabase-js'

export async function getAuthUser(request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const cookieHeader = request.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
    if (!tokenMatch) return null
    const { data, error } = await supabaseAdmin.auth.getUser(decodeURIComponent(tokenMatch[1]))
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

export async function requireAdmin(request) {
  const user = await getAuthUser(request)
  if (!user) return { user: null, error: 'unauthenticated' }
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: profile } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).maybeSingle()
  if (!profile || profile.role !== 'admin') return { user: null, error: 'unauthorized' }
  return { user, error: null }
}

export function safeSourceRow(row) {
  if (!row) return null
  const { api_key, ...safe } = row
  return safe
}

export function safeSourceRows(rows) {
  return rows.map(safeSourceRow)
}
