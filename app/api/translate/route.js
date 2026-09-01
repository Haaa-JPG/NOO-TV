import { NextResponse } from 'next/server'
import { translateText, translateBatch, autoTranslate, getTranslationStats, SUPPORTED_LANGS } from '@/lib/translator'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'
import { isValidHttpUrl } from '@/lib/security'

/**
 * POST /api/translate
 * 
 * Translate text or batch of texts between languages
 * 
 * Request body:
 * - text: string (single text to translate)
 * - texts: Array<{text: string, id?: string}> (batch translation)
 * - targetLang: string (target language code, default: 'ar')
 * - sourceLang: string (source language code, default: 'en')
 * - autoDetect: boolean (auto-detect source language)
 * 
 * Response:
 * - For single text: { translated: string, cached: boolean }
 * - For batch: { results: Array<{id?, original, translated, success}> }
 */
export async function POST(request) {
  try {
    maybeCleanup()
    
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`translate:${ip}`, 30, 60000)) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { text, texts, targetLang = 'ar', sourceLang = 'en', autoDetect = false } = body

    // Validate languages
    if (!SUPPORTED_LANGS.includes(targetLang)) {
      return NextResponse.json(
        { error: `Language not supported: ${targetLang}` },
        { status: 400 }
      )
    }

    // Single text translation
    if (text && typeof text === 'string') {
      if (text.trim().length === 0) {
        return NextResponse.json({ translated: '', cached: false })
      }

      if (text.length > 5000) {
        return NextResponse.json(
          { error: 'النص طويل جداً. الحد الأقصى 5000 حرف' },
          { status: 400 }
        )
      }

      const translated = autoDetect
        ? await autoTranslate(text, targetLang)
        : await translateText(text, targetLang, sourceLang)

      return NextResponse.json({
        translated,
        cached: false, // Could check cache here if needed
        sourceLang: autoDetect ? 'auto' : sourceLang,
        targetLang,
      })
    }

    // Batch translation
    if (Array.isArray(texts)) {
      if (texts.length > 50) {
        return NextResponse.json(
          { error: 'الحد الأقصى 50 نص في الدفعة الواحدة' },
          { status: 400 }
        )
      }

      const results = await translateBatch(
        texts.map(t => typeof t === 'string' ? { text: t } : t),
        targetLang,
        sourceLang
      )

      return NextResponse.json({
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
      })
    }

    return NextResponse.json(
      { error: 'Invalid request: provide "text" or "texts"' },
      { status: 400 }
    )

  } catch (err) {
    console.error('[Translate API] Error:', err)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/translate
 * 
 * Get translation statistics and supported languages
 */
export async function GET() {
  try {
    const stats = await getTranslationStats()
    
    return NextResponse.json({
      supportedLanguages: SUPPORTED_LANGS,
      stats: stats || {
        total_translations: 0,
        language_pairs: 0,
      },
      endpoints: {
        translate: 'POST /api/translate',
        body: {
          text: 'string (single text)',
          texts: 'Array<{text, id?}> (batch)',
          targetLang: 'string (default: ar)',
          sourceLang: 'string (default: en)',
          autoDetect: 'boolean (default: false)',
        },
      },
    })
  } catch (err) {
    console.error('[Translate API] Stats error:', err)
    return NextResponse.json(
      { supportedLanguages: SUPPORTED_LANGS },
      { status: 200 }
    )
  }
}
