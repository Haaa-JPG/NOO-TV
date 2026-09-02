'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('ar')
  const [direction, setDirection] = useState('rtl')

  useEffect(() => {
    // Load language from localStorage
    const savedLang = localStorage.getItem('language') || 'ar'
    setLanguage(savedLang)
    setDirection(savedLang === 'ar' ? 'rtl' : 'ltr')
    
    // Update HTML attributes
    document.documentElement.lang = savedLang
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'
  }, [])

  const changeLanguage = (newLang) => {
    setLanguage(newLang)
    setDirection(newLang === 'ar' ? 'rtl' : 'ltr')
    localStorage.setItem('language', newLang)
    
    // Update HTML attributes
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
    
    // Reload page to apply changes
    window.location.reload()
  }

  return (
    <LanguageContext.Provider value={{ language, direction, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

export function useTranslation() {
  const { language } = useLanguage()
  
  const t = (key) => {
    const translations = require('./translations').translations
    return translations[language]?.[key] || translations['ar'][key] || key
  }
  
  return { t, language }
}
