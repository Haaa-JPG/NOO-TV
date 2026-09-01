'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser, signOut } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Heart, Clock, Settings, LogOut, Play, Disc, Trash2, User, Shield, Palette, Camera, Check, AlertCircle, Eye, EyeOff, Monitor } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/lib/language-context'
import { useTheme } from '@/lib/theme-context'

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Daisy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Rocky',
]

export default function UserDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const { t, language, changeLanguage } = useLanguage()
  const { theme, changeTheme } = useTheme()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState([])
  const [watchHistory, setWatchHistory] = useState([])

  const [profile, setProfile] = useState({
    display_name: '',
    avatar_url: '',
  })

  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: '',
  })
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  useEffect(() => {
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
      avatar_url: user.user_metadata?.avatar_url || '',
    })

    if (user.user_metadata?.language) {
      changeLanguage(user.user_metadata.language)
    }
    if (user.user_metadata?.theme) {
      changeTheme(user.user_metadata.theme)
    }

    loadData(user.id)
    setLoading(false)
  }

  const loadData = async (userId) => {
    const { data: watchlistData } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    const items = watchlistData || []
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

    const { data: historyData } = await supabase
      .from('watch_history')
      .select('*, episodes(*, seasons(series_id, title, season_number))')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(40)

    const history = historyData || []
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
        data: {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        },
      })
      if (error) throw error

      if (user) {
        await supabase
          .from('users')
          .update({
            display_name: profile.display_name || null,
            avatar_url: profile.avatar_url || null,
          })
          .eq('id', user.id)
      }

      toast({ title: t('profileUpdated') })
    } catch (error) {
      toast({ title: t('errorOccurred'), description: error.message, variant: 'destructive' })
    }
  }

  const handleUpdatePreferences = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { language, theme },
      })
      if (error) throw error

      if (user) {
        await supabase
          .from('users')
          .update({ language, theme })
          .eq('id', user.id)
      }

      toast({ title: t('preferencesUpdated') })
    } catch (error) {
      toast({ title: t('errorOccurred'), description: error.message, variant: 'destructive' })
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwords.newPass !== passwords.confirm) {
      toast({ title: t('passwordsDoNotMatch'), variant: 'destructive' })
      return
    }
    if (passwords.newPass.length < 8) {
      toast({ title: t('passwordMinLength'), variant: 'destructive' })
      return
    }

    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwords.current,
      })
      if (signInError) {
        toast({ title: t('wrongCurrentPassword'), variant: 'destructive' })
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: passwords.newPass,
      })
      if (error) throw error

      setPasswords({ current: '', newPass: '', confirm: '' })
      toast({ title: t('passwordChanged') })
    } catch (error) {
      toast({ title: t('errorOccurred'), description: error.message, variant: 'destructive' })
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const removeFromWatchlist = async (id) => {
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (!error) {
      toast({ title: t('removedFromWatchlist') })
      loadData(user.id)
    }
  }

  const removeFromHistory = async (id) => {
    const { error } = await supabase.from('watch_history').delete().eq('id', id)
    if (!error) {
      setWatchHistory(prev => prev.filter(h => h.id !== id))
      toast({ title: t('removedFromWatchlist') })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 hidden sm:block">{user?.email}</span>
            <Button onClick={handleSignOut} variant="outline" size="sm" className="border-gray-700">
              <LogOut className="w-4 h-4 ml-2" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{t('myAccountTitle')}</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-900/80 backdrop-blur-xl mb-6 border border-gray-800/50">
            <TabsTrigger value="watchlist" className="data-[state=active]:bg-red-600">
              <Heart className="w-4 h-4 ml-2" />
              {t('watchlist')}
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-red-600">
              <Clock className="w-4 h-4 ml-2" />
              {t('history')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-red-600">
              <Settings className="w-4 h-4 ml-2" />
              {t('settings')}
            </TabsTrigger>
          </TabsList>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist">
            {watchlist.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400">{t('nothingInWatchlist')}</h3>
                <p className="text-gray-600 mt-2">{t('startAddingFavorites')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {watchlist.map((item) => {
                  const content = item.content
                  if (!content) return null
                  const isMovie = !!item.movie_id
                  return (
                    <Card key={item.id} className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50 group">
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
                        <Button size="sm" variant="outline" className="w-full border-gray-700" onClick={() => removeFromWatchlist(item.id)}>
                          {t('remove')}
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
                <h3 className="text-xl text-gray-400">{t('noWatchHistory')}</h3>
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
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-lg hover:bg-gray-800/50 transition group">
                        <Link href={`/watch/movie/${item.movie.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden">
                            <img src={item.movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100'} alt={item.movie.title} className="w-full h-full object-cover" />
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
                              <Play className="w-2.5 h-2.5" />
                              {progressPct > 0 && (
                                <>
                                  <span className="text-red-400">{elapsedMin}:{elapsedSec}</span>
                                  <span className="text-gray-500">({progressPct}%)</span>
                                </>
                              )}
                              <span className="text-gray-500">{new Date(item.watched_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en')}</span>
                            </div>
                          </div>
                          <span className="text-xs text-red-500 shrink-0 hidden sm:block">{progressPct > 0 ? t('continue') : t('watch')}</span>
                        </Link>
                        <button onClick={(e) => { e.preventDefault(); removeFromHistory(item.id) }} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  }

                  if (item.episode) {
                    const seriesTitle = item.season?.title || t('series')
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-lg hover:bg-gray-800/50 transition group">
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
                            <h3 className="font-semibold text-sm truncate">{item.episode.title || `${t('seasons')} ${item.episode.episode_number}`}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Play className="w-2.5 h-2.5" /> {seriesTitle}
                              {progressPct > 0 && (
                                <>
                                  <span className="text-red-400">{elapsedMin}:{elapsedSec}</span>
                                  <span className="text-gray-500">({progressPct}%)</span>
                                </>
                              )}
                              <span className="text-gray-500">{new Date(item.watched_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en')}</span>
                            </div>
                          </div>
                          <span className="text-xs text-red-500 shrink-0 hidden sm:block">{progressPct > 0 ? t('continue') : t('watch')}</span>
                        </Link>
                        <button onClick={(e) => { e.preventDefault(); removeFromHistory(item.id) }} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100 shrink-0">
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
            <div className="max-w-2xl space-y-6">
              {/* Profile Info Card */}
              <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-red-500" />
                    {t('profileInfo')}
                  </CardTitle>
                  <p className="text-sm text-gray-400">{t('profileInfoDesc')}</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={profile.avatar_url || AVATARS[0]}
                          alt="Avatar"
                          className="w-20 h-20 rounded-full border-2 border-gray-700 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                          className="absolute bottom-0 right-0 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">{t('avatar')}</p>
                        <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="text-sm text-red-500 hover:text-red-400">
                          {t('chooseAvatar')}
                        </button>
                      </div>
                    </div>

                    {showAvatarPicker && (
                      <div className="grid grid-cols-4 gap-3 p-3 bg-black/50 rounded-lg border border-gray-800">
                        {AVATARS.map((avatar) => (
                          <button
                            key={avatar}
                            type="button"
                            onClick={() => {
                              setProfile({ ...profile, avatar_url: avatar })
                              setShowAvatarPicker(false)
                            }}
                            className={`w-16 h-16 rounded-full border-2 overflow-hidden hover:scale-110 transition ${
                              profile.avatar_url === avatar ? 'border-red-500' : 'border-gray-700'
                            }`}
                          >
                            <img src={avatar} alt="Avatar option" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <Label className="text-gray-300">{t('emailReadOnly')}</Label>
                      <Input value={user?.email} disabled className="bg-black/50 border-gray-700 text-gray-400" />
                    </div>

                    <div>
                      <Label className="text-gray-300">{t('fullName')}</Label>
                      <Input
                        value={profile.display_name}
                        onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                        className="bg-black/50 border-gray-700"
                        placeholder={t('enterName')}
                      />
                    </div>

                    <Button type="submit" className="bg-red-600 hover:bg-red-700">
                      {t('saveChanges')}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Preferences Card */}
              <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-red-500" />
                    {t('preferences')}
                  </CardTitle>
                  <p className="text-sm text-gray-400">{t('preferencesDesc')}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300">{t('preferredLanguage')}</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => changeLanguage('en')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${
                          language === 'en'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-gray-700 bg-black/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-lg">🇬🇧</span>
                        <span>{t('english')}</span>
                        {language === 'en' && <Check className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => changeLanguage('ar')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${
                          language === 'ar'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-gray-700 bg-black/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-lg">🇸🇦</span>
                        <span>{t('arabic')}</span>
                        {language === 'ar' && <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300">{t('theme')}</Label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => changeTheme('dark')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${
                          theme === 'dark'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-gray-700 bg-black/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span>🌙</span>
                        <span>{t('dark')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => changeTheme('light')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${
                          theme === 'light'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-gray-700 bg-black/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span>☀️</span>
                        <span>{t('light')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => changeTheme('system')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition ${
                          theme === 'system'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-gray-700 bg-black/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        <span>{t('system')}</span>
                      </button>
                    </div>
                  </div>

                  <Button onClick={handleUpdatePreferences} className="bg-red-600 hover:bg-red-700">
                    {t('saveChanges')}
                  </Button>
                </CardContent>
              </Card>

              {/* Security Card */}
              <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500" />
                    {t('security')}
                  </CardTitle>
                  <p className="text-sm text-gray-400">{t('securityDesc')}</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <Label className="text-gray-300">{t('currentPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={passwords.current}
                          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                          className="bg-black/50 border-gray-700 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-300">{t('newPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showNewPass ? 'text' : 'password'}
                          value={passwords.newPass}
                          onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                          className="bg-black/50 border-gray-700 pr-10"
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{t('passwordMinLength')}</p>
                    </div>

                    <div>
                      <Label className="text-gray-300">{t('confirmPassword')}</Label>
                      <Input
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        className="bg-black/50 border-gray-700"
                        required
                      />
                    </div>

                    <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={changingPassword}>
                      {changingPassword ? t('loading') : t('changePassword')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
