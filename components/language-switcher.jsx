'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { Globe, Check } from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
]

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{current.native}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 backdrop-blur-xl">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code)
                setOpen(false)
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                language === lang.code
                  ? 'bg-red-600/20 text-red-400'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{lang.native}</span>
              {language === lang.code && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
