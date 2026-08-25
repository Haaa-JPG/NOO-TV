import { getDbClient } from '@/lib/db'
import WatchSeriesClient from './series-watch-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { id } = params
  if (!process.env.DATABASE_URL) return { title: 'NOO TV' }
  const client = getDbClient()
  try {
    await client.connect()
    const { rows } = await client.query(
      'SELECT title, description, thumbnail, average_rating, views, category FROM series WHERE id = $1',
      [id]
    )
    if (rows.length === 0) return { title: 'مسلسل غير موجود' }
    const s = rows[0]
    const desc = s.description || `شاهد ${s.title} مجاناً بجودة عالية على NOO TV`
    return {
      title: s.title,
      description: desc,
      keywords: [s.title, 'مسلسل', 'مشاهدة مجاناً', 'مترجم', 'مدبلج', 'NOO TV', s.category].filter(Boolean),
      openGraph: {
        title: `${s.title} | NOO TV`,
        description: desc,
        url: `https://noo-tv.vercel.app/watch/series/${id}`,
        siteName: 'NOO TV',
        type: 'video.episode',
        images: s.thumbnail ? [{ url: s.thumbnail, width: 1200, height: 630, alt: s.title }] : [],
        locale: 'ar_SA',
      },
      twitter: { card: 'summary_large_image', title: `${s.title} | NOO TV`, description: desc },
      alternates: { canonical: `https://noo-tv.vercel.app/watch/series/${id}` },
    }
  } finally {
    await client.end()
  }
}

export default function WatchSeriesPage() {
  return <WatchSeriesClient />
}
