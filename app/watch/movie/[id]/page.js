import { getDbClient } from '@/lib/db'
import WatchMovieClient from './movie-watch-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { id } = params
  const client = getDbClient()
  try {
    await client.connect()
    const { rows } = await client.query(
      'SELECT title, description, thumbnail, year, language, quality, average_rating, views, category, is_translated, is_dubbed FROM movies WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return { title: 'فيلم غير موجود' }
    const m = rows[0]
    const title = m.title
    const desc = m.description || `شاهد ${title} (${m.year}) مجاناً بجودة عالية على NOO TV`
    const img = m.thumbnail
    const url = `https://noo-tv.vercel.app/watch/movie/${id}`

    return {
      title: `${title} ${m.year ? `(${m.year})` : ''}`,
      description: desc,
      keywords: [title, 'فيلم', 'مشاهدة مجاناً', m.year, m.language, m.category, 'مترجم', 'مدبلج', 'NOO TV'],
      openGraph: {
        title: `${title} | NOO TV`,
        description: desc,
        url,
        siteName: 'NOO TV',
        type: 'video.movie',
        images: img ? [{ url: img, width: 1200, height: 630, alt: title }] : [],
        locale: 'ar_SA',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | NOO TV`,
        description: desc,
        images: img ? [img] : [],
      },
      alternates: {
        canonical: url,
      },
    }
  } finally {
    await client.end()
  }
}

export default async function WatchMoviePage({ params }) {
  const { id } = params
  const client = getDbClient()
  let movie = null

  try {
    await client.connect()
    const { rows } = await client.query('SELECT * FROM movies WHERE id = $1', [id])
    if (rows.length > 0) movie = rows[0]
  } finally {
    await client.end()
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">الفيلم غير موجود</div>
      </div>
    )
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.description || '',
    image: movie.thumbnail,
    url: `https://noo-tv.vercel.app/watch/movie/${id}`,
    dateCreated: movie.year ? `${movie.year}-01-01` : undefined,
    inLanguage: movie.language,
    genre: movie.category,
    aggregateRating: movie.average_rating ? {
      '@type': 'AggregateRating',
      ratingValue: movie.average_rating,
      bestRating: 5,
      ratingCount: movie.views || 1,
    } : undefined,
    potentialAction: {
      '@type': 'WatchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `https://noo-tv.vercel.app/watch/movie/${id}`,
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WatchMovieClient />
    </>
  )
}
