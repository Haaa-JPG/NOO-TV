'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Film, Tv, Tag } from 'lucide-react'
import Link from 'next/link'

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true)
  const [movieCategories, setMovieCategories] = useState([])
  const [seriesCategories, setSeriesCategories] = useState([])

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (data) {
      setMovieCategories(data.filter((c) => c.content_type === 'movie'))
      setSeriesCategories(data.filter((c) => c.content_type === 'series'))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <Link href="/" className="text-gray-400 hover:text-white transition">العودة للرئيسية</Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Tag className="w-6 h-6 text-red-600" />
          <h1 className="text-3xl font-bold">التصنيفات</h1>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">جاري التحميل...</div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-red-600" /> تصنيفات الأفلام
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {movieCategories.map((cat) => (
                  <Link key={cat.id} href={`/movies?category=${encodeURIComponent(cat.name)}`}>
                    <Card className="bg-gray-900 border-gray-800 hover:border-red-600 hover:bg-red-600/10 transition group cursor-pointer">
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Film className="w-6 h-6 text-gray-400 group-hover:text-red-600 transition" />
                          <h3 className="text-lg font-bold">{cat.name}</h3>
                        </div>
                        <Badge variant="outline" className="group-hover:bg-red-600 transition">أفلام</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {movieCategories.length === 0 && (
                  <p className="text-gray-500">لا توجد تصنيفات أفلام بعد</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-600" /> تصنيفات المسلسلات
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {seriesCategories.map((cat) => (
                  <Link key={cat.id} href={`/series?category=${encodeURIComponent(cat.name)}`}>
                    <Card className="bg-gray-900 border-gray-800 hover:border-red-600 hover:bg-red-600/10 transition group cursor-pointer">
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Tv className="w-6 h-6 text-gray-400 group-hover:text-red-600 transition" />
                          <h3 className="text-lg font-bold">{cat.name}</h3>
                        </div>
                        <Badge variant="outline" className="group-hover:bg-red-600 transition">مسلسلات</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {seriesCategories.length === 0 && (
                  <p className="text-gray-500">لا توجد تصنيفات مسلسلات بعد</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}