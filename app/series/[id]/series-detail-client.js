'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Star, ArrowRight, Heart, Clock, ListVideo, ChevronDown, Eye, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function SeriesDetailClient() {
  const params = useParams()
  const router = useRouter()
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [user, setUser] = useState(null)
  const [episodeProgress, setEpisodeProgress] = useState({})

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

      const { data: history } = await supabase
        .from('watch_history')
        .select('episode_id, watched_time, duration')
        .eq('user_id', u.id)
        .eq('content_type', 'episode')
        .order('watched_at', { ascending: false })

      const progressMap = {}
      ;(history || []).forEach(h => {
        if (h.episode_id && h.watched_time > 0) {
          progressMap[h.episode_id] = { time: h.watched_time, duration: h.duration || 0 }
        }
      })
      setEpisodeProgress(progressMap)
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
      await loadSeasons(data.id)
    }
    setLoading(false)
  }

  const loadSeasons = async (seriesId) => {
    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('*')
      .eq('series_id', seriesId)
      .eq('is_active', true)
      .order('season_number', { ascending: true })

    if (!seasonsData || seasonsData.length === 0) {
      setSeasons([])
      return
    }

    const seasonIds = seasonsData.map(s => s.id)
    const { data: episodesData } = await supabase
      .from('episodes')
      .select('*')
      .in('season_id', seasonIds)
      .eq('is_active', true)
      .order('episode_number', { ascending: true })

    const withEpisodes = seasonsData.map(season => ({
      ...season,
      episodes: (episodesData || []).filter(ep => ep.season_id === season.id),
    }))

    setSeasons(withEpisodes)
    if (withEpisodes.length > 0) setExpandedSeason(withEpisodes[0].id)
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

  const totalEpisodes = seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0)

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

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 w-full bg-black/90 backdrop-blur z-50 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            <span className="text-xl font-bold text-red-600">NOO TV</span>
          </Link>
          <Link href="/series" className="text-gray-400 hover:text-white transition text-sm">المسلسلات</Link>
        </div>
      </header>

      <section className="relative h-[50vh] min-h-[350px] max-h-[500px] md:h-[65vh] md:min-h-[450px] md:max-h-[600px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${show.banner || show.thumbnail})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 pb-8 pt-20 px-4 md:container md:mx-auto">
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8">
            <div className="hidden md:block shrink-0">
              <img
                src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=400'}
                alt={show.title}
                className="w-48 h-72 object-cover rounded-xl shadow-2xl border border-gray-700"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {show.is_translated && <Badge className="bg-green-600">مترجم</Badge>}
                {show.is_dubbed && <Badge className="bg-blue-600">مدبلج</Badge>}
                {show.release_day && <Badge className="bg-purple-600">يعرض كل {show.release_day}</Badge>}
              </div>

              <h1 className="text-3xl md:text-5xl font-bold mb-3">{show.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span>{show.average_rating || '0.0'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{show.views || 0} مشاهدة</span>
                </div>
                <div className="flex items-center gap-1">
                  <ListVideo className="w-4 h-4" />
                  <span>{totalEpisodes} حلقة</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{seasons.length} مواسم</span>
                </div>
              </div>

              {show.description && (
                <p className="text-gray-300 mb-6 max-w-2xl line-clamp-3 md:line-clamp-none">{show.description}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    const firstEp = seasons[0]?.episodes?.[0]
                    if (firstEp) {
                      router.push(`/watch/series/${show.id}?episode=${firstEp.id}`)
                    } else {
                      router.push(`/watch/series/${show.id}`)
                    }
                  }}
                >
                  <Play className="w-5 h-5 ml-2" />
                  ابدأ المشاهدة
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={`border-gray-600 ${isInWatchlist ? 'bg-red-600/20 border-red-600 text-red-400' : ''}`}
                  onClick={toggleWatchlist}
                >
                  <Heart className={`w-5 h-5 ml-2 ${isInWatchlist ? 'fill-red-500' : ''}`} />
                  {isInWatchlist ? 'في المفضلة' : 'إضافة للمفضلة'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">المواسم والحلقات</h2>

        {seasons.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ListVideo className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>لا توجد حلقات متاحة حالياً</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seasons.map((season) => {
              const isExpanded = expandedSeason === season.id
              return (
                <div key={season.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSeason(isExpanded ? null : season.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 transition ${isExpanded ? 'rotate-180' : ''}`} />
                      <span className="font-bold text-lg">{season.title || `الموسم ${season.season_number}`}</span>
                      <span className="text-sm text-gray-400">({season.episodes?.length || 0} حلقة)</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-800">
                      {season.episodes?.map((ep) => {
                        const progress = episodeProgress[ep.id]
                        const progressPercent = progress && progress.duration > 0
                          ? Math.min(100, Math.round((progress.time / progress.duration) * 100))
                          : 0

                        return (
                          <Link
                            key={ep.id}
                            href={`/watch/series/${show.id}?episode=${ep.id}`}
                            className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition border-b border-gray-800/50 last:border-0"
                          >
                            <div className="text-gray-500 text-sm font-mono w-8 text-center shrink-0">
                              {ep.episode_number}
                            </div>
                            <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                              {ep.thumbnail ? (
                                <img src={ep.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
                                <Play className="w-8 h-8 text-white" />
                              </div>
                              {progressPercent > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                                  <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{ep.title || `الحلقة ${ep.episode_number}`}</h4>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                {ep.duration > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {ep.duration} دقيقة
                                  </span>
                                )}
                                {progressPercent > 0 && (
                                  <span className="text-red-400">{progressPercent}% تم المشاهدة</span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
