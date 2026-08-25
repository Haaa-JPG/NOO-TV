import { getDbClient } from '@/lib/db'
import WatchSeriesClient from './series-watch-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params, searchParams }) {
  const { id } = params
  const sp = searchParams
  const client = getDbClient()
  try {
    await client.connect()
    const { rows } = await client.query(
      'SELECT title, description, thumbnail, average_rating, views, category, is_translated, is_dubbed FROM series WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return { title: 'مسلسل غير موجود' }
    const s = rows[0]

    let epTitle = ''
    if (sp?.episode) {
      const { rows: epRows } = await client.query(
        'SELECT title, episode_number FROM episodes WHERE id = $1',
        [sp.episode]
      )
      if (epRows.length > 0) {
        epTitle = epRows[0].title || `الحلقة ${epRows[0].episode_number}`
      }
    }

    const title = epTitle ? `${s.title} - ${epTitle}` : s.title
    const desc = s.description || `شاهد ${s.title} مجاناً بجودة عالية على NOO TV`
    const img = s.thumbnail
    const url = `https://noo-tv.vercel.app/watch/series/${id}`

    return {
      title,
      description: desc,
      keywords: [s.title, epTitle, 'مسلسل', 'مشاهدة مجاناً', 'مترجم', 'مدبلج', 'NOO TV', s.category].filter(Boolean),
      openGraph: {
        title: `${title} | NOO TV`,
        description: desc,
        url,
        siteName: 'NOO TV',
        type: 'video.episode',
        images: img ? [{ url: img, width: 1200, height: 630, alt: s.title }] : [],
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

export default async function WatchSeriesPage({ params, searchParams }) {
  const { id } = params
  const sp = searchParams
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

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">المسلسل غير موجود</div>
      </div>
    )
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: series.title,
    description: series.description || '',
    image: series.thumbnail,
    url: `https://noo-tv.vercel.app/watch/series/${id}`,
    aggregateRating: series.average_rating ? {
      '@type': 'AggregateRating',
      ratingValue: series.average_rating,
      bestRating: 10,
      ratingCount: series.views || 1,
    } : undefined,
    numberOfSeasons: seasons.length,
    numberOfEpisodes: totalEpisodes,
    potentialAction: {
      '@type': 'WatchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `https://noo-tv.vercel.app/watch/series/${id}`,
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WatchSeriesClient />
    </>
  )
}
