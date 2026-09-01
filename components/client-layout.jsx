'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'
import { useTheme } from '@/lib/theme-context'

export default function ClientLayout({ children }) {
  const { language, direction, isLoaded: langLoaded } = useLanguage()
  const { resolvedTheme, isLoaded: themeLoaded } = useTheme()

  useEffect(() => {
    if (!langLoaded) return
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [language, direction, langLoaded])

  useEffect(() => {
    if (!themeLoaded) return
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [resolvedTheme, themeLoaded])

  return <>{children}</>
}
