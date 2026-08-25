import { getDbClient } from '@/lib/db'

const SITE_URL = 'https://noo-tv.vercel.app'

export default async function sitemap() {
  const client = getDbClient()
  const entries = []

  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  })

  entries.push({
    url: `${SITE_URL}/series`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  })

  entries.push({
    url: `${SITE_URL}/complaints`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.3,
  })

  try {
    await client.connect()

    const { rows: movies } = await client.query(
      'SELECT id, title, updated_at FROM movies WHERE is_active = true ORDER BY created_at DESC LIMIT 5000'
    )
    for (const m of movies) {
      entries.push({
        url: `${SITE_URL}/watch/movie/${m.id}`,
        lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }

    const { rows: seriesList } = await client.query(
      'SELECT id, title, updated_at FROM series WHERE is_active = true ORDER BY created_at DESC LIMIT 5000'
    )
    for (const s of seriesList) {
      entries.push({
        url: `${SITE_URL}/series/${s.id}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })

      entries.push({
        url: `${SITE_URL}/watch/series/${s.id}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  } catch (err) {
    console.error('Sitemap generation error:', err)
  } finally {
    await client.end()
  }

  return entries
}
