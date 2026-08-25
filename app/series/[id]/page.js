import { getDbClient } from '@/lib/db'
import SeriesDetailClient from './series-detail-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { id } = params
  if (!process.env.DATABASE_URL) return { title: 'NOO TV' }
  const client = getDbClient()
  try {
    await client.connect()
    const { rows } = await client.query(
      'SELECT title, description, thumbnail, banner, average_rating, views FROM series WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return { title: 'مسلسل غير موجود' }
    const s = rows[0]
    const desc = s.description || `شاهد ${s.title} مجاناً بجودة عالية على NOO TV`
    const img = s.banner || s.thumbnail
    return {
      title: s.title,
      description: desc,
      keywords: [s.title, 'مسلسل', 'مشاهدة مجاناً', 'مترجم', 'مدبلج', 'NOO TV'],
      openGraph: {
        title: `${s.title} | NOO TV`,
        description: desc,
        url: `https://noo-tv.vercel.app/series/${id}`,
        siteName: 'NOO TV',
        type: 'video.tv_show',
        images: img ? [{ url: img, width: 1200, height: 630, alt: s.title }] : [],
        locale: 'ar_SA',
      },
      twitter: { card: 'summary_large_image', title: `${s.title} | NOO TV`, description: desc },
      alternates: { canonical: `https://noo-tv.vercel.app/series/${id}` },
    }
  } finally {
    await client.end()
  }
}

export default async function SeriesDetailPage({ params }) {
  const { id } = params
  if (!process.env.DATABASE_URL) return <SeriesDetailClient />
  const client = getDbClient()
  let series = null
  let seasons = []
  let totalEpisodes = 0

  try {
    await client.connect()
    const { rows: seriesRows } = await client.query('SELECT * FROM series WHERE id = $1', [id])
    if (seriesRows.length > 0) {
      series = seriesRows[0]
      const { rows: seasonsRows } = await client.query(
        'SELECT * FROM seasons WHERE series_id = $1 AND is_active = true ORDER BY season_number ASC', [id]
      )
      seasons = seasonsRows
      if (seasons.length > 0) {
        const seasonIds = seasons.map(s => s.id)
        const { rows: epsRows } = await client.query(
          'SELECT COUNT(*)::int as count FROM episodes WHERE season_id = ANY($1) AND is_active = true', [seasonIds]
        )
        totalEpisodes = epsRows[0]?.count || 0
      }
    }
  } finally {
    await client.end()
  }

  const jsonLd = series ? {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: series.title,
    description: series.description || '',
    image: series.thumbnail || series.banner,
    url: `https://noo-tv.vercel.app/series/${id}`,
    aggregateRating: series.average_rating ? {
      '@type': 'AggregateRating',
      ratingValue: series.average_rating,
      bestRating: 10,
      ratingCount: series.views || 1,
    } : undefined,
    numberOfSeasons: seasons.length,
    numberOfEpisodes: totalEpisodes,
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SeriesDetailClient />
    </>
  )
}
