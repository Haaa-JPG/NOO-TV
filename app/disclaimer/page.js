'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PageEditor from '@/components/page-editor'

export default function DisclaimerPage() {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/legal?slug=disclaimer')
      .then(r => r.json())
      .then(data => {
        setPage(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowRight className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {loading ? (
          <div className="text-center text-gray-500 py-20">جاري التحميل...</div>
        ) : page ? (
          <PageEditor slug="disclaimer" initialTitle={page.title} initialContent={page.content} />
        ) : (
          <div className="text-center text-gray-500 py-20">الصفحة غير موجودة</div>
        )}
      </div>
    </div>
  )
}
