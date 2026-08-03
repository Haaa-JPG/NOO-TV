'use client'

import { useEffect, useState } from 'react'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Play, Star, TrendingUp, Film, Tv, Menu, User, LogOut, Heart, Clock } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState([])
  const [series, setSeries] = useState([])
  const [categories, setCategories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    checkUser()
    loadContent()
  }, [])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    if (user) {
      // Fetch role from the users table (source of truth)
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) {
        user.user_metadata = { ...user.user_metadata, role: profile.role }
      }
    }
    setUser(user)
    setLoading(false)
  }

  const loadContent = async () => {
    // Load movies
    const { data: moviesData } = await supabase
      .from('movies')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(12)
    
    if (moviesData) setMovies(moviesData)

    // Load series
    const { data: seriesData } = await supabase
      .from('series')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(12)
    
    if (seriesData) setSeries(seriesData)

    // Load categories
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (categoriesData) setCategories(categoriesData)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setShowMenu(false)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-gradient-to-b from-black to-transparent z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-3xl font-bold text-red-600">NOO TV</div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="hover:text-red-500 transition">الرئيسية</Link>
              <Link href="/movies" className="hover:text-red-500 transition">أفلام</Link>
              <Link href="/series" className="hover:text-red-500 transition">مسلسلات</Link>
              <Link href="/categories" className="hover:text-red-500 transition">التصنيفات</Link>
            </nav>

            <div className="flex items-center gap-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="ابحث عن فيلم أو مسلسل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black/50 border-gray-700 text-white pr-10 w-64"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </form>

              {/* User Menu */}
              {user ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded-full"
                  >
                    <User className="w-5 h-5" />
                  </Button>
                  
                  {showMenu && (
                    <div className="absolute left-0 mt-2 w-48 bg-black border border-gray-800 rounded-lg shadow-xl">
                      <Link href="/user" className="block px-4 py-2 hover:bg-gray-900 transition">
                        <User className="w-4 h-4 inline ml-2" />
                        حسابي
                      </Link>
                      <Link href="/user?tab=watchlist" className="block px-4 py-2 hover:bg-gray-900 transition">
                        <Heart className="w-4 h-4 inline ml-2" />
                        المفضلة
                      </Link>
                      <Link href="/user?tab=history" className="block px-4 py-2 hover:bg-gray-900 transition">
                        <Clock className="w-4 h-4 inline ml-2" />
                        سجل المشاهدة
                      </Link>
                      {user?.user_metadata?.role === 'admin' && (
                        <Link href="/admin" className="block px-4 py-2 hover:bg-gray-900 transition text-red-500">
                          لوحة التحكم
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="w-full text-right px-4 py-2 hover:bg-gray-900 transition border-t border-gray-800"
                      >
                        <LogOut className="w-4 h-4 inline ml-2" />
                        تسجيل الخروج
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button onClick={() => router.push('/auth')} className="bg-red-600 hover:bg-red-700 text-white">
                  تسجيل الدخول
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative h-[600px] mt-16">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920')] bg-cover bg-center" />
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-bold mb-4">مرحباً بك في NOO TV</h1>
            <p className="text-xl mb-6 text-gray-300">
              شاهد آلاف الأفلام والمسلسلات العربية والعالمية بجودة عالية
            </p>
            <div className="flex gap-4">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push('/movies')}>
                <Play className="w-5 h-5 ml-2" />
                ابدأ المشاهدة
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => router.push('/series')}>
                المزيد
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-8">
        {/* Categories */}
        {categories.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold">التصنيفات</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant="outline"
                  className="px-6 py-2 text-base cursor-pointer hover:bg-red-600 transition whitespace-nowrap"
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Movies */}
        {movies.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Film className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold">أفلام</h2>
            </div>
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
                        <Badge className="absolute top-2 right-2 bg-red-600">
                          {movie.quality}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold truncate">{movie.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <span>{movie.average_rating || '0.0'}</span>
                        <span>•</span>
                        <span>{movie.year}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Series */}
        {series.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Tv className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold">مسلسلات</h2>
            </div>
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
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold truncate">{show.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <span>{show.average_rating || '0.0'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {movies.length === 0 && series.length === 0 && (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400">لا يوجد محتوى متاح حالياً</h3>
            <p className="text-gray-600 mt-2">سيتم إضافة المحتوى قريباً</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>&copy; 2025 NOO TV. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  )
}
