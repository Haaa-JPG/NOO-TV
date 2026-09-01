'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-red-600 mb-4">NOO TV</h3>
            <p className="text-gray-400 text-sm">{t('welcomeDesc')}</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">{t('categories')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/movies" className="text-gray-400 hover:text-white transition">{t('movies')}</Link></li>
              <li><Link href="/series" className="text-gray-400 hover:text-white transition">{t('series')}</Link></li>
              <li><Link href="/categories" className="text-gray-400 hover:text-white transition">{t('categories')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">{t('settings')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/complaints" className="text-gray-400 hover:text-white transition">{t('adminPanel')}</Link></li>
              <li><Link href="/privacy" className="text-gray-400 hover:text-white transition">{t('settings')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} NOO TV. {t('allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  )
}
