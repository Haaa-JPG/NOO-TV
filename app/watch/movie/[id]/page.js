'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Star, Share2, ArrowRight, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import VideoPlayer from '@/components/video-player'

export default function WatchMovie() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    loadMovie()
    checkUser()
  }, [params.id])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    setUser(user)
    if (user) {
      checkWatchlist(user.id)
      loadUserRating(user.id)
      recordWatchHistory(user.id)
    }
  }

  const recordWatchHistory = async (userId) => {
    await supabase
      .from('watch_history')
      .insert({
        user_id: userId,
        content_id: params.id,
        content_type: 'movie',
      })
  }

  const loadMovie = async () => {
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .eq('id', params.id)
      .single()

    if (data) {
      setMovie(data)
      // Update view count
      await supabase
        .from('movies')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', params.id)
      
      loadComments(params.id)
    }
    setLoading(false)
  }

  const loadComments = async (movieId) => {
    const { data } = await supabase
      .from('comments')
      .select('*, users(display_name, avatar_url)')
      .eq('movie_id', movieId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
    
    if (data) setComments(data)
  }

  const checkWatchlist = async (userId) => {
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('movie_id', params.id)
      .single()
    
    setIsInWatchlist(!!data)
  }

  const loadUserRating = async (userId) => {
    const { data } = await supabase
      .from('ratings')
      .select('rating_value')
      .eq('user_id', userId)
      .eq('movie_id', params.id)
      .single()
    
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
        .eq('movie_id', params.id)
      setIsInWatchlist(false)
      toast({ title: 'تم الحذف من المفضلة' })
    } else {
      await supabase
        .from('watchlist')
        .insert({ user_id: user.id, movie_id: params.id })
      setIsInWatchlist(true)
      toast({ title: 'تم الإضافة إلى المفضلة' })
    }
  }

  const handleRating = async (rating) => {
    if (!user) {
      router.push('/auth')
      return
    }

    // Upsert rating
    await supabase
      .from('ratings')
      .upsert({
        user_id: user.id,
        movie_id: params.id,
        rating_value: rating
      })
    
    setUserRating(rating)
    toast({ title: `تم التقييم ${rating}/5` })

    // Recalculate average
    const { data: ratings } = await supabase
      .from('ratings')
      .select('rating_value')
      .eq('movie_id', params.id)
    
    if (ratings) {
      const avg = ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length
      await supabase
        .from('movies')
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
        movie_id: params.id,
        content: newComment,
        is_approved: true // Auto-approve for now
      })
    
    setNewComment('')
    loadComments(params.id)
    toast({ title: 'تم إضافة التعليق' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">الفيلم غير موجود</div>
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
            <Button variant="ghost" size="icon">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Video Player */}
      <div className="pt-16">
        <div className="relative bg-black" style={{ paddingTop: '56.25%' }}>
          {movie.embed_url ? (
            <VideoPlayer
              url={movie.embed_url}
              title={movie.title}
              className="absolute top-0 right-0 w-full h-full"
            />
          ) : (
            <div className="absolute top-0 right-0 w-full h-full flex items-center justify-center bg-gray-900">
              <p className="text-gray-400">الفيديو غير متوفر حالياً</p>
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="md:col-span-2">
              <div className="flex items-start gap-4 mb-6">
                <img
                  src={movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=200'}
                  alt={movie.title}
                  className="w-32 h-48 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-2">{movie.title}</h1>
                  <div className="flex items-center gap-4 text-gray-400 mb-4">
                    <span>{movie.year}</span>
                    <span>•</span>
                    <span>{movie.language}</span>
                    <span>•</span>
                    {movie.quality && <Badge className="bg-red-600">{movie.quality}</Badge>}
                    {movie.is_dubbed && <Badge className="bg-blue-600">مدبلج</Badge>}
                    {movie.is_translated && <Badge className="bg-green-600">مترجم</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                      <span className="font-bold">{movie.average_rating || '0.0'}</span>
                    </div>
                    <span className="text-gray-400">{movie.views || 0} مشاهدة</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{movie.description}</p>
                </div>
              </div>

              {/* Rating */}
              <Card className="bg-gray-900 border-gray-800 mb-6">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4">قيّم هذا الفيلم</h3>
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

                  {user && (
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
                  <h3 className="text-xl font-bold mb-4">معلومات الفيلم</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-gray-400 text-sm">التصنيف</dt>
                      <dd className="font-semibold">{movie.category || 'غير محدد'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">سنة الإنتاج</dt>
                      <dd className="font-semibold">{movie.year}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">اللغة</dt>
                      <dd className="font-semibold">{movie.language}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">الجودة</dt>
                      <dd className="font-semibold">{movie.quality}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400 text-sm">عدد المشاهدات</dt>
                      <dd className="font-semibold">{movie.views || 0}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
