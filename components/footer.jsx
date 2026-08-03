'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-red-600 mb-4">NOO TV</h3>
            <p className="text-gray-400 text-sm">منصة مشاهدة أفلام ومسلسلات مجاناً بجودة عالية</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">روابط سريعة</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/movies" className="text-gray-400 hover:text-white transition">الأفلام</Link></li>
              <li><Link href="/series" className="text-gray-400 hover:text-white transition">المسلسلات</Link></li>
              <li><Link href="/categories" className="text-gray-400 hover:text-white transition">التصنيفات</Link></li>
              <li><Link href="/search" className="text-gray-400 hover:text-white transition">البحث</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">قانوني</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/disclaimer" className="text-gray-400 hover:text-white transition">إخلاء المسؤولية</Link></li>
              <li><Link href="/privacy" className="text-gray-400 hover:text-white transition">سياسة الخصوصية</Link></li>
              <li><Link href="/complaints" className="text-gray-400 hover:text-white transition">الشكاوى والتواصل</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} NOO TV. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  )
}
