import pg from 'pg'
const { Pool } = pg

let pool = null

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not configured')
    pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message)
    })
  }
  return pool
}

export function getDbClient() {
  return getPool()
}

export async function withDb(fn) {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
