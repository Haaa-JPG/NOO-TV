'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Star, Heart, Eye, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function parseYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export default function SeriesDetailClient() {
  const params = useParams()
  const router = useRouter()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [user, setUser] = useState(null)
  const [showFullDesc, setShowFullDesc] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    const { user: u } = await getCurrentUser()
    if (u) {
      setUser(u)
      const { data: wl } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', u.id)
        .eq('content_id', params.id)
        .eq('content_type', 'series')
        .maybeSingle()
      if (wl) setIsInWatchlist(true)
    }

    const { data } = await supabase
      .from('series')
      .select('*')
      .eq('id', params.id)
      .single()

    if (data) {
      setShow(data)
      document.title = `${data.title} | NOO TV`
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) metaDesc.setAttribute('content', data.description || `شاهد ${data.title} مجاناً على NOO TV`)
      else {
        const m = document.createElement('meta')
        m.name = 'description'
        m.content = data.description || `شاهد ${data.title} مجاناً على NOO TV`
        document.head.appendChild(m)
      }
    }
    setLoading(false)
  }

  const toggleWatchlist = async () => {
    if (!user) { router.push('/auth'); return }
    if (isInWatchlist) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('content_id', params.id)
      setIsInWatchlist(false)
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, content_id: params.id, content_type: 'series' })
      setIsInWatchlist(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">المسلسل غير موجود</div>
      </div>
    )
  }

  const youtubeId = parseYouTubeId(show.trailer_url)
  const hasVideo = !!youtubeId
  const bgImage = show.banner || show.thumbnail

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 h-14 bg-black/90 backdrop-blur z-50 border-b border-gray-800">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            <span className="text-xl font-bold text-red-600">NOO TV</span>
          </Link>
          <Link href="/series" className="text-gray-400 hover:text-white transition text-sm">المسلسلات</Link>
        </div>
      </header>

      <section className="relative h-[50vh] min-h-[350px] max-h-[500px] sm:h-[55vh] sm:min-h-[400px] sm:max-h-[550px] md:h-[60vh] md:min-h-[450px] md:max-h-[600px] lg:h-[65vh] lg:min-h-[500px] lg:max-h-[650px] overflow-hidden mt-14">
        {/* Background: Video or Image */}
        {hasVideo ? (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1&start=0`}
              className="absolute top-1/2 left-1/2 w-[120%] h-[120%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              allow="autoplay; encrypted-media"
              allowFullScreen={false}
              frameBorder="0"
              title=""
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        )}

        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />

        {/* Series Info - Bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 pb-6 sm:pb-8 md:pb-10 px-4 sm:px-6 md:container md:mx-auto">
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
            {/* Poster - Desktop only */}
            <div className="hidden md:block shrink-0">
              <img
                src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400'}
                alt={show.title}
                className="w-40 lg:w-48 h-60 lg:h-72 object-cover rounded-xl shadow-2xl border border-gray-700"
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                {show.is_translated && <Badge className="bg-green-600 text-[10px] sm:text-xs">مترجم</Badge>}
                {show.is_dubbed && <Badge className="bg-blue-600 text-[10px] sm:text-xs">مدبلج</Badge>}
                {show.release_day && <Badge className="bg-purple-600 text-[10px] sm:text-xs">يعرض {show.release_day}</Badge>}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3">{show.title}</h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-500 text-yellow-500" />
                  <span>{show.average_rating || '0.0'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{show.views || 0} مشاهدة</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{show.total_seasons || 0} مواسم</span>
                </div>
              </div>

              {/* Description */}
              {show.description && (
                <div className="mb-4 sm:mb-5 md:mb-6 max-w-2xl">
                  <p className={`text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed ${!showFullDesc ? 'line-clamp-3' : ''}`}>
                    {show.description}
                  </p>
                  {show.description.length > 150 && (
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="text-red-500 hover:text-red-400 text-xs sm:text-sm mt-1 font-semibold"
                    >
                      {showFullDesc ? 'عرض أقل' : 'المزيد'}
                    </button>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm h-9 sm:h-10 md:h-12"
                  onClick={() => router.push(`/watch/series/${show.id}`)}
                >
                  <Play className="w-4 h-4 ml-1 sm:ml-2" />
                  ابدأ المشاهدة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`border-gray-600 text-xs sm:text-sm h-9 sm:h-10 md:h-12 ${isInWatchlist ? 'bg-red-600/20 border-red-600 text-red-400' : ''}`}
                  onClick={toggleWatchlist}
                >
                  <Heart className={`w-4 h-4 ml-1 sm:ml-2 ${isInWatchlist ? 'fill-red-500' : ''}`} />
                  {isInWatchlist ? 'في المفضلة' : 'إضافة للمفضلة'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
