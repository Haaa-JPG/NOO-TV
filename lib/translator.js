/**
 * Translation Service - Free Machine Translation Engine
 * 
 * Features:
 * - Free Google Translate RPC endpoint (no API key required)
 * - Supabase caching layer for repeated translations
 * - Batch processing with concurrency control
 * - Automatic fallback to original text on failure
 * - Rate limit handling with exponential backoff
 */

import { getDbClient } from './db'

// Supported language pairs
const SUPPORTED_LANGS = ['en', 'ar', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']

// Default language pair
const DEFAULT_SOURCE = 'en'
const DEFAULT_TARGET = 'ar'

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxConcurrent: 2,
  minDelayMs: 300,
  maxDelayMs: 5000,
  maxRetries: 3,
}

// In-memory cache for hot translations (L1 cache)
const memoryCache = new Map()
const MEMORY_CACHE_MAX = 1000
const MEMORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Generate a cache key for a translation
 */
function getCacheKey(text, sourceLang, targetLang) {
  return `${sourceLang}:${targetLang}:${text.substring(0, 200)}`
}

/**
 * L1 Memory Cache - Fastest layer
 */
function getMemoryCache(key) {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > MEMORY_CACHE_TTL) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

function setMemoryCache(key, value) {
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    // Delete oldest entry
    const firstKey = memoryCache.keys().next().value
    memoryCache.delete(firstKey)
  }
  memoryCache.set(key, { value, timestamp: Date.now() })
}

/**
 * L2 Database Cache - Persistent layer
 */
async function getDbCache(text, sourceLang, targetLang) {
  let client
  try {
    client = getDbClient()
    await client.connect()
    
    const result = await client.query(
      `SELECT translated_text FROM translation_cache 
       WHERE source_text = $1 AND source_lang = $2 AND target_lang = $3 
       LIMIT 1`,
      [text, sourceLang, targetLang]
    )
    
    return result.rows[0]?.translated_text || null
  } catch (err) {
    console.warn('[Translator] DB cache read error:', err.message)
    return null
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

async function setDbCache(text, translatedText, sourceLang, targetLang) {
  let client
  try {
    client = getDbClient()
    await client.connect()
    
    await client.query(
      `INSERT INTO translation_cache (source_text, translated_text, source_lang, target_lang)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_text, source_lang, target_lang) 
       DO UPDATE SET translated_text = EXCLUDED.translated_text, updated_at = NOW()`,
      [text, translatedText, sourceLang, targetLang]
    )
  } catch (err) {
    console.warn('[Translator] DB cache write error:', err.message)
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

/**
 * Google Translate free RPC endpoint
 * Uses the same endpoint as the web interface
 */
async function googleTranslateRPC(text, sourceLang, targetLang) {
  const url = 'https://translate.googleapis.com/translate_a/single'
  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
    dt: 't',
    q: text,
  })

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Google Translate HTTP ${response.status}`)
  }

  const data = await response.json()
  
  // Parse the response format: [[["translated","original",null,null,10]],null,"en"]
  if (!data || !data[0] || !Array.isArray(data[0])) {
    throw new Error('Invalid translation response format')
  }

  // Concatenate all translated segments
  const translated = data[0]
    .filter(segment => segment && segment[0])
    .map(segment => segment[0])
    .join('')

  if (!translated) {
    throw new Error('Empty translation result')
  }

  return translated
}

/**
 * Alternative translation source: MyMemory (free, no key required)
 */
async function myMemoryTranslate(text, sourceLang, targetLang) {
  const url = 'https://api.mymemory.translated.net/get'
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  })

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`)
  }

  const data = await response.json()
  
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || 'Translation failed')
  }

  const translated = data.responseData.translatedText
  
  // MyMemory returns uppercase marker for unchanged text
  if (translated === text.toUpperCase() && text !== text.toUpperCase()) {
    throw new Error('Translation unchanged')
  }

  return translated
}

/**
 * Translate with retry and exponential backoff
 */
async function translateWithRetry(text, sourceLang, targetLang, retries = RATE_LIMIT_CONFIG.maxRetries) {
  let lastError
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Try primary source first
      return await googleTranslateRPC(text, sourceLang, targetLang)
    } catch (err) {
      lastError = err
      console.warn(`[Translator] Attempt ${attempt + 1} failed:`, err.message)
      
      // If primary fails, try backup source on last attempt
      if (attempt === retries - 1) {
        try {
          return await myMemoryTranslate(text, sourceLang, targetLang)
        } catch (backupErr) {
          console.warn('[Translator] Backup source also failed:', backupErr.message)
        }
      }
      
      // Exponential backoff
      if (attempt < retries) {
        const delay = Math.min(
          RATE_LIMIT_CONFIG.minDelayMs * Math.pow(2, attempt),
          RATE_LIMIT_CONFIG.maxDelayMs
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Main translation function with multi-layer caching
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (default: 'ar')
 * @param {string} sourceLang - Source language code (default: 'en')
 * @returns {Promise<string>} Translated text or original text on failure
 */
export async function translateText(text, targetLang = DEFAULT_TARGET, sourceLang = DEFAULT_SOURCE) {
  // Handle edge cases
  if (!text || typeof text !== 'string') return text || ''
  if (text.trim().length === 0) return text
  if (sourceLang === targetLang) return text
  if (!SUPPORTED_LANGS.includes(sourceLang) || !SUPPORTED_LANGS.includes(targetLang)) {
    console.warn(`[Translator] Unsupported language pair: ${sourceLang} -> ${targetLang}`)
    return text
  }

  const cacheKey = getCacheKey(text, sourceLang, targetLang)

  // L1: Check memory cache
  const memoryCached = getMemoryCache(cacheKey)
  if (memoryCached) {
    return memoryCached
  }

  // L2: Check database cache
  const dbCached = await getDbCache(text, sourceLang, targetLang)
  if (dbCached) {
    setMemoryCache(cacheKey, dbCached)
    return dbCached
  }

  // L3: Call translation API
  try {
    const translated = await translateWithRetry(text, sourceLang, targetLang)
    
    // Store in both cache layers
    setMemoryCache(cacheKey, translated)
    setDbCache(text, translated, sourceLang, targetLang)
    
    return translated
  } catch (err) {
    console.error('[Translator] All translation sources failed:', err.message)
    // Graceful fallback: return original text
    return text
  }
}

/**
 * Translate multiple texts in batch with concurrency control
 * 
 * @param {Array<{text: string, id?: string}>} items - Items to translate
 * @param {string} targetLang - Target language
 * @param {string} sourceLang - Source language
 * @param {function} onProgress - Progress callback (optional)
 * @returns {Promise<Array<{id?: string, original: string, translated: string}>>}
 */
export async function translateBatch(items, targetLang = DEFAULT_TARGET, sourceLang = DEFAULT_SOURCE, onProgress = null) {
  if (!Array.isArray(items) || items.length === 0) return []

  const results = []
  const batchSize = 5
  const delayBetweenBatches = 500

  // Process in batches to avoid rate limiting
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const text = typeof item === 'string' ? item : item.text
        const id = typeof item === 'string' ? null : item.id
        
        const translated = await translateText(text, targetLang, sourceLang)
        
        return {
          id,
          original: text,
          translated,
          success: true,
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          id: null,
          original: '',
          translated: '',
          success: false,
          error: result.reason?.message,
        })
      }
    }

    // Progress callback
    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length)
    }

    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }

  return results
}

/**
 * Translate an object's text fields
 * Useful for translating movie/series metadata
 * 
 * @param {Object} obj - Object with text fields
 * @param {Array<string>} fields - Field names to translate
 * @param {string} targetLang - Target language
 * @param {string} sourceLang - Source language
 * @returns {Promise<Object>} Object with translated fields
 */
export async function translateObject(obj, fields, targetLang = DEFAULT_TARGET, sourceLang = DEFAULT_SOURCE) {
  if (!obj || typeof obj !== 'object') return obj

  const translatedObj = { ...obj }
  
  const translations = await translateBatch(
    fields
      .filter(field => obj[field] && typeof obj[field] === 'string')
      .map(field => ({ text: obj[field], id: field })),
    targetLang,
    sourceLang
  )

  for (const result of translations) {
    if (result.success && result.id) {
      translatedObj[result.id] = result.translated
    }
  }

  return translatedObj
}

/**
 * Auto-detect language and translate to target
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language
 * @returns {Promise<string>} Translated text
 */
export async function autoTranslate(text, targetLang = DEFAULT_TARGET) {
  if (!text || typeof text !== 'string') return text || ''
  
  // Simple language detection based on character ranges
  const arabicRegex = /[\u0600-\u06FF]/
  const latinRegex = /[a-zA-Z]/
  
  const hasArabic = arabicRegex.test(text)
  const hasLatin = latinRegex.test(text)
  
  // Determine source language
  let sourceLang
  if (hasArabic && !hasLatin) {
    sourceLang = 'ar'
  } else if (hasLatin && !hasArabic) {
    sourceLang = 'en'
  } else {
    // Mixed or unknown, default to English
    sourceLang = 'en'
  }
  
  // Don't translate if already in target language
  if (sourceLang === targetLang) return text
  
  return translateText(text, targetLang, sourceLang)
}

/**
 * Get translation statistics
 */
export async function getTranslationStats() {
  let client
  try {
    client = getDbClient()
    await client.connect()
    
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_translations,
        COUNT(DISTINCT source_lang || '->' || target_lang) as language_pairs,
        MIN(created_at) as oldest_translation,
        MAX(created_at) as newest_translation
      FROM translation_cache
    `)
    
    return result.rows[0] || {
      total_translations: 0,
      language_pairs: 0,
      oldest_translation: null,
      newest_translation: null,
    }
  } catch (err) {
    console.error('[Translator] Stats query error:', err.message)
    return null
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

/**
 * Clear old translations from cache
 * @param {number} daysOld - Remove translations older than this many days
 */
export async function clearOldTranslations(daysOld = 90) {
  let client
  try {
    client = getDbClient()
    await client.connect()
    
    const result = await client.query(
      `DELETE FROM translation_cache WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
    )
    
    return result.rowCount || 0
  } catch (err) {
    console.error('[Translator] Cleanup error:', err.message)
    return 0
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

// Export language utilities
export { SUPPORTED_LANGS, DEFAULT_SOURCE, DEFAULT_TARGET }
