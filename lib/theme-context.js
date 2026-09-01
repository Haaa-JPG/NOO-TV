'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext()

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

function getDefaultTheme() {
  if (typeof window === 'undefined') return 'dark'
  try {
    const adminDefault = localStorage.getItem('admin_default_theme')
    if (adminDefault && (adminDefault === 'dark' || adminDefault === 'light')) return adminDefault
  } catch {}
  return 'dark'
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [resolvedTheme, setResolvedTheme] = useState('dark')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const saved = getCookie('noo_theme')
    const initial = saved || getDefaultTheme()
    setTheme(initial)
    applyTheme(initial)
    setIsLoaded(true)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const applyTheme = useCallback((t) => {
    if (typeof document === 'undefined') return
    const resolved = t === 'system' ? getSystemTheme() : t
    setResolvedTheme(resolved)
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const changeTheme = useCallback((newTheme) => {
    if (!['dark', 'light', 'system'].includes(newTheme)) return
    setTheme(newTheme)
    setCookie('noo_theme', newTheme)
    applyTheme(newTheme)
  }, [applyTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, changeTheme, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return { theme: 'dark', resolvedTheme: 'dark', changeTheme: () => {}, isLoaded: false }
  }
  return context
}
