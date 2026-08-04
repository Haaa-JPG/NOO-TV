'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Star, Film } from 'lucide-react'
import Link from 'next/link'

function MoviesContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category') || ''
  const yearParam = searchParams.get('year') || ''

  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [categories, setCategories] = useState([])
  const [years, setYears] = useState([])

  useEffect(() => {
    loadCategories()
    loadMovies()
  }, [categoryParam, yearParam])

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('content_type', 'movie')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (data) setCategories(data)
  }

  const loadMovies = async () => {
    setLoading(true)
    let query = supabase
      .from('movies')
      .select('*')
      .eq('is_active', true)

    if (categoryParam) {
      query = query.eq('category', categoryParam)
    }
    if (yearParam) {
      query = query.eq('year', Number(yearParam))
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(60)
    setMovies(data || [])

    // Collect available years for the filter dropdown
    const yearsSet = new Set()
    ;(data || []).forEach((m) => {
      if (m.year) yearsSet.add(m.year)
    })
    setYears([...yearsSet].sort((a, b) => b - a))
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
          <Film className="w-6 h-6 text-red-600" />
          <h1 className="text-3xl font-bold">الأفلام</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link href="/movies" className={`px-4 py-2 rounded-full border transition ${!categoryParam ? 'bg-red-600 border-red-600' : 'border-gray-700 hover:border-red-600'}`}>
            الكل
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/movies?category=${encodeURIComponent(cat.name)}`}
              className={`px-4 py-2 rounded-full border text-sm transition ${categoryParam === cat.name ? 'bg-red-600 border-red-600' : 'border-gray-700 hover:border-red-600'}`}
            >
              {cat.name}
            </Link>
          ))}
          {years.length > 0 && (
            <select
              value={yearParam}
              onChange={(e) => {
                const year = e.target.value
                const base = categoryParam ? `?category=${encodeURIComponent(categoryParam)}` : ''
                if (year) {
                  window.location.href = `/movies${base}${base ? '&' : '?'}year=${year}`
                } else {
                  window.location.href = `/movies${base}`
                }
              }}
              className="bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm"
            >
              <option value="">كل السنوات</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
        ) : movies.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">لا توجد أفلام بالمعايير المحددة</h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {movies.map((movie) => (
              <Link key={movie.id} href={`/watch/movie/${movie.id}`}>
                <Card className="bg-gray-900 border-gray-800 hover:border-red-600 transition group cursor-pointer overflow-hidden">
                  <div className="relative aspect-[2/3]">
                    <img
                      src={movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                    {movie.quality && (
                      <Badge className="absolute top-2 right-2 bg-red-600">{movie.quality}</Badge>
                    )}
                    {/* Views Badge */}
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>{movie.views || 0}</span>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold truncate">{movie.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span>{movie.average_rating || '0.0'}</span>
                      {movie.is_dubbed && <Badge className="bg-blue-600 text-[10px] px-1 py-0">مدبلج</Badge>}
                      {movie.is_translated && <Badge className="bg-green-600 text-[10px] px-1 py-0">مترجم</Badge>}
                      {movie.year && <span>• {movie.year}</span>}
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

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-white text-2xl">جاري التحميل...</div>
        </div>
      }
    >
      <MoviesContent />
    </Suspense>
  )
}