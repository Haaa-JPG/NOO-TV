'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser, signOut } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Heart, Clock, Settings, LogOut, Play, Disc, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

export default function UserDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState([])
  const [watchHistory, setWatchHistory] = useState([])
  const [profile, setProfile] = useState({
    display_name: '',
    language: 'ar',
    theme: 'dark',
  })

  useEffect(() => {
    // Support ?tab=watchlist | history | settings
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && ['watchlist', 'history', 'settings'].includes(tab)) {
      setActiveTab(tab)
    }
    checkUser()
  }, [])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth')
      return
    }
    setUser(user)
    setProfile({
      display_name: user.user_metadata?.display_name || '',
      language: user.user_metadata?.language || 'ar',
      theme: user.user_metadata?.theme || 'dark',
    })
    loadData(user.id)
    setLoading(false)
  }

  const loadData = async (userId) => {
    // Load watchlist
    const { data: watchlistData } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    const items = watchlistData || []

    // Fetch linked movies and series
    const movieIds = items.filter((i) => i.movie_id).map((i) => i.movie_id)
    const seriesIds = items.filter((i) => i.series_id).map((i) => i.series_id)
    const moviesMap = {}
    const seriesMap = {}

    if (movieIds.length > 0) {
      const { data } = await supabase.from('movies').select('*').in('id', movieIds)
      ;(data || []).forEach((m) => (moviesMap[m.id] = m))
    }
    if (seriesIds.length > 0) {
      const { data } = await supabase.from('series').select('*').in('id', seriesIds)
      ;(data || []).forEach((s) => (seriesMap[s.id] = s))
    }

    setWatchlist(
      items.map((item) => {
        const content = item.movie_id ? moviesMap[item.movie_id] : seriesMap[item.series_id]
        return { ...item, content }
      })
    )

    // Load watch history (movies + episodes)
    const { data: historyData } = await supabase
      .from('watch_history')
      .select('*, episodes(*, seasons(series_id, title, season_number))')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(40)

    const history = historyData || []

    // Fetch movie rows for movie history entries
    const movieContentIds = history
      .filter((h) => h.content_type === 'movie')
      .map((h) => h.content_id)
    const movieHistory = {}
    if (movieContentIds.length > 0) {
      const { data } = await supabase.from('movies').select('*').in('id', movieContentIds)
      ;(data || []).forEach((m) => (movieHistory[m.id] = m))
    }

    const enriched = history.map((h) => {
      if (h.content_type === 'movie') {
        return { ...h, movie: movieHistory[h.content_id] || null }
      }
      const ep = h.episodes || null
      const season = ep?.seasons || null
      const seriesId = season?.series_id || null
      return { ...h, episode: ep, season, seriesId }
    })

    setWatchHistory(enriched)
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.auth.updateUser({
        data: profile,
      })
      if (error) throw error
      toast({ title: 'تم تحديث الملف الشخصي' })

      // Keep public.users in sync
      if (user) {
        await supabase
          .from('users')
          .update({
            display_name: profile.display_name || null,
            language: profile.language,
            theme: profile.theme,
          })
          .eq('id', user.id)
      }
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const removeFromWatchlist = async (id) => {
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (!error) {
      toast({ title: 'تم الحذف من المفضلة' })
      loadData(user.id)
    }
  }

  const removeFromHistory = async (id) => {
    const { error } = await supabase.from('watch_history').delete().eq('id', id)
    if (!error) {
      setWatchHistory(prev => prev.filter(h => h.id !== id))
      toast({ title: 'تم الحذف من سجل المشاهدة' })
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
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 hidden sm:block">{user?.email}</span>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">حسابي</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-900 mb-6">
            <TabsTrigger value="watchlist" className="data-[state=active]:bg-red-600">
              <Heart className="w-4 h-4 ml-2" />
              المفضلة
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-red-600">
              <Clock className="w-4 h-4 ml-2" />
              سجل المشاهدة
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-red-600">
              <Settings className="w-4 h-4 ml-2" />
              الإعدادات
            </TabsTrigger>
          </TabsList>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist">
            {watchlist.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400">لا توجد عناصر في المفضلة</h3>
                <p className="text-gray-600 mt-2">ابدأ بإضافة أفلامك ومسلسلاتك المفضلة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {watchlist.map((item) => {
                  const content = item.content
                  if (!content) return null
                  const isMovie = !!item.movie_id
                  return (
                    <Card key={item.id} className="bg-gray-900 border-gray-800 group">
                      <Link href={`/watch/${isMovie ? 'movie' : 'series'}/${content.id}`}>
                        <div className="relative aspect-[2/3]">
                          <img
                            src={content.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'}
                            alt={content.title}
                            className="w-full h-full object-cover rounded-t-lg group-hover:scale-110 transition"
                          />
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold truncate">{content.title}</h3>
                          {content.year && <p className="text-sm text-gray-400 mt-1">{content.year}</p>}
                        </CardContent>
                      </Link>
                      <div className="px-3 pb-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => removeFromWatchlist(item.id)}
                        >
                          إزالة
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {watchHistory.length === 0 ? (
              <div className="text-center py-20">
                <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400">لا يوجد سجل مشاهدة</h3>
              </div>
            ) : (
              <div className="space-y-2">
                {watchHistory.map((item) => {
                  const progressPct = item.watched_time && item.duration && item.duration > 0
                    ? Math.min(100, Math.round((item.watched_time / item.duration) * 100))
                    : 0
                  const elapsed = item.watched_time || 0
                  const elapsedMin = Math.floor(elapsed / 60)
                  const elapsedSec = String(elapsed % 60).padStart(2, '0')

                  if (item.content_type === 'movie' && item.movie) {
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800/50 transition group">
                        <Link href={`/watch/movie/${item.movie.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden">
                            <img
                              src={item.movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100'}
                              alt={item.movie.title}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100' }}
                            />
                            {progressPct > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-0.5 py-px">
                                <div className="h-0.5 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-600 rounded-full" style={{ width: `${progressPct}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{item.movie.title}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Play className="w-2.5 h-2.5" /> فيلم
                              {progressPct > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-red-400">{elapsedMin}:{elapsedSec}</span>
                                  <span className="text-gray-500">({progressPct}%)</span>
                                </>
                              )}
                              <span>·</span>
                              <span className="text-gray-500">{new Date(item.watched_at).toLocaleDateString('ar')}</span>
                            </div>
                          </div>
                          <span className="text-xs text-red-500 shrink-0 hidden sm:block">{progressPct > 0 ? 'متابعة' : 'مشاهدة'}</span>
                        </Link>
                        <button
                          onClick={(e) => { e.preventDefault(); removeFromHistory(item.id) }}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  }

                  if (item.episode) {
                    const seriesTitle = item.season?.title || 'مسلسل'
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800/50 transition group">
                        <Link href={item.seriesId ? `/watch/series/${item.seriesId}?episode=${item.episode.id}` : '#'} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative w-10 h-14 shrink-0 rounded bg-gray-800 flex items-center justify-center">
                            <Disc className="w-4 h-4 text-gray-600" />
                            {progressPct > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-0.5 py-px">
                                <div className="h-0.5 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-600 rounded-full" style={{ width: `${progressPct}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{item.episode.title || `الحلقة ${item.episode.episode_number}`}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Play className="w-2.5 h-2.5" /> {seriesTitle}
                              {progressPct > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-red-400">{elapsedMin}:{elapsedSec}</span>
                                  <span className="text-gray-500">({progressPct}%)</span>
                                </>
                              )}
                              <span>·</span>
                              <span className="text-gray-500">{new Date(item.watched_at).toLocaleDateString('ar')}</span>
                            </div>
                          </div>
                          <span className="text-xs text-red-500 shrink-0 hidden sm:block">{progressPct > 0 ? 'متابعة' : 'مشاهدة'}</span>
                        </Link>
                        <button
                          onClick={(e) => { e.preventDefault(); removeFromHistory(item.id) }}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  }

                  return null
                })}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-gray-900 border-gray-800 max-w-2xl">
              <CardHeader>
                <CardTitle>إعدادات الحساب</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input value={user?.email} disabled className="bg-black border-gray-700" />
                  </div>

                  <div>
                    <Label>الاسم</Label>
                    <Input
                      value={profile.display_name}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                      className="bg-black border-gray-700"
                    />
                  </div>

                  <div>
                    <Label>اللغة المفضلة</Label>
                    <select
                      value={profile.language}
                      onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                      className="w-full bg-black border border-gray-700 rounded-md px-3 py-2 text-white"
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <Label>المظهر</Label>
                    <select
                      value={profile.theme}
                      onChange={(e) => setProfile({ ...profile, theme: e.target.value })}
                      className="w-full bg-black border border-gray-700 rounded-md px-3 py-2 text-white"
                    >
                      <option value="dark">داكن</option>
                      <option value="light">فاتح</option>
                    </select>
                  </div>

                  <Button type="submit" className="bg-red-600 hover:bg-red-700">
                    حفظ التغييرات
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}