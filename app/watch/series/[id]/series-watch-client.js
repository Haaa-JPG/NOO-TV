'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase, getCurrentUser, getUserProfile } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Star, ArrowRight, MessageCircle, Play, ListVideo, ThumbsUp, ThumbsDown, ChevronDown, Disc, Clock } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import VideoPlayer from '@/components/video-player'

function sanitize(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export default function WatchSeriesClient() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedEpisode, setSelectedEpisode] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [commentLikes, setCommentLikes] = useState({})
  const [episodeLike, setEpisodeLike] = useState(null)
  const [episodeLikeCounts, setEpisodeLikeCounts] = useState({ likes: 0, dislikes: 0 })
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [episodeProgress, setEpisodeProgress] = useState({})
  const [resumeTime, setResumeTime] = useState(0)
  const targetEpisodeId = searchParams.get('episode')

  useEffect(() => {
    initSeries()
  }, [params.id])

  const initSeries = async () => {
    const { user: u } = await getCurrentUser()
    if (u) {
      const profile = await getUserProfile(u.id)
      if (profile?.is_banned) {
        toast({ title: 'تم حظر هذا الحساب', variant: 'destructive' })
        await supabase.auth.signOut()
        router.push('/auth')
        return
      }
      setUser(u)
      checkWatchlist(u.id)
      loadUserRating(u.id)
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
      await loadSeasons(data.id, u)
      loadComments(data.id)
      let sessionId = localStorage.getItem('nootv_session')
      if (!sessionId) {
        sessionId = crypto.randomUUID()
        localStorage.setItem('nootv_session', sessionId)
      }
      const { data: existing } = await supabase
        .from('view_tracking')
        .select('id')
        .eq('session_id', sessionId)
        .eq('content_type', 'series')
        .eq('content_id', params.id)
        .maybeSingle()
      if (!existing) {
        await supabase.from('view_tracking').insert({ session_id: sessionId, content_type: 'series', content_id: params.id })
        await supabase.rpc('increment_series_views', { sid: params.id })
      }
    }
    setLoading(false)
  }

  const loadSeasons = async (seriesId, currentUser) => {
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

    if (currentUser) {
      const { data: history } = await supabase
        .from('watch_history')
        .select('episode_id, watched_time, duration, watched_at')
        .eq('user_id', currentUser.id)
        .eq('content_type', 'episode')
        .order('watched_at', { ascending: false })

      const progressMap = {}
      const historyList = history || []
      historyList.forEach(h => {
        if (h.episode_id && h.watched_time > 0) {
          progressMap[h.episode_id] = { time: h.watched_time, duration: h.duration || 0 }
        }
      })
      setEpisodeProgress(progressMap)

      // Priority 1: Deep-link from URL ?episode={id}
      if (targetEpisodeId) {
        for (const s of withEpisodes) {
          const found = s.episodes.find(e => e.id === targetEpisodeId)
          if (found) {
            setSelectedSeason(s)
            setSelectedEpisode(found)
            const prog = progressMap[found.id]
            setResumeTime(prog?.time || 0)
            return
          }
        }
      }

      // Priority 2: Auto-select last watched episode
      if (historyList.length > 0) {
        const lastEpId = historyList[0].episode_id
        for (const s of withEpisodes) {
          const found = s.episodes.find(e => e.id === lastEpId)
          if (found) {
            setSelectedSeason(s)
            setSelectedEpisode(found)
            setResumeTime(historyList[0].watched_time || 0)
            return
          }
        }
      }
    }

    const firstSeason = withEpisodes.find((s) => s.episodes.length > 0)
    if (firstSeason) {
      setSelectedSeason(firstSeason)
      setSelectedEpisode(firstSeason.episodes[0])
    }
  }

  const loadComments = async (seriesId) => {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('series_id', seriesId)
      .order('created_at', { ascending: false })

    if (!commentsData || commentsData.length === 0) {
      setComments([])
      return
    }

    const userIds = [...new Set(commentsData.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    const profilesMap = {}
    ;(profiles || []).forEach(p => { profilesMap[p.id] = p })

    const enriched = commentsData.map(c => ({
      ...c,
      user_profile: profilesMap[c.user_id] || { display_name: 'مستخدم' }
    }))

    setComments(enriched)
    loadCommentLikes(enriched.map(c => c.id))
  }

  const loadCommentLikes = async (commentIds) => {
    if (!commentIds.length) return
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id, is_like')
      .in('comment_id', commentIds)

    const likes = {}
    ;(data || []).forEach(l => {
      if (!likes[l.comment_id]) likes[l.comment_id] = { likes: 0, dislikes: 0 }
      if (l.is_like) likes[l.comment_id].likes++
      else likes[l.comment_id].dislikes++
    })
    setCommentLikes(likes)
  }

  const toggleCommentLike = async (commentId, isLike) => {
    if (!user) { router.push('/auth'); return }

    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id, is_like')
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
      .maybeSingle()

    if (existing) {
      if (existing.is_like === isLike) {
        await supabase.from('comment_likes').delete().eq('id', existing.id)
      } else {
        await supabase.from('comment_likes').update({ is_like: isLike }).eq('id', existing.id)
      }
    } else {
      await supabase.from('comment_likes').insert({
        user_id: user.id,
        comment_id: commentId,
        is_like: isLike
      })
    }
    loadCommentLikes(comments.map(c => c.id))
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
    if (!user) { router.push('/auth'); return }
    if (isInWatchlist) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('series_id', params.id)
      setIsInWatchlist(false)
      toast({ title: 'تم الحذف من المفضلة' })
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, series_id: params.id })
      setIsInWatchlist(true)
      toast({ title: 'تم الإضافة إلى المفضلة' })
    }
  }

  const handleRating = async (rating) => {
    if (!user) { router.push('/auth'); return }
    await supabase.from('ratings').upsert({
      user_id: user.id, series_id: params.id, rating_value: rating
    })
    setUserRating(rating)
    toast({ title: `تم التقييم ${rating}/5` })

    const { data: ratings } = await supabase.from('ratings').select('rating_value').eq('series_id', params.id)
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length
      await supabase.from('series').update({ average_rating: avg.toFixed(1) }).eq('id', params.id)
    }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) { router.push('/auth'); return }
    if (!newComment.trim()) return

    await supabase.from('comments').insert({
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
    setEpisodeLike(null)
    setResumeTime(episodeProgress[episode.id]?.time || 0)
    if (show) {
      document.title = `${show.title} - ${episode.title || `الحلقة ${episode.episode_number}`} | NOO TV`
    }
    if (user) {
      await supabase.from('watch_history').insert({
        user_id: user.id,
        content_id: episode.id,
        content_type: 'episode',
        episode_id: episode.id,
        duration: episode.duration || 0
      })
    }
    let sessionId = localStorage.getItem('nootv_session')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      localStorage.setItem('nootv_session', sessionId)
    }
    const { data: existing } = await supabase
      .from('view_tracking')
      .select('id')
      .eq('session_id', sessionId)
      .eq('content_type', 'episode')
      .eq('content_id', episode.id)
      .maybeSingle()
    if (!existing) {
      await supabase.from('view_tracking').insert({ session_id: sessionId, content_type: 'episode', content_id: episode.id })
      await supabase.rpc('increment_episode_views', { ep_id: episode.id })
    }
    loadEpisodeLikeForEpisode(episode.id)
  }

  const handleVideoProgress = async (currentTime, duration, ended = false) => {
    if (!user || !selectedEpisode) return
    const epId = selectedEpisode.id
    const watchedTime = ended ? 0 : currentTime

    const { data: existing } = await supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('episode_id', epId)
      .maybeSingle()

    if (existing) {
      await supabase.from('watch_history').update({
        watched_time: watchedTime,
        duration,
        watched_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('watch_history').insert({
        user_id: user.id,
        content_id: epId,
        content_type: 'episode',
        episode_id: epId,
        watched_time: watchedTime,
        duration
      })
    }
    setEpisodeProgress(prev => ({
      ...prev,
      [epId]: { time: watchedTime, duration }
    }))
  }

  const totalEpisodes = () => seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0)

  const loadEpisodeLikeForEpisode = async (episodeId) => {
    if (!episodeId) {
      setEpisodeLike(null)
      setEpisodeLikeCounts({ likes: 0, dislikes: 0 })
      return
    }
    const { data: allLikes } = await supabase
      .from('episode_likes')
      .select('is_like')
      .eq('episode_id', episodeId)
    let likes = 0, dislikes = 0
    ;(allLikes || []).forEach(l => { if (l.is_like) likes++; else dislikes++ })
    setEpisodeLikeCounts({ likes, dislikes })

    if (!user) { setEpisodeLike(null); return }
    const { data } = await supabase
      .from('episode_likes')
      .select('is_like')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .maybeSingle()
    setEpisodeLike(data?.is_like ?? null)
  }

  useEffect(() => {
    if (selectedEpisode) {
      loadEpisodeLikeForEpisode(selectedEpisode.id)
    }
  }, [selectedEpisode])

  const toggleEpisodeLike = async (isLike) => {
    if (!user) { router.push('/auth'); return }
    if (!selectedEpisode) return

    const { data: existing } = await supabase
      .from('episode_likes')
      .select('id, is_like')
      .eq('user_id', user.id)
      .eq('episode_id', selectedEpisode.id)
      .maybeSingle()

    if (existing) {
      if (existing.is_like === isLike) {
        await supabase.from('episode_likes').delete().eq('id', existing.id)
        setEpisodeLike(null)
      } else {
        await supabase.from('episode_likes').update({ is_like: isLike }).eq('id', existing.id)
        setEpisodeLike(isLike)
      }
    } else {
      await supabase.from('episode_likes').insert({
        user_id: user.id,
        episode_id: selectedEpisode.id,
        is_like: isLike
      })
      setEpisodeLike(isLike)
    }
    loadEpisodeLikeForEpisode(selectedEpisode.id)
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
        <div className="text-white text-2xl">المسلسل غير موجود</div>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleWatchlist} className={isInWatchlist ? 'text-red-500' : ''}>
              <Heart className={`w-5 h-5 ${isInWatchlist ? 'fill-red-500' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <div className="pt-16">
        <div className="relative bg-black w-full" style={{ aspectRatio: '16 / 9' }}>
          {(selectedEpisode?.active_stream_url || selectedEpisode?.embed_url) ? (
            <VideoPlayer url={selectedEpisode.embed_url} activeStreamUrl={selectedEpisode.active_stream_url} title={selectedEpisode.title} contentId={selectedEpisode.id} contentType="episode" initialTime={resumeTime} onProgress={handleVideoProgress} className="absolute inset-0 w-full h-full" />
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-gray-400">اختر حلقة للمشاهدة</p>
            </div>
          )}
        </div>
      </div>

      {/* Episode like/dislike below video */}
      <div className="container mx-auto px-4 pt-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => toggleEpisodeLike(true)} className={episodeLike === true ? 'border-green-500 text-green-500' : 'border-gray-700 text-gray-400'}>
            <ThumbsUp className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-400">{episodeLikeCounts.likes}</span>
          <Button variant="outline" size="icon" onClick={() => toggleEpisodeLike(false)} className={episodeLike === false ? 'border-red-500 text-red-500' : 'border-gray-700 text-gray-400'}>
            <ThumbsDown className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-400">{episodeLikeCounts.dislikes}</span>
          {selectedEpisode && (
            <span className="text-sm text-gray-500">{selectedEpisode.views || 0} مشاهدة</span>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-start gap-4 mb-6">
              <img src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=200'} alt={show.title} className="w-32 h-48 object-cover rounded-lg hidden sm:block" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=200' }} />
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{show.title}</h1>
                <div className="flex items-center gap-3 text-gray-400 mb-3 flex-wrap">
                  {show.category && <Badge className="bg-red-600">{show.category}</Badge>}
                  <Badge className="bg-blue-600">{show.total_seasons || seasons.length} مواسم</Badge>
                  <Badge variant="outline">{totalEpisodes()} حلقة</Badge>
                </div>
                {selectedEpisode && <p className="text-gray-400 mb-2">الآن: {selectedEpisode.title}</p>}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                    <span className="font-bold">{show.average_rating || '0.0'}</span>
                  </div>
                  <span className="text-gray-400">{show.views || 0} مشاهدة</span>
                </div>
                <p className={`text-gray-300 leading-relaxed ${!showFullDesc ? 'line-clamp-2 sm:line-clamp-none' : ''}`}>{show.description}</p>
                {show.description && show.description.length > 100 && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-red-500 hover:text-red-400 text-sm mt-1 sm:hidden">
                    {showFullDesc ? 'عرض أقل' : 'عرض المزيد'}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable episodes list - grouped by season */}
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ListVideo className="w-5 h-5" />
                  الحلقات ({totalEpisodes()})
                </h3>

                {seasons.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">لا توجد حلقات متاحة بعد</p>
                ) : (
                  <>
                    {/* Season Tabs */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                      {seasons.map((season) => (
                        <button
                          key={season.id}
                          onClick={() => {
                            setSelectedSeason(season)
                            if (season.episodes.length > 0 && !season.episodes.find(e => e.id === selectedEpisode?.id)) {
                              setSelectedEpisode(season.episodes[0])
                            }
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition shrink-0 ${
                            selectedSeason?.id === season.id
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <Disc className="w-4 h-4" />
                          {season.title || `الموسم ${season.season_number}`}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            selectedSeason?.id === season.id ? 'bg-red-700' : 'bg-gray-700'
                          }`}>
                            {season.episodes.length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Episodes of selected season */}
                    {selectedSeason && (
                      <div className="max-h-[400px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                        {selectedSeason.episodes.length === 0 ? (
                          <p className="text-gray-400 text-center py-8">لا توجد حلقات في هذا الموسم</p>
                        ) : (
                          selectedSeason.episodes.map((ep) => {
                            const progress = episodeProgress[ep.id]
                            const pct = progress && progress.duration > 0 ? Math.min(100, Math.round((progress.time / progress.duration) * 100)) : 0
                            return (
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
                                <div className="flex-1 text-right">
                                  <div className="font-semibold text-sm">
                                    الحلقة {ep.episode_number}: {ep.title || `الحلقة ${ep.episode_number}`}
                                  </div>
                                  {progress && progress.time > 0 && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[10px] text-gray-500 shrink-0 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {Math.floor(progress.time / 60)}:{String(progress.time % 60).padStart(2, '0')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 shrink-0">{ep.views || 0} مشاهدة</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rating */}
            <Card className="bg-gray-900 border-gray-800 mb-6">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">قيّم هذا المسلسل</h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => handleRating(star)} className="transition hover:scale-110">
                      <Star className={`w-8 h-8 ${star <= userRating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'}`} />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comments - scrollable, latest 10 */}
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
                      className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white min-h-[80px] focus:outline-none focus:border-red-600"
                    />
                    <Button type="submit" className="mt-2 bg-red-600 hover:bg-red-700">إرسال</Button>
                  </form>
                ) : (
                  <button onClick={() => router.push('/auth')} className="text-red-500 hover:text-red-400 mb-6 block">
                    سجّل الدخول لإضافة تعليق
                  </button>
                )}

                {comments.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">لا توجد تعليقات بعد</p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                    <div className="space-y-4">
                      {comments.slice(0, 3).map((comment) => (
                        <div key={comment.id} className="border-b border-gray-800 pb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                              {comment.user_profile?.display_name?.[0] || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold">{comment.user_profile?.display_name || 'مستخدم'}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(comment.created_at).toLocaleDateString('ar')}
                              </div>
                            </div>
                          </div>
                          <p className="text-gray-300 mb-2">{sanitize(comment.content)}</p>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => toggleCommentLike(comment.id, true)}
                              className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-500 transition"
                            >
                              <ThumbsUp className="w-4 h-4" />
                              <span>{commentLikes[comment.id]?.likes || 0}</span>
                            </button>
                            <button
                              onClick={() => toggleCommentLike(comment.id, false)}
                              className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition"
                            >
                              <ThumbsDown className="w-4 h-4" />
                              <span>{commentLikes[comment.id]?.dislikes || 0}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {comments.length > 3 && (
                      <div className="pt-4 space-y-4">
                        {comments.slice(3).map((comment) => (
                          <div key={comment.id} className="border-b border-gray-800 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                                {comment.user_profile?.display_name?.[0] || 'U'}
                              </div>
                              <div>
                                <div className="font-semibold">{comment.user_profile?.display_name || 'مستخدم'}</div>
                                <div className="text-xs text-gray-400">
                                  {new Date(comment.created_at).toLocaleDateString('ar')}
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-300 mb-2">{sanitize(comment.content)}</p>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => toggleCommentLike(comment.id, true)}
                                className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-500 transition"
                              >
                                <ThumbsUp className="w-4 h-4" />
                                <span>{commentLikes[comment.id]?.likes || 0}</span>
                              </button>
                              <button
                                onClick={() => toggleCommentLike(comment.id, false)}
                                className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition"
                              >
                                <ThumbsDown className="w-4 h-4" />
                                <span>{commentLikes[comment.id]?.dislikes || 0}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">معلومات المسلسل</h3>
                <dl className="space-y-3">
                  <div><dt className="text-gray-400 text-sm">التصنيف</dt><dd className="font-semibold">{show.category || 'غير محدد'}</dd></div>
                  <div><dt className="text-gray-400 text-sm">عدد المواسم</dt><dd className="font-semibold">{show.total_seasons || seasons.length}</dd></div>
                  <div><dt className="text-gray-400 text-sm">عدد الحلقات</dt><dd className="font-semibold">{totalEpisodes()}</dd></div>
                  <div><dt className="text-gray-400 text-sm">عدد المشاهدات</dt><dd className="font-semibold">{show.views || 0}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
