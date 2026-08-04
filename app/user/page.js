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
import { Heart, Clock, Settings, LogOut, Play } from 'lucide-react'
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
      .select('*, episodes(*)')
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
      // Episode entries carry the episode via the embedded relation.
      // Resolve episode -> season -> series for a nicer title.
      return { ...h, episode: h.episodes || null }
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
              <div className="space-y-3">
                {watchHistory.map((item) => {
                  // Movie entries
                  if (item.content_type === 'movie' && item.movie) {
                    return (
                      <Card key={item.id} className="bg-gray-900 border-gray-800">
                        <CardContent className="p-4 flex items-center gap-4">
                          <img
                            src={item.movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100'}
                            alt={item.movie.title}
                            className="w-20 h-28 object-cover rounded"
                          />
                          <div className="flex-1">
                            <Link href={`/watch/movie/${item.movie.id}`} className="hover:text-red-500 transition">
                              <h3 className="font-bold text-lg">{item.movie.title}</h3>
                            </Link>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                              <Play className="w-3 h-3" /> فيلم
                              <span>•</span>
                              <span>شاهدت في: {new Date(item.watched_at).toLocaleDateString('ar')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }

                  // Episode entries
                  if (item.episode) {
                    return (
                      <Card key={item.id} className="bg-gray-900 border-gray-800">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-20 h-28 bg-gray-800 rounded flex items-center justify-center">
                            <Play className="w-6 h-6 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{item.episode.title || `الحلقة ${item.episode.episode_number}`}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                              <Play className="w-3 h-3" /> حلقة مسلسل (تعرف على المسلسل من صفحة المشاهدة)
                              <span>•</span>
                              <span>شاهدت في: {new Date(item.watched_at).toLocaleDateString('ar')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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