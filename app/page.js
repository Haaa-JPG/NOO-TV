'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Play, Star, TrendingUp, Film, Tv, Menu, User, LogOut, Heart, Clock, ListVideo } from 'lucide-react'
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
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [heroItems, setHeroItems] = useState([])
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    checkUser()
    loadContent()
  }, [])

  useEffect(() => {
    if (heroItems.length <= 1) return
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroItems.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [heroItems.length])

  const videoRefs = useRef({})
  const heroTimers = useRef({})

  useEffect(() => {
    heroItems.forEach((item, i) => {
      if (item.content_type !== 'video') return
      const el = videoRefs.current[item.id]
      if (!el) return

      clearTimeout(heroTimers.current[item.id])

      if (i === heroIndex) {
        el.currentTime = item.start_time || 0
        el.play().catch(() => {})

        if (item.end_time > 0 && item.end_time > (item.start_time || 0)) {
          const duration = item.end_time - (item.start_time || 0)
          heroTimers.current[item.id] = setTimeout(() => {
            el.pause()
            setHeroIndex(prev => (prev + 1) % heroItems.length)
          }, duration * 1000)
        }
      } else {
        el.pause()
      }
    })

    return () => {
      Object.values(heroTimers.current).forEach(clearTimeout)
    }
  }, [heroIndex, heroItems])

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

    // Load series with episode counts
    const { data: seriesData } = await supabase
      .from('series')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(12)
    
    if (seriesData) {
      const seriesIds = seriesData.map(s => s.id)
      const { data: allSeasons } = await supabase
        .from('seasons')
        .select('id, series_id')
        .in('series_id', seriesIds)

      const seasonMap = {}
      ;(allSeasons || []).forEach(s => {
        if (!seasonMap[s.series_id]) seasonMap[s.series_id] = []
        seasonMap[s.series_id].push(s.id)
      })

      const allSeasonIds = (allSeasons || []).map(s => s.id)
      let episodeCounts = {}
      if (allSeasonIds.length > 0) {
        const { data: epCounts } = await supabase
          .from('episodes')
          .select('season_id')
          .in('season_id', allSeasonIds)
          .eq('is_active', true)
        ;(epCounts || []).forEach(ep => {
          const seriesId = allSeasons.find(s => s.id === ep.season_id)?.series_id
          if (seriesId) {
            episodeCounts[seriesId] = (episodeCounts[seriesId] || 0) + 1
          }
        })
      }

      const seriesWithCounts = seriesData.map(show => ({
        ...show,
        episode_count: episodeCounts[show.id] || 0,
      }))
      setSeries(seriesWithCounts)
    }

    // Load categories
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (categoriesData) setCategories(categoriesData)

    // Load hero items
    const { data: heroData } = await supabase
      .from('featured_hero')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (heroData) setHeroItems(heroData)
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

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>

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

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute top-0 right-0 w-72 h-full bg-gray-900 shadow-xl p-6">
            <div className="flex justify-between items-center mb-8">
              <span className="text-xl font-bold text-red-600">NOO TV</span>
              <Button variant="ghost" size="icon" onClick={() => setShowMobileMenu(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            </div>
            
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="ابحث عن فيلم أو مسلسل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black border-gray-700 text-white pr-10 w-full"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </form>

            {/* Mobile Navigation */}
            <nav className="space-y-4">
              <Link 
                href="/" 
                className="block py-2 hover:text-red-500 transition"
                onClick={() => setShowMobileMenu(false)}
              >
                الرئيسية
              </Link>
              <Link 
                href="/movies" 
                className="block py-2 hover:text-red-500 transition"
                onClick={() => setShowMobileMenu(false)}
              >
                أفلام
              </Link>
              <Link 
                href="/series" 
                className="block py-2 hover:text-red-500 transition"
                onClick={() => setShowMobileMenu(false)}
              >
                مسلسلات
              </Link>
              <Link 
                href="/categories" 
                className="block py-2 hover:text-red-500 transition"
                onClick={() => setShowMobileMenu(false)}
              >
                التصنيفات
              </Link>
              
              <hr className="border-gray-700" />
              
              {user ? (
                <>
                  <Link 
                    href="/user" 
                    className="block py-2 hover:text-red-500 transition"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    حسابي
                  </Link>
                  <Link 
                    href="/user?tab=watchlist" 
                    className="block py-2 hover:text-red-500 transition"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    المفضلة
                  </Link>
                  <Link 
                    href="/user?tab=history" 
                    className="block py-2 hover:text-red-500 transition"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    سجل المشاهدة
                  </Link>
                  {user?.user_metadata?.role === 'admin' && (
                    <Link 
                      href="/admin" 
                      className="block py-2 text-red-500 hover:text-red-400 transition"
                      onClick={() => setShowMobileMenu(false)}
                    >
                      لوحة التحكم
                    </Link>
                  )}
                  <button
                    onClick={() => { handleSignOut(); setShowMobileMenu(false); }}
                    className="block w-full text-right py-2 hover:text-red-500 transition"
                  >
                    تسجيل الخروج
                  </button>
                </>
              ) : (
                <Button 
                  onClick={() => { router.push('/auth'); setShowMobileMenu(false); }}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  تسجيل الدخول
                </Button>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      {heroItems.length > 0 ? (
        <section className="relative h-[50vh] min-h-[300px] max-h-[500px] md:h-[calc(100vh-64px)] md:min-h-[400px] md:max-h-[900px] overflow-hidden bg-black">
          {heroItems.map((item, i) => {
            const isActive = i === heroIndex
            if (item.content_type === 'video') {
              return (
                <video
                  key={item.id}
                  src={item.media_url}
                  poster={item.poster_url}
                  autoPlay={isActive}
                  muted
                  loop={!item.end_time || item.end_time <= 0}
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  ref={el => { if (el) videoRefs.current[item.id] = el }}
                />
              )
            }
            return (
              <div
                key={item.id}
                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundImage: `url(${item.media_url})` }}
              />
            )
          })}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 pb-6 pt-20 px-4 md:container md:mx-auto">
            <div className="max-w-2xl">
              {heroItems[heroIndex]?.title && (
                <h1 className="text-3xl md:text-5xl font-bold mb-2 md:mb-4">{heroItems[heroIndex].title}</h1>
              )}
              {heroItems[heroIndex]?.description && (
                <p className="text-base md:text-xl mb-4 md:mb-6 text-gray-300 line-clamp-2">{heroItems[heroIndex].description}</p>
              )}
              <div className="flex gap-3 md:gap-4">
                {heroItems[heroIndex]?.content_type === 'video' && heroItems[heroIndex]?.series_id ? (
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push(`/series/${heroItems[heroIndex].series_id}`)}>
                    <Play className="w-5 h-5 ml-2" />
                    ابدأ المشاهدة
                  </Button>
                ) : heroItems[heroIndex]?.content_type === 'video' && heroItems[heroIndex]?.episode_id ? (
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push(heroItems[heroIndex].episode_id)}>
                    <Play className="w-5 h-5 ml-2" />
                    شاهد الآن
                  </Button>
                ) : (
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push('/movies')}>
                    <Play className="w-5 h-5 ml-2" />
                    ابدأ المشاهدة
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* Slide indicators */}
          {heroItems.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {heroItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`w-2 h-2 rounded-full transition ${i === heroIndex ? 'bg-red-600 w-6' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="relative h-[50vh] min-h-[300px] max-h-[500px] md:h-[calc(100vh-64px)] md:min-h-[400px] md:max-h-[900px]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920')] bg-cover bg-center" />
          <div className="absolute bottom-0 left-0 right-0 pb-6 pt-20 px-4 md:container md:mx-auto">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold mb-2 md:mb-4">مرحباً بك في NOO TV</h1>
              <p className="text-base md:text-xl mb-4 md:mb-6 text-gray-300">
                شاهد آلاف الأفلام والمسلسلات العربية والعالمية بجودة عالية
              </p>
              <div className="flex gap-3 md:gap-4">
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
      )}

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
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                      {movie.quality && (
                        <Badge className="absolute top-2 right-2 bg-red-600">
                          {movie.quality}
                        </Badge>
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
                <Link key={show.id} href={`/series/${show.id}`}>
                  <Card className="bg-gray-900 border-gray-800 hover:border-red-600 transition group cursor-pointer overflow-hidden">
                    <div className="relative aspect-[2/3]">
                      <img
                        src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400'}
                        alt={show.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400'
                        }}
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
