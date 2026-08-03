'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Play, Star, Film, Tv } from 'lucide-react'
import Link from 'next/link'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [series, setSeries] = useState([])

  useEffect(() => {
    searchContent()
  }, [query])

  const searchContent = async () => {
    setLoading(true)
    const q = query.trim()

    if (!q) {
      setMovies([])
      setSeries([])
      setLoading(false)
      return
    }

    // Search movies
    const { data: moviesData } = await supabase
      .from('movies')
      .select('*')
      .eq('is_active', true)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order('views', { ascending: false })
      .limit(30)

    // Search series
    const { data: seriesData } = await supabase
      .from('series')
      .select('*')
      .eq('is_active', true)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order('views', { ascending: false })
      .limit(30)

    setMovies(moviesData || [])
    setSeries(seriesData || [])
    setLoading(false)
  }

  const totalResults = movies.length + series.length

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <Link href="/" className="text-gray-400 hover:text-white transition">العودة للرئيسية</Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-bold">نتائج البحث</h1>
        </div>
        <p className="text-gray-400 mb-8">
          نتائج "{query}": {totalResults} نتيجة
        </p>

        {loading ? (
          <div className="text-center py-20 text-gray-400">جاري البحث...</div>
        ) : totalResults === 0 ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">لا توجد نتائج مطابقة</h3>
            <p className="text-gray-600 mt-2">جرّب كلمات بحث مختلفة</p>
          </div>
        ) : (
          <>
            {movies.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5 text-red-600" /> أفلام
                </h2>
                <ContentGrid items={movies} type="movie" />
              </section>
            )}

            {series.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-red-600" /> مسلسلات
                </h2>
                <ContentGrid items={series} type="series" />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ContentGrid({ items, type }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <Link key={item.id} href={`/watch/${type}/${item.id}`}>
          <Card className="bg-gray-900 border-gray-800 hover:border-red-600 transition group cursor-pointer overflow-hidden">
            <div className="relative aspect-[2/3]">
              <img
                src={item.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Play className="w-12 h-12 text-white" />
              </div>
              {type === 'series' && item.total_seasons && (
                <Badge className="absolute top-2 right-2 bg-blue-600">
                  {item.total_seasons} مواسم
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <h3 className="font-semibold truncate">{item.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span>{item.average_rating || '0.0'}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-white text-2xl">جاري التحميل...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}