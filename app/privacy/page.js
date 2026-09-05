import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getDbClient } from '@/lib/db'
import PageEditor from '@/components/page-editor'

async function getPage(slug) {
  try {
    const client = getDbClient()
    await client.connect()
    const result = await client.query(
      'SELECT slug, title, content FROM pages WHERE slug = $1',
      [slug]
    )
    await client.end()
    return result.rows[0] || null
  } catch (err) {
    console.error('Failed to load page:', err)
    return null
  }
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'سياسة الخصوصية - NOO TV' }

export default async function PrivacyPage() {
  const page = await getPage('privacy')

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
        {page ? (
          <PageEditor slug="privacy" initialTitle={page.title} initialContent={page.content} />
        ) : (
          <div className="text-center text-gray-500 py-20">الصفحة غير موجودة</div>
        )}
      </div>
    </div>
  )
}
