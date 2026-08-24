import { Client } from 'pg'

export function getDbClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured')
  return new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  })
}
