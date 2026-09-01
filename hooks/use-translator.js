'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * React Hook for Translation
 * 
 * Provides translation functionality with loading states and error handling
 * 
 * Usage:
 * const { translate, translateBatch, loading, error } = useTranslator()
 * 
 * const translated = await translate('Hello World', 'ar')
 */

export function useTranslator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  /**
   * Translate a single text
   */
  const translate = useCallback(async (text, targetLang = 'ar', sourceLang = 'en') => {
    if (!text || typeof text !== 'string') {
      return text || ''
    }

    setLoading(true)
    setError(null)

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLang,
          sourceLang,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Translation failed')
      }

      const data = await response.json()
      return data.translated
    } catch (err) {
      if (err.name === 'AbortError') {
        return text // Return original on abort
      }
      setError(err.message)
      console.error('[useTranslator] Error:', err)
      return text // Graceful fallback
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Translate multiple texts in batch
   */
  const translateBatch = useCallback(async (texts, targetLang = 'ar', sourceLang = 'en') => {
    if (!Array.isArray(texts) || texts.length === 0) {
      return []
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: texts.map(t => typeof t === 'string' ? { text: t } : t),
          targetLang,
          sourceLang,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Batch translation failed')
      }

      const data = await response.json()
      return data.results
    } catch (err) {
      setError(err.message)
      console.error('[useTranslator] Batch error:', err)
      // Return original texts on failure
      return texts.map(t => ({
        original: typeof t === 'string' ? t : t.text,
        translated: typeof t === 'string' ? t : t.text,
        success: false,
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Auto-detect language and translate
   */
  const autoTranslate = useCallback(async (text, targetLang = 'ar') => {
    if (!text || typeof text !== 'string') {
      return text || ''
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLang,
          autoDetect: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Auto translation failed')
      }

      const data = await response.json()
      return data.translated
    } catch (err) {
      setError(err.message)
      console.error('[useTranslator] Auto error:', err)
      return text
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    translate,
    translateBatch,
    autoTranslate,
    loading,
    error,
  }
}

export default useTranslator
