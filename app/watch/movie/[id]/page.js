import { getDbClient } from '@/lib/db'
import WatchMovieClient from './movie-watch-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { id } = params
  if (!process.env.DATABASE_URL) return { title: 'NOO TV' }
  const client = getDbClient()
  try {
    await client.connect()
    const { rows } = await client.query(
      'SELECT title, description, thumbnail, year, language, quality, average_rating, views, category FROM movies WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return { title: 'فيلم غير موجود' }
    const m = rows[0]
    const desc = m.description || `شاهد ${m.title} (${m.year}) مجاناً بجودة عالية على NOO TV`
    return {
      title: `${m.title} ${m.year ? `(${m.year})` : ''}`,
      description: desc,
      keywords: [m.title, 'فيلم', 'مشاهدة مجاناً', m.year, m.language, m.category, 'NOO TV'],
      openGraph: {
        title: `${m.title} | NOO TV`,
        description: desc,
        url: `https://noo-tv.vercel.app/watch/movie/${id}`,
        siteName: 'NOO TV',
        type: 'video.movie',
        images: m.thumbnail ? [{ url: m.thumbnail, width: 1200, height: 630, alt: m.title }] : [],
        locale: 'ar_SA',
      },
      twitter: { card: 'summary_large_image', title: `${m.title} | NOO TV`, description: desc },
      alternates: { canonical: `https://noo-tv.vercel.app/watch/movie/${id}` },
    }
  } finally {
    await client.end()
  }
}

export default function WatchMoviePage() {
  return <WatchMovieClient />
}
