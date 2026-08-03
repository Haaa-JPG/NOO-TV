'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Star, Tv, ListVideo } from 'lucide-react'
import Link from 'next/link'

function SeriesContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category') || ''

  const [loading, setLoading] = useState(true)
  const [series, setSeries] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    loadCategories()
    loadSeries()
  }, [categoryParam])

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('content_type', 'series')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (data) setCategories(data)
  }

  const loadSeries = async () => {
    setLoading(true)
    let query = supabase
      .from('series')
      .select('*')
      .eq('is_active', true)

    if (categoryParam) {
      query = query.eq('category', categoryParam)
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(60)
    
    if (data) {
      const seriesWithCounts = await Promise.all(
        data.map(async (show) => {
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('series_id', show.id)
          if (!seasons || seasons.length === 0) return { ...show, episode_count: 0 }
          const seasonIds = seasons.map(s => s.id)
          const { count } = await supabase
            .from('episodes')
            .select('*', { count: 'exact', head: true })
            .in('season_id', seasonIds)
          return { ...show, episode_count: count || 0 }
        })
      )
      setSeries(seriesWithCounts)
    } else {
      setSeries([])
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <Link href="/" className="text-gray-400 hover:text-white transition">العودة للرئيسية</Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Tv className="w-6 h-6 text-red-600" />
          <h1 className="text-3xl font-bold">المسلسلات</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link href="/series" className={`px-4 py-2 rounded-full border transition ${!categoryParam ? 'bg-red-600 border-red-600' : 'border-gray-700 hover:border-red-600'}`}>
            الكل
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/series?category=${encodeURIComponent(cat.name)}`}
              className={`px-4 py-2 rounded-full border text-sm transition ${categoryParam === cat.name ? 'bg-red-600 border-red-600' : 'border-gray-700 hover:border-red-600'}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
        ) : series.length === 0 ? (
          <div className="text-center py-20">
            <Tv className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">لا توجد مسلسلات بالمعايير المحددة</h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {series.map((show) => (
              <Link key={show.id} href={`/watch/series/${show.id}`}>
                <Card className="bg-gray-900 border-gray-800 hover:border-red-600 transition group cursor-pointer overflow-hidden">
                  <div className="relative aspect-[2/3]">
                    <img
                      src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400'}
                      alt={show.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                    {show.total_seasons && (
                      <Badge className="absolute top-2 right-2 bg-blue-600">
                        {show.total_seasons} مواسم
                      </Badge>
                    )}
                    {/* Episodes Count Badge */}
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <ListVideo className="w-3 h-3" />
                      <span>{show.episode_count || 0} حلقة</span>
                    </div>
                    {/* Views Badge */}
                    <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>{show.views || 0}</span>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold truncate">{show.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span>{show.average_rating || '0.0'}</span>
                      {show.is_dubbed && <Badge className="bg-blue-600 text-[10px] px-1 py-0">مدبلج</Badge>}
                      {show.is_translated && <Badge className="bg-green-600 text-[10px] px-1 py-0">مترجم</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-white text-2xl">جاري التحميل...</div>
        </div>
      }
    >
      <SeriesContent />
    </Suspense>
  )
}