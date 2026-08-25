'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getCurrentUser, getUserProfile } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Star, ArrowRight, Play, ListVideo, ThumbsUp, ThumbsDown, Disc, Clock, Bookmark, Share2, Calendar, Eye, Clapperboard, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

function sanitize(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export default function SeriesDetail() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [commentLikes, setCommentLikes] = useState({})
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [episodeProgress, setEpisodeProgress] = useState({})

  useEffect(() => { initSeries() }, [params.id])

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
    const { data } = await supabase.from('series').select('*').eq('id', params.id).single()
    if (data) {
      setShow(data)
      await loadSeasons(data.id, u)
      loadComments(data.id)
      let sessionId = localStorage.getItem('nootv_session')
      if (!sessionId) { sessionId = crypto.randomUUID(); localStorage.setItem('nootv_session', sessionId) }
      const { data: existing } = await supabase.from('view_tracking').select('id').eq('session_id', sessionId).eq('content_type', 'series').eq('content_id', params.id).maybeSingle()
      if (!existing) {
        await supabase.from('view_tracking').insert({ session_id: sessionId, content_type: 'series', content_id: params.id })
        await supabase.rpc('increment_series_views', { sid: params.id })
      }
    }
    setLoading(false)
  }

  const loadSeasons = async (seriesId, currentUser) => {
    const { data: seasonsData } = await supabase.from('seasons').select('*').eq('series_id', seriesId).eq('is_active', true).order('season_number', { ascending: true })
    if (!seasonsData || seasonsData.length === 0) { setSeasons([]); return }
    const seasonIds = seasonsData.map((s) => s.id)
    const { data: episodesData } = await supabase.from('episodes').select('*').in('season_id', seasonIds).eq('is_active', true).order('episode_number', { ascending: true })
    const withEpisodes = seasonsData.map((season) => ({ ...season, episodes: (episodesData || []).filter((ep) => ep.season_id === season.id) }))
    setSeasons(withEpisodes)
    if (currentUser) {
      const { data: history } = await supabase.from('watch_history').select('episode_id, watched_time, duration, watched_at').eq('user_id', currentUser.id).eq('content_type', 'episode').order('watched_at', { ascending: false })
      const progressMap = {}
      const historyList = history || []
      historyList.forEach(h => { if (h.episode_id && h.watched_time > 0) progressMap[h.episode_id] = { time: h.watched_time, duration: h.duration || 0 } })
      setEpisodeProgress(progressMap)
    }
    const firstSeason = withEpisodes.find((s) => s.episodes.length > 0)
    if (firstSeason) setSelectedSeason(firstSeason)
  }

  const loadComments = async (seriesId) => {
    const { data: commentsData } = await supabase.from('comments').select('*').eq('series_id', seriesId).order('created_at', { ascending: false })
    if (!commentsData || commentsData.length === 0) { setComments([]); return }
    const userIds = [...new Set(commentsData.map(c => c.user_id))]
    const { data: profiles } = await supabase.from('users').select('id, display_name, avatar_url').in('id', userIds)
    const profilesMap = {}
    ;(profiles || []).forEach(p => { profilesMap[p.id] = p })
    const enriched = commentsData.map(c => ({ ...c, user_profile: profilesMap[c.user_id] || { display_name: 'مستخدم' } }))
    setComments(enriched)
    loadCommentLikes(enriched.map(c => c.id))
  }

  const loadCommentLikes = async (commentIds) => {
    if (!commentIds.length) return
    const { data } = await supabase.from('comment_likes').select('comment_id, is_like').in('comment_id', commentIds)
    const likes = {}
    ;(data || []).forEach(l => { if (!likes[l.comment_id]) likes[l.comment_id] = { likes: 0, dislikes: 0 }; if (l.is_like) likes[l.comment_id].likes++; else likes[l.comment_id].dislikes++ })
    setCommentLikes(likes)
  }

  const toggleCommentLike = async (commentId, isLike) => {
    if (!user) { router.push('/auth'); return }
    const { data: existing } = await supabase.from('comment_likes').select('id, is_like').eq('user_id', user.id).eq('comment_id', commentId).maybeSingle()
    if (existing) {
      if (existing.is_like === isLike) await supabase.from('comment_likes').delete().eq('id', existing.id)
      else await supabase.from('comment_likes').update({ is_like: isLike }).eq('id', existing.id)
    } else {
      await supabase.from('comment_likes').insert({ user_id: user.id, comment_id: commentId, is_like: isLike })
    }
    loadCommentLikes(comments.map(c => c.id))
  }

  const checkWatchlist = async (userId) => {
    const { data } = await supabase.from('watchlist').select('id').eq('user_id', userId).eq('series_id', params.id).maybeSingle()
    setIsInWatchlist(!!data)
  }

  const loadUserRating = async (userId) => {
    const { data } = await supabase.from('ratings').select('rating_value').eq('user_id', userId).eq('series_id', params.id).maybeSingle()
    if (data) setUserRating(data.rating_value)
  }

  const toggleWatchlist = async () => {
    if (!user) { router.push('/auth'); return }
    if (isInWatchlist) { await supabase.from('watchlist').delete().eq('user_id', user.id).eq('series_id', params.id); setIsInWatchlist(false); toast({ title: 'تم الحذف من المفضلة' }) }
    else { await supabase.from('watchlist').insert({ user_id: user.id, series_id: params.id }); setIsInWatchlist(true); toast({ title: 'تم الإضافة إلى المفضلة' }) }
  }

  const handleRating = async (rating) => {
    if (!user) { router.push('/auth'); return }
    await supabase.from('ratings').upsert({ user_id: user.id, series_id: params.id, rating_value: rating })
    setUserRating(rating)
    toast({ title: `تم التقييم ${rating}/5` })
    const { data: ratings } = await supabase.from('ratings').select('rating_value').eq('series_id', params.id)
    if (ratings && ratings.length > 0) { const avg = ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length; await supabase.from('series').update({ average_rating: avg.toFixed(1) }).eq('id', params.id) }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) { router.push('/auth'); return }
    if (!newComment.trim()) return
    await supabase.from('comments').insert({ user_id: user.id, series_id: params.id, content: newComment, is_approved: true })
    setNewComment('')
    loadComments(params.id)
    toast({ title: 'تم إضافة التعليق' })
  }

  const totalEpisodes = () => seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-white/40 text-sm">جاري التحميل...</span>
      </div>
    </div>
  )
  if (!show) return <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl">المسلسل غير موجود</div>

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
              <ArrowRight className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-primary hidden sm:block">NOO TV</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleWatchlist} className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isInWatchlist ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
              <Bookmark className={`w-5 h-5 ${isInWatchlist ? 'fill-current' : ''}`} />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[85vh] sm:min-h-screen flex items-end overflow-hidden">
        {/* Backdrop with Ken Burns effect */}
        <div className="absolute inset-0">
          <img
            src={show.banner || show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=1920'}
            alt={show.title}
            className="w-full h-full object-cover scale-105 animate-[kenBurns_20s_ease-in-out_infinite_alternate]"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=1920' }}
          />
          {/* Multi-layer cinematic gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent h-1/3" />
          {/* Vignette */}
          <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-4 sm:px-6 pb-12 sm:pb-20 pt-32">
          <div className="max-w-3xl">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
              {show.category && <Badge className="bg-primary/90 text-white px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide">{show.category}</Badge>}
              {show.release_year && (
                <Badge variant="outline" className="border-white/20 text-white/70 px-3 py-1.5 text-xs sm:text-sm flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {show.release_year}
                </Badge>
              )}
              {show.is_translated && <Badge className="bg-emerald-600/90 text-white px-3 py-1.5 text-xs sm:text-sm">مترجم</Badge>}
              {show.is_dubbed && <Badge className="bg-sky-600/90 text-white px-3 py-1.5 text-xs sm:text-sm">مدبلج</Badge>}
              <Badge variant="outline" className="border-white/20 text-white/70 px-3 py-1.5 text-xs sm:text-sm flex items-center gap-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                {show.total_seasons || seasons.length} مواسم
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white/70 px-3 py-1.5 text-xs sm:text-sm flex items-center gap-1.5">
                <ListVideo className="w-3.5 h-3.5" />
                {totalEpisodes()} حلقة
              </Badge>
            </div>

            {/* Title - H1 for SEO */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-5 sm:mb-6 leading-[1.1] tracking-tight">
              <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
                {show.title}
              </span>
            </h1>

            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-lg">{show.average_rating || '0.0'}</span>
                <span className="text-white/40 text-sm">/5</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-sm">
                <Eye className="w-4 h-4" />
                <span>{(show.views || 0).toLocaleString()} مشاهدة</span>
              </div>
              {show.release_day && (
                <div className="flex items-center gap-1.5 text-primary/80 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>يُنشر كل {show.release_day}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-8 sm:mb-10">
              <p className={`text-white/65 text-base sm:text-lg leading-relaxed ${!showFullDesc ? 'line-clamp-3 sm:line-clamp-none' : ''}`}>
                {show.description || 'لا يوجد وصف متاح لهذا المسلسل.'}
              </p>
              {show.description && show.description.length > 150 && (
                <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-primary hover:text-primary/80 text-sm mt-2 transition sm:hidden">
                  {showFullDesc ? 'عرض أقل' : 'اقرأ المزيد'}
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {/* Start Watching - first available episode */}
              {seasons.length > 0 && seasons.find(s => s.episodes?.length > 0) && (
                <Link
                  href={`/watch/series/${params.id}?episode=${seasons.find(s => s.episodes?.length > 0)?.episodes[0]?.id}`}
                  className="group flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  شاهد الآن
                </Link>
              )}
              <button
                onClick={toggleWatchlist}
                className={`flex items-center gap-3 px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 border ${
                  isInWatchlist
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                    : 'border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${isInWatchlist ? 'fill-current' : ''}`} />
                {isInWatchlist ? 'في المفضلة' : 'أضف للمفضلة'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== EPISODES & SEASONS ===== */}
      <section id="episodes-section" className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-1 h-8 bg-primary rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-bold">الحلقات والمواسم</h2>
        </div>

        {seasons.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <Disc className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-lg">لا توجد حلقات متاحة بعد</p>
          </div>
        ) : (
          <>
            {/* Season Tabs */}
            <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-thin">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  onClick={() => setSelectedSeason(season)}
                  className={`flex items-center gap-2 sm:gap-3 px-5 sm:px-6 py-3 rounded-xl text-sm sm:text-base font-semibold whitespace-nowrap transition-all duration-300 shrink-0 ${
                    selectedSeason?.id === season.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/25'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10 hover:border-white/20'
                  }`}
                >
                  <Disc className="w-4 h-4" />
                  {season.title || `الموسم ${season.season_number}`}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    selectedSeason?.id === season.id ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    {season.episodes.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Episode Grid */}
            {selectedSeason && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {selectedSeason.episodes.length === 0 ? (
                  <p className="text-white/40 text-center py-12 col-span-full">لا توجد حلقات في هذا الموسم</p>
                ) : (
                  selectedSeason.episodes.map((ep) => {
                    const progress = episodeProgress[ep.id]
                    const pct = progress && progress.duration > 0 ? Math.min(100, Math.round((progress.time / progress.duration) * 100)) : 0
                    return (
                      <Link
                        key={ep.id}
                        href={`/watch/series/${params.id}?episode=${ep.id}`}
                        className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 text-right hover:shadow-xl"
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-video overflow-hidden bg-white/5">
                          <img
                            src={ep.thumbnail || show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=600'}
                            alt={ep.title || `الحلقة ${ep.episode_number}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=600' }}
                          />
                          {/* Dark overlay for readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                          {/* Episode Number Badge - top left */}
                          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider border border-white/10">
                            E{String(ep.episode_number).padStart(2, '0')}
                          </div>
                          {/* Play overlay on hover */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-500 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-all duration-500 opacity-0 group-hover:opacity-100">
                              <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                            </div>
                          </div>
                          {/* Progress bar */}
                          {pct > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3.5 sm:p-4">
                          <h4 className="font-bold text-sm sm:text-base text-white/90 mb-1.5 truncate">
                            {ep.title || `الحلقة ${ep.episode_number}`}
                          </h4>
                          {ep.description && (
                            <p className="text-xs text-white/35 mb-2 line-clamp-1">{ep.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <span>{ep.views || 0} مشاهدة</span>
                            {pct > 0 && (
                              <>
                                <span className="text-white/20">·</span>
                                <span className="text-primary font-medium">{pct}% مكتمل</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== RATING & COMMENTS ===== */}
      <section className="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* Rating */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">قيّم هذا المسلسل</h3>
              <div className="flex gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => handleRating(star)} className="transition hover:scale-110 active:scale-95">
                    <Star className={`w-8 h-8 sm:w-10 sm:h-10 ${star <= userRating ? 'fill-yellow-500 text-yellow-500' : 'text-white/20 hover:text-white/40'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-3">
                <MessageCircle className="w-6 h-6 text-primary" />
                التعليقات ({comments.length})
              </h3>

              {user ? (
                <form onSubmit={handleComment} className="mb-6 sm:mb-8">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="أضف تعليقك..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white min-h-[100px] focus:outline-none focus:border-primary/50 transition resize-none"
                  />
                  <button type="submit" className="mt-3 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-semibold transition">إرسال</button>
                </form>
              ) : (
                <button onClick={() => router.push('/auth')} className="text-primary hover:text-primary/80 mb-6 sm:mb-8 block transition">
                  سجّل الدخول لإضافة تعليق
                </button>
              )}

              {comments.length === 0 ? (
                <p className="text-white/30 text-center py-12">لا توجد تعليقات بعد</p>
              ) : (
                <div className="space-y-4 sm:space-y-5">
                  {comments.slice(0, 10).map((comment) => (
                    <div key={comment.id} className="border-b border-white/5 pb-4 sm:pb-5 last:border-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                          {comment.user_profile?.display_name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{comment.user_profile?.display_name || 'مستخدم'}</div>
                          <div className="text-xs text-white/30">{new Date(comment.created_at).toLocaleDateString('ar')}</div>
                        </div>
                      </div>
                      <p className="text-white/70 mb-3 text-sm sm:text-base">{sanitize(comment.content)}</p>
                      <div className="flex items-center gap-4">
                        <button onClick={() => toggleCommentLike(comment.id, true)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-emerald-500 transition">
                          <ThumbsUp className="w-4 h-4" />
                          <span>{commentLikes[comment.id]?.likes || 0}</span>
                        </button>
                        <button onClick={() => toggleCommentLike(comment.id, false)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-red-500 transition">
                          <ThumbsDown className="w-4 h-4" />
                          <span>{commentLikes[comment.id]?.dislikes || 0}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8">
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">معلومات المسلسل</h3>
              <dl className="space-y-4">
                {[
                  { label: 'التصنيف', value: show.category || 'غير محدد' },
                  { label: 'المواسم', value: show.total_seasons || seasons.length },
                  { label: 'الحلقات', value: totalEpisodes() },
                  { label: 'المشاهدات', value: (show.views || 0).toLocaleString() },
                  { label: 'التقييم', value: `${show.average_rating || '0.0'} / 5` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <dt className="text-white/40 text-sm">{item.label}</dt>
                    <dd className="font-semibold text-sm">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
