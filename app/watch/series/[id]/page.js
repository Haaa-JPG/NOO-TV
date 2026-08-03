'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Star, ArrowRight, MessageCircle, Play, ListVideo } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import VideoPlayer from '@/components/video-player'

export default function WatchSeries() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedEpisode, setSelectedEpisode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    loadSeries()
    checkUser()
  }, [params.id])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    setUser(user)
    if (user) {
      checkWatchlist(user.id)
      loadUserRating(user.id)
    }
  }

  const loadSeries = async () => {
    const { data } = await supabase
      .from('series')
      .select('*')
      .eq('id', params.id)
      .single()

    if (data) {
      setShow(data)
      await loadSeasons(data.id)
      loadComments(data.id)
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

    const seasonIds = seasonsData.map((s) => s.id)
    const { data: episodesData } = await supabase
      .from('episodes')
      .select('*')
      .in('season_id', seasonIds)
      .eq('is_active', true)
      .order('episode_number', { ascending: true })

    const withEpisodes = seasonsData.map((season) => ({
      ...season,
      episodes: (episodesData || []).filter((ep) => ep.season_id === season.id),
    }))

    setSeasons(withEpisodes)

    // Auto-select the first available episode
    const firstSeason = withEpisodes.find((s) => s.episodes.length > 0)
    if (firstSeason) {
      setSelectedEpisode(firstSeason.episodes[0])
    }
  }

  const loadComments = async (seriesId) => {
    const { data } = await supabase
      .from('comments')
      .select('*, users(display_name, avatar_url)')
      .eq('series_id', seriesId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })

    if (data) setComments(data)
  }

  const checkWatchlist = async (userId) => {
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('series_id', params.id)
      .maybeSingle()
    setIsInWatchlist(!!data)
  }

  const loadUserRating = async (userId) => {
    const { data } = await supabase
      .from('ratings')
      .select('rating_value')
      .eq('user_id', userId)
      .eq('series_id', params.id)
      .maybeSingle()
    if (data) setUserRating(data.rating_value)
  }

  const toggleWatchlist = async () => {
    if (!user) {
      router.push('/auth')
      return
    }

    if (isInWatchlist) {
      await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('series_id', params.id)
      setIsInWatchlist(false)
      toast({ title: 'تم الحذف من المفضلة' })
    } else {
      await supabase
        .from('watchlist')
        .insert({ user_id: user.id, series_id: params.id })
      setIsInWatchlist(true)
      toast({ title: 'تم الإضافة إلى المفضلة' })
    }
  }

  const handleRating = async (rating) => {
    if (!user) {
      router.push('/auth')
      return
    }

    await supabase
      .from('ratings')
      .upsert({
        user_id: user.id,
        series_id: params.id,
        rating_value: rating
      })

    setUserRating(rating)
    toast({ title: `تم التقييم ${rating}/5` })

    const { data: ratings } = await supabase
      .from('ratings')
      .select('rating_value')
      .eq('series_id', params.id)

    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length
      await supabase
        .from('series')
        .update({ average_rating: avg.toFixed(1) })
        .eq('id', params.id)
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) {
      router.push('/auth')
      return
    }
    if (!newComment.trim()) return

    await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        series_id: params.id,
        content: newComment,
        is_approved: true
      })

    setNewComment('')
    loadComments(params.id)
    toast({ title: 'تم إضافة التعليق' })
  }

  const startEpisode = async (episode) => {
    setSelectedEpisode(episode)

    if (user) {
      await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          content_id: episode.id,
          content_type: 'episode',
          episode_id: episode.id,
          duration: episode.duration || 0
        })
    }

    await supabase
      .from('episodes')
      .update({ views: (episode.views || 0) + 1 })
      .eq('id', episode.id)
  }

  const totalEpisodes = () =>
    seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0)

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
        <div className="text-white text-2xl">المسلسل غير موجود</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/90 backdrop-blur z-50 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            <span className="text-xl font-bold text-red-600">NOO TV</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleWatchlist}
              className={isInWatchlist ? 'text-red-500' : ''}
            >
              <Heart className={`w-5 h-5 ${isInWatchlist ? 'fill-red-500' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Player */}
      <div className="pt-16">
        <div className="relative bg-black" style={{ height: 'calc(100vh - 64px)' }}>
          {selectedEpisode?.embed_url ? (
            <VideoPlayer
              url={selectedEpisode.embed_url}
              title={selectedEpisode.title}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-gray-400">اختر حلقة للمشاهدة</p>
            </div>
          )}
        </div>
      </div>

        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main */}
            <div className="lg:col-span-2">
              <div className="flex items-start gap-4 mb-6">
                <img
                  src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=200'}
                  alt={show.title}
                  className="w-32 h-48 object-cover rounded-lg hidden sm:block"
                />
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-2">{show.title}</h1>
                  <div className="flex items-center gap-3 text-gray-400 mb-3 flex-wrap">
                    {show.category && <Badge className="bg-red-600">{show.category}</Badge>}
                    <Badge className="bg-blue-600">{show.total_seasons || seasons.length} مواسم</Badge>
                    <Badge variant="outline">{totalEpisodes()} حلقة</Badge>
                  </div>
                  {selectedEpisode && (
                    <p className="text-gray-400 mb-2">
                      الآن: {selectedEpisode.title}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                      <span className="font-bold">{show.average_rating || '0.0'}</span>
                    </div>
                    <span className="text-gray-400">{show.views || 0} مشاهدة</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{show.description}</p>
                </div>
              </div>

              {/* Episodes list */}
              <Card className="bg-gray-900 border-gray-800 mb-6">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <ListVideo className="w-5 h-5" />
                    الحلقات
                  </h3>

                  {seasons.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">لا توجد حلقات متاحة بعد</p>
                  ) : (
                    seasons.map((season) => (
                      <div key={season.id} className="mb-6 last:mb-0">
                        <h4 className="font-bold text-gray-300 mb-3">
                          {season.title || `الموسم ${season.season_number}`}
                          <span className="text-sm text-gray-500 mr-2">
                            ({season.episodes?.length || 0} حلقة)
                          </span>
                        </h4>
                        <div className="space-y-2">
                          {season.episodes?.map((ep) => (
                            <button
                              key={ep.id}
                              onClick={() => startEpisode(ep)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition text-right ${
                                selectedEpisode?.id === ep.id
                                  ? 'border-red-600 bg-red-600/10'
                                  : 'border-gray-800 hover:border-gray-600 bg-gray-950'
                              }`}
                            >
                              <Play className="w-4 h-4 shrink-0 text-red-600" />
                              <div className="flex-1">
                                <div className="font-semibold text-sm">
                                  الحلقة {ep.episode_number}: {ep.title || `الحلقة ${ep.episode_number}`}
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 shrink-0">
                                {ep.views || 0} مشاهدة
                              </span>
                            </button>
                          ))}
                          {season.episodes?.length === 0 && (
                            <p className="text-sm text-gray-600">لا توجد حلقات في هذا الموسم</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Rating */}
              <Card className="bg-gray-900 border-gray-800 mb-6">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">قيّم هذا المسلسل</h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRating(star)}
                        className="transition hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= userRating
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Comments */}
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    التعليقات ({comments.length})
                  </h3>

                  {user ? (
                    <form onSubmit={handleComment} className="mb-6">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="أضف تعليقك..."
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white min-h-[100px] focus:outline-none focus:border-red-600"
                      />
                      <Button type="submit" className="mt-2 bg-red-600 hover:bg-red-700">
                        إرسال
                      </Button>
                    </form>
                  ) : (
                    <button
                      onClick={() => router.push('/auth')}
                      className="text-red-500 hover:text-red-400 mb-6 block"
                    >
                      سجّل الدخول لإضافة تعليق
                    </button>
                  )}

                  {comments.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">لا توجد تعليقات بعد</p>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="border-b border-gray-800 pb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                              {comment.users?.display_name?.[0] || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold">{comment.users?.display_name || 'مستخدم'}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(comment.created_at).toLocaleDateString('ar')}
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-300">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">معلومات المسلسل</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-gray-400 text-sm">التصنيف</dt>
                      <dd className="font-semibold">{show.category || 'غير محدد'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">عدد المواسم</dt>
                      <dd className="font-semibold">{show.total_seasons || seasons.length}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">عدد الحلقات</dt>
                      <dd className="font-semibold">{totalEpisodes()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">عدد المشاهدات</dt>
                      <dd className="font-semibold">{show.views || 0}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </div>
  )
}