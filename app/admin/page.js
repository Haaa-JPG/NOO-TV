'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser, signOut } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Film, Tv, Users, Plus, Edit, Trash2, Eye, EyeOff, LogOut, Tag, ListVideo, Ban, ChevronDown, Calendar, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

function sanitize(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function parseExpiry(embedUrl, lastRefreshed) {
  if (!embedUrl) return null
  try {
    const u = new URL(embedUrl)
    const s = parseInt(u.searchParams.get('s'))
    const e = parseInt(u.searchParams.get('e'))
    if (!s || !e) return null
    const createdAt = s
    const expiresAt = createdAt + e
    const now = Math.floor(Date.now() / 1000)
    const remaining = expiresAt - now
    return {
      expiresAt: new Date(expiresAt * 1000),
      remaining,
      expired: remaining <= 0,
      urgent: remaining > 0 && remaining < 3600,
      hoursLeft: Math.max(0, Math.floor(remaining / 3600)),
      minutesLeft: Math.max(0, Math.floor((remaining % 3600) / 60)),
    }
  } catch {
    return null
  }
}

function ExpiryBadge({ embedUrl, lastRefreshed }) {
  const info = parseExpiry(embedUrl, lastRefreshed)
  if (!info) return null
  if (info.expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        منتهي الصلاحية
      </span>
    )
  }
  if (info.urgent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        ينتهي خلال {info.minutesLeft} دقيقة
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      صالح ({info.hoursLeft}س {info.minutesLeft}د)
    </span>
  )
}

const emptyMovieForm = () => ({
  title: '',
  description: '',
  embed_url: '',
  thumbnail: '',
  banner: '',
  category: '',
  year: new Date().getFullYear(),
  language: 'ar',
  quality: 'HD',
  is_translated: false,
  is_dubbed: false,
  is_active: true,
  display_order: 0,
})

const emptySeriesForm = () => ({
  title: '',
  description: '',
  category: '',
  total_seasons: 1,
  thumbnail: '',
  banner: '',
  is_translated: false,
  is_dubbed: false,
  is_active: true,
  display_order: 0,
  release_day: '',
})

const DAYS_OF_WEEK = [
  { value: 'السبت', label: 'السبت' },
  { value: 'الأحد', label: 'الأحد' },
  { value: 'الاثنين', label: 'الاثنين' },
  { value: 'الثلاثاء', label: 'الثلاثاء' },
  { value: 'الأربعاء', label: 'الأربعاء' },
  { value: 'الخميس', label: 'الخميس' },
  { value: 'الجمعة', label: 'الجمعة' },
]

const DAY_ORDER = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

const emptyCategoryForm = () => ({
  name: '',
  content_type: 'movie',
  icon: '',
  is_active: true,
  display_order: 0,
})

export default function AdminPanel() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('movies')

  // Movies
  const [movies, setMovies] = useState([])
  const [showMovieForm, setShowMovieForm] = useState(false)
  const [movieForm, setMovieForm] = useState(emptyMovieForm())
  const [editingMovie, setEditingMovie] = useState(null)

  // Series
  const [series, setSeries] = useState([])
  const [showSeriesForm, setShowSeriesForm] = useState(false)
  const [seriesForm, setSeriesForm] = useState(emptySeriesForm())
  const [editingSeries, setEditingSeries] = useState(null)
  const [manageSeries, setManageSeries] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [showSeasonForm, setShowSeasonForm] = useState(false)
  const [seasonForm, setSeasonForm] = useState({ season_number: 1, title: '', display_order: 0, is_active: true })
  const [showEpisodeForm, setShowEpisodeForm] = useState(false)
  const [episodeForm, setEpisodeForm] = useState({ episode_number: 1, title: '', embed_url: '', thumbnail: '', duration: 0, display_order: 0, is_active: true })
  const [editingEpisode, setEditingEpisode] = useState(null)
  const [episodeDefaults, setEpisodeDefaults] = useState({ title: '', thumbnail: '', duration: 0 })

  // Categories
  const [categories, setCategories] = useState([])
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm())
  const [editingCategory, setEditingCategory] = useState(null)

  // Users
  const [users, setUsers] = useState([])

  // Complaints
  const [complaints, setComplaints] = useState([])

  // Stats
  const [stats, setStats] = useState({
    totalMovies: 0,
    totalSeries: 0,
    totalUsers: 0,
    totalViews: 0,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth')
      return
    }

    // Check if admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'admin') {
      toast({
        title: 'غير مصرح',
        description: 'ليس لديك صلاحية للوصول',
        variant: 'destructive',
      })
      router.push('/')
      return
    }

    setUser(user)
    loadData()
    setLoading(false)
  }

  const loadData = async () => {
    // Load movies
    const { data: moviesData } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })
    if (moviesData) setMovies(moviesData)

    // Load series
    const { data: seriesData } = await supabase
      .from('series')
      .select('*')
      .order('created_at', { ascending: false })
    if (seriesData) setSeries(seriesData)

    // Load categories
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true })
    if (categoriesData) setCategories(categoriesData)

    // Load users from public.users (works with client anon key)
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (usersData) setUsers(usersData)

    // Load complaints
    const { data: complaintsData } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false })
    if (complaintsData) setComplaints(complaintsData)

    // Calculate stats
    setStats({
      totalMovies: moviesData?.length || 0,
      totalSeries: seriesData?.length || 0,
      totalUsers: usersData?.length || 0,
      totalViews:
        (moviesData?.reduce((sum, m) => sum + (m.views || 0), 0) || 0) +
        (seriesData?.reduce((sum, s) => sum + (s.views || 0), 0) || 0),
    })
  }

  // ============ MOVIES ============

  const handleMovieSubmit = async (e) => {
    e.preventDefault()
    try {
      const dataToSave = { ...movieForm, last_refreshed: new Date().toISOString() }
      if (editingMovie) {
        const { error } = await supabase
          .from('movies')
          .update(dataToSave)
          .eq('id', editingMovie)
        if (error) throw error
        toast({ title: 'تم تحديث الفيلم' })
      } else {
        const { error } = await supabase
          .from('movies')
          .insert([dataToSave])
        if (error) throw error
        toast({ title: 'تم إضافة الفيلم' })
      }
      setShowMovieForm(false)
      setEditingMovie(null)
      loadData()
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteMovie = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    const { error } = await supabase.from('movies').delete().eq('id', id)
    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } else {
      toast({ title: 'تم الحذف' })
      loadData()
    }
  }

  const handleToggleMovieActive = async (id, currentStatus) => {
    const { error } = await supabase
      .from('movies')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    if (!error) {
      toast({ title: currentStatus ? 'تم إخفاء الفيلم' : 'تم إظهار الفيلم' })
      loadData()
    }
  }

  // ============ SERIES ============

  const handleSeriesSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSeries) {
        const { error } = await supabase
          .from('series')
          .update(seriesForm)
          .eq('id', editingSeries)
        if (error) throw error
        toast({ title: 'تم تحديث المسلسل' })
      } else {
        const { error } = await supabase
          .from('series')
          .insert([seriesForm])
        if (error) throw error
        toast({ title: 'تم إضافة المسلسل' })
      }
      setShowSeriesForm(false)
      setEditingSeries(null)
      loadData()
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteSeries = async (id) => {
    if (!confirm('سيتم حذف المسلسل وكل مواسمه وحلقاته. هل أنت متأكد؟')) return
    const { error } = await supabase.from('series').delete().eq('id', id)
    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } else {
      toast({ title: 'تم الحذف' })
      if (manageSeries?.id === id) setManageSeries(null)
      loadData()
    }
  }

  const handleToggleSeriesActive = async (id, currentStatus) => {
    const { error } = await supabase
      .from('series')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    if (!error) {
      toast({ title: currentStatus ? 'تم إخفاء المسلسل' : 'تم إظهار المسلسل' })
      loadData()
    }
  }

  const openManageSeries = async (show) => {
    setManageSeries(show)
    setSeasons([])
    setExpandedSeason(null)
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('series_id', show.id)
      .order('season_number', { ascending: true })
    setSeasons(data || [])
  }

  const handleSeasonSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('seasons')
        .insert([{ ...seasonForm, series_id: manageSeries.id }])
      if (error) throw error
      toast({ title: 'تم إضافة الموسم' })
      setShowSeasonForm(false)
      setSeasonForm({ season_number: (seasons.length || 0) + 1, title: '', display_order: 0, is_active: true })
      await openManageSeries(manageSeries)
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteSeason = async (id) => {
    if (!confirm('سيتم حذف الموسم وكل حلقاته. هل أنت متأكد؟')) return
    const { error } = await supabase.from('seasons').delete().eq('id', id)
    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } else {
      toast({ title: 'تم الحذف' })
      await openManageSeries(manageSeries)
    }
  }

  const loadEpisodesForSeason = async (seasonId) => {
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number', { ascending: true })
    return data || []
  }

  const toggleSeason = async (seasonId) => {
    if (expandedSeason?.id === seasonId) {
      setExpandedSeason(null)
      return
    }
    const episodes = await loadEpisodesForSeason(seasonId)
    setExpandedSeason({ id: seasonId, episodes })
  }

  const handleEpisodeSubmit = async (e) => {
    e.preventDefault()
    if (!expandedSeason) return
    try {
      const dataToSave = {
        ...episodeForm,
        title: episodeForm.title || episodeDefaults.title,
        thumbnail: episodeForm.thumbnail || episodeDefaults.thumbnail,
        duration: episodeForm.duration || episodeDefaults.duration,
        last_refreshed: new Date().toISOString(),
      }
      if (editingEpisode) {
        const { error } = await supabase
          .from('episodes')
          .update(dataToSave)
          .eq('id', editingEpisode)
        if (error) throw error
        toast({ title: 'تم تحديث الحلقة' })
        setShowEpisodeForm(false)
        setEditingEpisode(null)
      } else {
        const { error } = await supabase
          .from('episodes')
          .insert([{ ...dataToSave, season_id: expandedSeason.id }])
        if (error) throw error
        toast({ title: 'تم إضافة الحلقة' })
        const nextNum = (episodeForm.episode_number || 0) + 1
        setEpisodeForm({
          episode_number: nextNum,
          title: '',
          embed_url: '',
          thumbnail: '',
          duration: 0,
          display_order: nextNum,
          is_active: true
        })
      }
      await toggleSeason(expandedSeason.id)
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteEpisode = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    const { error } = await supabase.from('episodes').delete().eq('id', id)
    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    } else {
      toast({ title: 'تم الحذف' })
      await toggleSeason(expandedSeason.id)
    }
  }

  // ============ CATEGORIES ============

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(categoryForm)
          .eq('id', editingCategory)
        if (error) throw error
        toast({ title: 'تم تحديث التصنيف' })
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([categoryForm])
        if (error) throw error
        toast({ title: 'تم إضافة التصنيف' })
      }
      setShowCategoryForm(false)
      setEditingCategory(null)
      loadData()
    } catch (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) {
      toast({ title: 'تم الحذف' })
      loadData()
    }
  }

  // ============ USERS ============

  const handleUserRoleChange = async (userId, role) => {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
    if (!error) {
      toast({ title: 'تم تحديث الدور' })
      loadData()
    } else {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    }
  }

  const handleUserBanToggle = async (userRecord) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !userRecord.is_active })
      .eq('id', userRecord.id)
    if (!error) {
      toast({ title: userRecord.is_active ? 'تم حظر المستخدم' : 'تم إلغاء الحظر' })
      loadData()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
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
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
            <span className="text-gray-400">لوحة التحكم</span>
          </div>
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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'إجمالي الأفلام', value: stats.totalMovies, color: 'text-red-600' },
            { label: 'إجمالي المسلسلات', value: stats.totalSeries, color: 'text-blue-600' },
            { label: 'إجمالي المستخدمين', value: stats.totalUsers, color: 'text-green-600' },
            { label: 'إجمالي المشاهدات', value: stats.totalViews, color: 'text-yellow-600' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-900 mb-6 flex-wrap h-auto">
            <TabsTrigger value="movies" className="data-[state=active]:bg-red-600">
              <Film className="w-4 h-4 ml-2" /> الأفلام
            </TabsTrigger>
            <TabsTrigger value="series" className="data-[state=active]:bg-red-600">
              <Tv className="w-4 h-4 ml-2" /> المسلسلات
            </TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-red-600">
              <Tag className="w-4 h-4 ml-2" /> التصنيفات
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-red-600">
              <Users className="w-4 h-4 ml-2" /> المستخدمين
            </TabsTrigger>
            <TabsTrigger value="complaints" className="data-[state=active]:bg-red-600">
              <Ban className="w-4 h-4 ml-2" /> الشكاوى ({complaints.filter(c => !c.is_read).length})
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-red-600">
              <Calendar className="w-4 h-4 ml-2" /> الجدول الزمني
            </TabsTrigger>
          </TabsList>

          {/* ================= MOVIES ================= */}
          <TabsContent value="movies">
            <div className="mb-4">
              <Button
                onClick={() => {
                  setShowMovieForm(true)
                  setEditingMovie(null)
                  setMovieForm(emptyMovieForm())
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 ml-2" /> إضافة فيلم جديد
              </Button>
            </div>

            {showMovieForm && (
              <Card className="bg-gray-900 border-gray-800 mb-6">
                <CardHeader>
                  <CardTitle>{editingMovie ? 'تحرير الفيلم' : 'إضافة فيلم جديد'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMovieSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>عنوان الفيلم</Label>
                        <Input
                          value={movieForm.title}
                          onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                          className="bg-black border-gray-700"
                          required
                        />
                      </div>
                      <div>
                        <Label>رابط الصفحة المصدر</Label>
                        <Input
                          value={movieForm.embed_url}
                          onChange={(e) => setMovieForm({ ...movieForm, embed_url: e.target.value })}
                          className="bg-black border-gray-700"
                          placeholder="https://z.3isk.news/video/..."
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label>الوصف</Label>
                      <Textarea
                        value={movieForm.description}
                        onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                        className="bg-black border-gray-700"
                        rows={3}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>رابط صورة الغلاف</Label>
                        <Input
                          value={movieForm.thumbnail}
                          onChange={(e) => setMovieForm({ ...movieForm, thumbnail: e.target.value })}
                          className="bg-black border-gray-700"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <Label>رابط البانر</Label>
                        <Input
                          value={movieForm.banner}
                          onChange={(e) => setMovieForm({ ...movieForm, banner: e.target.value })}
                          className="bg-black border-gray-700"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <Label>التصنيف</Label>
                        <Input
                          value={movieForm.category}
                          onChange={(e) => setMovieForm({ ...movieForm, category: e.target.value })}
                          className="bg-black border-gray-700"
                          list="movie-categories"
                        />
                        <datalist id="movie-categories">
                          {categories.filter((c) => c.content_type === 'movie').map((c) => (
                            <option key={c.id} value={c.name} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <Label>السنة</Label>
                        <Input
                          type="number"
                          value={movieForm.year}
                          onChange={(e) => setMovieForm({ ...movieForm, year: parseInt(e.target.value) || new Date().getFullYear() })}
                          className="bg-black border-gray-700"
                        />
                      </div>
                      <div>
                        <Label>اللغة</Label>
                        <Input
                          value={movieForm.language}
                          onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
                          className="bg-black border-gray-700"
                        />
                      </div>
                      <div>
                        <Label>الجودة</Label>
                        <Select value={movieForm.quality} onValueChange={(v) => setMovieForm({ ...movieForm, quality: v })}>
                          <SelectTrigger className="bg-black border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SD">SD</SelectItem>
                            <SelectItem value="HD">HD</SelectItem>
                            <SelectItem value="FHD">FHD</SelectItem>
                            <SelectItem value="4K">4K</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={movieForm.is_translated}
                          onChange={(e) => setMovieForm({ ...movieForm, is_translated: e.target.checked })}
                          className="w-4 h-4"
                        />
                        مترجم
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={movieForm.is_dubbed}
                          onChange={(e) => setMovieForm({ ...movieForm, is_dubbed: e.target.checked })}
                          className="w-4 h-4"
                        />
                        مدبلج
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={movieForm.is_active}
                          onChange={(e) => setMovieForm({ ...movieForm, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        مفعل
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="bg-red-600 hover:bg-red-700">
                        {editingMovie ? 'تحديث' : 'إضافة'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowMovieForm(false); setEditingMovie(null); }}>
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {movies.map((movie) => (
                <Card key={movie.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <img
                        src={movie.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100'}
                        alt={movie.title}
                        className="w-16 h-24 object-cover rounded"
                      />
                      <div>
                        <h3 className="font-bold text-lg">{movie.title}</h3>
                        <p className="text-sm text-gray-400">
                          {movie.year} • {movie.category} • {movie.quality}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-500">{movie.views || 0} مشاهدة</p>
                          <ExpiryBadge embedUrl={movie.embed_url} lastRefreshed={movie.last_refreshed} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase.from('movies').update({ last_refreshed: new Date().toISOString() }).eq('id', movie.id)
                          toast({ title: 'تم تحديث وقت الصلاحية' })
                          loadData()
                        }}
                        title="تحديث الصلاحية"
                        className="text-green-500"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleMovieActive(movie.id, movie.is_active)}
                        title={movie.is_active ? 'إخفاء' : 'إظهار'}
                      >
                        {movie.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingMovie(movie.id)
                          setMovieForm({ ...movie })
                          setShowMovieForm(true)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMovie(movie.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {movies.length === 0 && (
                <p className="text-center text-gray-400 py-8">لا توجد أفلام بعد</p>
              )}
            </div>
          </TabsContent>

          {/* ================= SERIES ================= */}
          <TabsContent value="series">
            {manageSeries ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setManageSeries(null)}>
                      العودة
                    </Button>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Tv className="w-5 h-5 text-red-600" />
                      {manageSeries.title}
                    </h2>
                  </div>
                  <Button
                    onClick={() => setShowSeasonForm(!showSeasonForm)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="w-4 h-4 ml-2" /> إضافة موسم
                  </Button>
                </div>

                {showSeasonForm && (
                  <Card className="bg-gray-900 border-gray-800 mb-6">
                    <CardHeader><CardTitle>إضافة موسم جديد</CardTitle></CardHeader>
                    <CardContent>
                      <form onSubmit={handleSeasonSubmit} className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <Label>رقم الموسم</Label>
                            <Input
                              type="number"
                              value={seasonForm.season_number}
                              onChange={(e) => setSeasonForm({ ...seasonForm, season_number: parseInt(e.target.value) || 1 })}
                              className="bg-black border-gray-700"
                              required
                            />
                          </div>
                          <div>
                            <Label>اسم الموسم (اختياري)</Label>
                            <Input
                              value={seasonForm.title}
                              onChange={(e) => setSeasonForm({ ...seasonForm, title: e.target.value })}
                              className="bg-black border-gray-700"
                              placeholder="الموسم الأول"
                            />
                          </div>
                          <div>
                            <Label>ترتيب العرض</Label>
                            <Input
                              type="number"
                              value={seasonForm.display_order}
                              onChange={(e) => setSeasonForm({ ...seasonForm, display_order: parseInt(e.target.value) || 0 })}
                              className="bg-black border-gray-700"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" className="bg-red-600 hover:bg-red-700">إضافة</Button>
                          <Button type="button" variant="outline" onClick={() => setShowSeasonForm(false)}>إلغاء</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {seasons.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">لا توجد مواسم بعد. أضف الموسم الأول.</p>
                ) : (
                  <div className="space-y-2">
                    {seasons.map((season) => {
                      const isOpen = expandedSeason?.id === season.id
                      return (
                        <Card key={season.id} className="bg-gray-900 border-gray-800">
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <button
                                onClick={() => toggleSeason(season.id)}
                                className="flex items-center gap-3 font-bold hover:text-red-500 transition"
                              >
                                <ChevronDown className={`w-5 h-5 transition ${isOpen ? 'rotate-180' : ''}`} />
                                {season.title || `الموسم ${season.season_number}`}
                                <span className="text-sm text-gray-500 font-normal">
                                  ({expandedSeason?.id === season.id ? expandedSeason.episodes.length : '...'} حلقة)
                                </span>
                              </button>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteSeason(season.id)} className="text-red-500">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Episodes */}
                            <div className={`mt-4 space-y-2 ${isOpen ? '' : 'hidden'}`}>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditingEpisode(null)
                                  const nextNum = (expandedSeason?.episodes?.length || 0) + 1
                                  setEpisodeForm({
                                    episode_number: nextNum,
                                    title: '',
                                    embed_url: '',
                                    thumbnail: '',
                                    duration: 0,
                                    display_order: nextNum,
                                    is_active: true
                                  })
                                  setShowEpisodeForm(!showEpisodeForm)
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white mb-2"
                              >
                                <Plus className="w-4 h-4 ml-2" /> إضافة حلقة
                              </Button>

                              {showEpisodeForm && (
                                <Card className="bg-gray-800 border-gray-700 mb-3">
                                  <CardContent className="pt-4">
                                    {/* Defaults Section */}
                                    <div className="bg-gray-900 rounded-lg p-3 mb-4 border border-gray-600">
                                      <p className="text-sm text-gray-400 mb-2 font-bold">القيم الثابتة (تُطبَّق على كل حلقة جديدة)</p>
                                      <div className="grid md:grid-cols-3 gap-3">
                                        <div>
                                          <Label className="text-xs">اسم الحلقات (تلقائي)</Label>
                                          <Input
                                            value={episodeDefaults.title}
                                            onChange={(e) => setEpisodeDefaults({ ...episodeDefaults, title: e.target.value })}
                                            className="bg-black border-gray-700 h-8 text-sm"
                                            placeholder="مثال: اسم المسلسل"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">صورة الحلقات (تلقائية)</Label>
                                          <Input
                                            value={episodeDefaults.thumbnail}
                                            onChange={(e) => setEpisodeDefaults({ ...episodeDefaults, thumbnail: e.target.value })}
                                            className="bg-black border-gray-700 h-8 text-sm"
                                            placeholder="رابط صورة واحدة لكل الحلقات"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">المدة الثابتة</Label>
                                          <Input
                                            type="number"
                                            value={episodeDefaults.duration}
                                            onChange={(e) => setEpisodeDefaults({ ...episodeDefaults, duration: parseInt(e.target.value) || 0 })}
                                            className="bg-black border-gray-700 h-8 text-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <form onSubmit={handleEpisodeSubmit} className="space-y-3">
                                      <div className="grid md:grid-cols-2 gap-3">
                                        <div>
                                          <Label>رقم الحلقة</Label>
                                          <Input
                                            type="number"
                                            value={episodeForm.episode_number}
                                            onChange={(e) => {
                                              const num = parseInt(e.target.value) || 1
                                              setEpisodeForm({ ...episodeForm, episode_number: num, display_order: num })
                                            }}
                                            className="bg-black border-gray-700"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <Label>ترتيب العرض</Label>
                                          <Input
                                            type="number"
                                            value={episodeForm.display_order}
                                            onChange={(e) => setEpisodeForm({ ...episodeForm, display_order: parseInt(e.target.value) || 0 })}
                                            className="bg-black border-gray-700"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <Label>رابط الصفحة المصدر</Label>
                                        <Input
                                          value={episodeForm.embed_url}
                                          onChange={(e) => setEpisodeForm({ ...episodeForm, embed_url: e.target.value })}
                                          className="bg-black border-gray-700"
                                          placeholder="https://z.3isk.news/video/episode-..."
                                          required
                                        />
                                      </div>
                                      {editingEpisode && (
                                        <>
                                          <div>
                                            <Label>اسم الحلقة</Label>
                                            <Input
                                              value={episodeForm.title}
                                              onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })}
                                              className="bg-black border-gray-700"
                                            />
                                          </div>
                                          <div className="grid md:grid-cols-2 gap-3">
                                            <div>
                                              <Label>رابط صورة الحلقة</Label>
                                              <Input
                                                value={episodeForm.thumbnail}
                                                onChange={(e) => setEpisodeForm({ ...episodeForm, thumbnail: e.target.value })}
                                                className="bg-black border-gray-700"
                                              />
                                            </div>
                                            <div>
                                              <Label>المدة (دقيقة)</Label>
                                              <Input
                                                type="number"
                                                value={episodeForm.duration}
                                                onChange={(e) => setEpisodeForm({ ...episodeForm, duration: parseInt(e.target.value) || 0 })}
                                                className="bg-black border-gray-700"
                                              />
                                            </div>
                                          </div>
                                        </>
                                      )}
                                      <div className="flex gap-2">
                                        <Button type="submit" className="bg-red-600 hover:bg-red-700">
                                          {editingEpisode ? 'تحديث' : 'إضافة'}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => { setShowEpisodeForm(false); setEditingEpisode(null); }}>
                                          إلغاء
                                        </Button>
                                      </div>
                                    </form>
                                  </CardContent>
                                </Card>
                              )}

                              {expandedSeason?.episodes?.length === 0 && (
                                <p className="text-sm text-gray-500">لا توجد حلقات في هذا الموسم</p>
                              )}

                              {expandedSeason?.episodes?.map((ep) => (
                                <div key={ep.id} className="flex items-center justify-between gap-3 p-3 bg-gray-950 border border-gray-800 rounded-lg">
                                  <div>
                                    <div className="font-semibold text-sm">
                                      الحلقة {ep.episode_number}: {ep.title || `الحلقة ${ep.episode_number}`}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-gray-500">{ep.views || 0} مشاهدة</span>
                                      <ExpiryBadge embedUrl={ep.embed_url} lastRefreshed={ep.last_refreshed} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        await supabase.from('episodes').update({ last_refreshed: new Date().toISOString() }).eq('id', ep.id)
                                        toast({ title: 'تم تحديث وقت الصلاحية' })
                                        await toggleSeason(expandedSeason.id)
                                      }}
                                      title="تحديث الصلاحية"
                                      className="text-green-500"
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingEpisode(ep.id)
                                        setEpisodeForm({ ...ep })
                                        setShowEpisodeForm(true)
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteEpisode(ep.id)}
                                      className="text-red-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <Button
                    onClick={() => {
                      setShowSeriesForm(true)
                      setEditingSeries(null)
                      setSeriesForm(emptySeriesForm())
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="w-4 h-4 ml-2" /> إضافة مسلسل جديد
                  </Button>
                </div>

                {showSeriesForm && (
                  <Card className="bg-gray-900 border-gray-800 mb-6">
                    <CardHeader>
                      <CardTitle>{editingSeries ? 'تحرير المسلسل' : 'إضافة مسلسل جديد'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSeriesSubmit} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>عنوان المسلسل</Label>
                            <Input
                              value={seriesForm.title}
                              onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value })}
                              className="bg-black border-gray-700"
                              required
                            />
                          </div>
                          <div>
                            <Label>عدد المواسم</Label>
                            <Input
                              type="number"
                              value={seriesForm.total_seasons}
                              onChange={(e) => setSeriesForm({ ...seriesForm, total_seasons: parseInt(e.target.value) || 1 })}
                              className="bg-black border-gray-700"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>الوصف</Label>
                          <Textarea
                            value={seriesForm.description}
                            onChange={(e) => setSeriesForm({ ...seriesForm, description: e.target.value })}
                            className="bg-black border-gray-700"
                            rows={3}
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>التصنيف</Label>
                            <Input
                              value={seriesForm.category}
                              onChange={(e) => setSeriesForm({ ...seriesForm, category: e.target.value })}
                              className="bg-black border-gray-700"
                              list="series-categories"
                            />
                            <datalist id="series-categories">
                              {categories.filter((c) => c.content_type === 'series').map((c) => (
                                <option key={c.id} value={c.name} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <Label>رابط صورة الغلاف</Label>
                            <Input
                              value={seriesForm.thumbnail}
                              onChange={(e) => setSeriesForm({ ...seriesForm, thumbnail: e.target.value })}
                              className="bg-black border-gray-700"
                              placeholder="https://..."
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={seriesForm.is_translated}
                              onChange={(e) => setSeriesForm({ ...seriesForm, is_translated: e.target.checked })}
                              className="w-4 h-4"
                            />
                            مترجم
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={seriesForm.is_dubbed}
                              onChange={(e) => setSeriesForm({ ...seriesForm, is_dubbed: e.target.checked })}
                              className="w-4 h-4"
                            />
                            مدبلج
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={seriesForm.is_active}
                              onChange={(e) => setSeriesForm({ ...seriesForm, is_active: e.target.checked })}
                              className="w-4 h-4"
                            />
                            مفعل
                          </label>
                        </div>

                        <div>
                          <Label>يوم نزول الحلقات</Label>
                          <Select
                            value={seriesForm.release_day || 'none'}
                            onValueChange={(v) => setSeriesForm({ ...seriesForm, release_day: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger className="bg-black border-gray-700">
                              <SelectValue placeholder="اختر يوم النزول" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">بدون تحديد</SelectItem>
                              {DAYS_OF_WEEK.map((day) => (
                                <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" className="bg-red-600 hover:bg-red-700">
                            {editingSeries ? 'تحديث' : 'إضافة'}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => { setShowSeriesForm(false); setEditingSeries(null); }}>
                            إلغاء
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  {series.map((show) => (
                    <Card key={show.id} className="bg-gray-900 border-gray-800">
                      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <img
                            src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=100'}
                            alt={show.title}
                            className="w-16 h-24 object-cover rounded"
                          />
                        <div>
                          <h3 className="font-bold text-lg">{show.title}</h3>
                          <p className="text-sm text-gray-400">
                            {show.category} • {show.total_seasons} مواسم
                            {show.release_day && <span className="mr-2 text-red-400">• {show.release_day}</span>}
                          </p>
                        </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openManageSeries(show)}
                          >
                            <ListVideo className="w-4 h-4 ml-1" /> المواسم والحلقات
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleSeriesActive(show.id, show.is_active)}
                          >
                            {show.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSeries(show.id)
                              setSeriesForm({ ...show })
                              setShowSeriesForm(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSeries(show.id)}
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {series.length === 0 && (
                    <p className="text-center text-gray-400 py-8">لا توجد مسلسلات بعد</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ================= CATEGORIES ================= */}
          <TabsContent value="categories">
            <div className="mb-4">
              <Button
                onClick={() => {
                  setShowCategoryForm(true)
                  setEditingCategory(null)
                  setCategoryForm(emptyCategoryForm())
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 ml-2" /> إضافة تصنيف جديد
              </Button>
            </div>

            {showCategoryForm && (
              <Card className="bg-gray-900 border-gray-800 mb-6">
                <CardHeader>
                  <CardTitle>{editingCategory ? 'تحرير التصنيف' : 'إضافة تصنيف جديد'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>اسم التصنيف</Label>
                        <Input
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                          className="bg-black border-gray-700"
                          required
                        />
                      </div>
                      <div>
                        <Label>نوع المحتوى</Label>
                        <Select value={categoryForm.content_type} onValueChange={(v) => setCategoryForm({ ...categoryForm, content_type: v })}>
                          <SelectTrigger className="bg-black border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="movie">أفلام</SelectItem>
                            <SelectItem value="series">مسلسلات</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="bg-red-600 hover:bg-red-700">
                        {editingCategory ? 'تحديث' : 'إضافة'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}>
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">{cat.name}</h3>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCategory(cat.id)
                            setCategoryForm({ ...cat })
                            setShowCategoryForm(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      {cat.content_type === 'movie' ? 'أفلام' : 'مسلسلات'}{' '}
                      {!cat.is_active && <span className="text-red-500">(مخفي)</span>}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ================= USERS ================= */}
          <TabsContent value="users">
            <div className="space-y-2">
              {users.map((u) => (
                <Card key={u.id} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{u.display_name || u.email}</h3>
                      <p className="text-sm text-gray-400">{u.email}</p>
                      <p className="text-xs text-gray-500">
                        انضم في: {new Date(u.created_at).toLocaleDateString('ar')}
                        {!u.is_active && <span className="text-red-500 mr-2">(محظور)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={u.role} onValueChange={(v) => handleUserRoleChange(u.id, v)}>
                        <SelectTrigger className="w-36 bg-black border-gray-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">مستخدم</SelectItem>
                          <SelectItem value="editor">محرر</SelectItem>
                          <SelectItem value="admin">مدير</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUserBanToggle(u)}
                        title={u.is_active ? 'حظر' : 'إلغاء الحظر'}
                        className={u.is_active ? '' : 'text-green-500'}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {users.length === 0 && (
                <p className="text-center text-gray-400 py-8">لا يوجد مستخدمون بعد</p>
              )}
            </div>
          </TabsContent>

          {/* ================= COMPLAINTS ================= */}
          <TabsContent value="complaints">
            {complaints.length === 0 ? (
              <div className="text-center py-10">
                <Ban className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400">لا توجد شكاوى بعد</h3>
              </div>
            ) : (
              <div className="space-y-2">
                {complaints.map((complaint) => (
                  <Card key={complaint.id} className={`bg-gray-900 border-gray-800 ${!complaint.is_read ? 'border-r-2 border-r-red-600' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{sanitize(complaint.subject)}</h3>
                          <p className="text-sm text-gray-400">{sanitize(complaint.email)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!complaint.is_read && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await supabase.from('complaints').update({ is_read: true }).eq('id', complaint.id)
                                loadData()
                              }}
                            >
                              تحديد كمقروء
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!confirm('هل أنت متأكد من الحذف؟')) return
                              await supabase.from('complaints').delete().eq('id', complaint.id)
                              loadData()
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-gray-300 mb-2">{sanitize(complaint.message)}</p>
                      <p className="text-xs text-gray-500">{new Date(complaint.created_at).toLocaleString('ar')}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ================= SCHEDULE ================= */}
          <TabsContent value="schedule">
            <div className="mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-red-600" />
                جدول نزول الحلقات الأسبوعي
              </h2>
              <p className="text-sm text-gray-400">مسلسلاتك مرتبة حسب يوم نزول الحلقات</p>
            </div>
            {(() => {
              const seriesWithDay = series.filter(s => s.release_day)
              if (seriesWithDay.length === 0) {
                return (
                  <div className="text-center py-10">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl text-gray-400 mb-2">لم تُحدد أيام نزول بعد</h3>
                    <p className="text-sm text-gray-500">أضف "يوم نزول الحلقات" لكل مسلسل من تبويب المسلسلات</p>
                  </div>
                )
              }
              const jsDayToArabic = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
              const todayArabic = jsDayToArabic[new Date().getDay()]
              return (
                <div className="space-y-4">
                  {DAY_ORDER.map((day) => {
                    const daySeries = seriesWithDay.filter(s => s.release_day === day)
                    if (daySeries.length === 0) return null
                    const isToday = day === todayArabic
                    return (
                      <Card key={day} className={`bg-gray-900 border-gray-800 ${isToday ? 'border-2 border-red-600 shadow-lg shadow-red-600/20' : ''}`}>
                        <CardHeader className="pb-3">
                          <CardTitle className={`flex items-center gap-2 ${isToday ? 'text-red-500' : 'text-white'}`}>
                            <Calendar className="w-4 h-4" />
                            {day}
                            {isToday && (
                              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">اليوم</span>
                            )}
                            <span className="text-sm text-gray-400 font-normal mr-auto">{daySeries.length} مسلسلات</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {daySeries.map((show) => (
                              <div key={show.id} className="flex items-center gap-3 p-3 bg-gray-950 border border-gray-800 rounded-lg">
                                <img
                                  src={show.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f00c7b5a3a1b?w=60'}
                                  alt={show.title}
                                  className="w-12 h-16 object-cover rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm truncate">{show.title}</h4>
                                  <p className="text-xs text-gray-400">{show.category}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {show.is_translated && (
                                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">مترجم</span>
                                  )}
                                  {show.is_dubbed && (
                                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">مدبلج</span>
                                  )}
                                  {!show.is_active && (
                                    <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">مخفي</span>
                                  )}
                                  <Link href={`/watch/series/${show.id}`}>
                                    <Button size="sm" variant="ghost" className="h-8">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}