'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translations } from './translations'

const LanguageContext = createContext()

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name, value, days = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function getDefaultLanguage() {
  if (typeof window === 'undefined') return 'en'
  try {
    const adminDefault = localStorage.getItem('admin_default_language')
    if (adminDefault && (adminDefault === 'en' || adminDefault === 'ar')) return adminDefault
  } catch {}
  return 'en'
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')
  const [direction, setDirection] = useState('ltr')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const saved = getCookie('noo_language')
    const initial = saved || getDefaultLanguage()
    setLanguage(initial)
    setDirection(initial === 'ar' ? 'rtl' : 'ltr')
    applyDocumentAttributes(initial)
    applyFont(initial)
    setIsLoaded(true)
  }, [])

  const applyDocumentAttributes = useCallback((lang) => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    if (lang === 'ar') {
      document.documentElement.classList.add('rtl')
      document.documentElement.classList.remove('ltr')
    } else {
      document.documentElement.classList.add('ltr')
      document.documentElement.classList.remove('rtl')
    }
  }, [])

  const applyFont = useCallback((lang) => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    if (lang === 'ar') {
      body.style.fontFamily = 'var(--font-tajawal), Tajawal, sans-serif'
    } else {
      body.style.fontFamily = 'var(--font-outfit), Outfit, sans-serif'
    }
  }, [])

  const changeLanguage = useCallback((newLang) => {
    if (newLang !== 'en' && newLang !== 'ar') return
    setLanguage(newLang)
    setDirection(newLang === 'ar' ? 'rtl' : 'ltr')
    setCookie('noo_language', newLang)
    applyDocumentAttributes(newLang)
    applyFont(newLang)
  }, [applyDocumentAttributes, applyFont])

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, direction, changeLanguage, t, isLoaded }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return { language: 'en', direction: 'ltr', changeLanguage: () => {}, t: (k) => k, isLoaded: false }
  }
  return context
}

export function useTranslation() {
  const { language, t } = useLanguage()
  return { t, language }
}
