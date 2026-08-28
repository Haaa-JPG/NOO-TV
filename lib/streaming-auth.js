import { getDbClient } from './db'

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return payload
  } catch {
    return null
  }
}

export async function getAuthUser(request) {
  try {
    let token = null

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || ''
      const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
      if (tokenMatch) token = decodeURIComponent(tokenMatch[1])
    }

    if (!token) return null

    const payload = decodeJwtPayload(token)
    if (!payload || !payload.sub) return null

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    return { id: payload.sub, email: payload.email || '' }
  } catch {
    return null
  }
}

export async function requireAdmin(request) {
  const user = await getAuthUser(request)
  if (!user) return { user: null, error: 'unauthenticated' }

  const pool = getDbClient()
  const { rows } = await pool.query(
    'SELECT role FROM public.users WHERE id = $1',
    [user.id]
  )
  if (!rows.length || rows[0].role !== 'admin') {
    return { user: null, error: 'unauthorized' }
  }
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
