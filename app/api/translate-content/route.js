import { NextResponse } from 'next/server'
import { translateText, translateBatch } from '@/lib/translator'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'

/**
 * POST /api/translate-content
 * 
 * Auto-translate content fields for movies/series
 * Used during form submission to fill missing language fields
 * 
 * Request body:
 * - title: string (original title)
 * - title_ar: string (Arabic title, if available)
 * - description: string (original description)
 * - description_ar: string (Arabic description, if available)
 * - sourceLang: string (source language, default: 'en')
 * - targetLang: string (target language, default: 'ar')
 * 
 * Response:
 * - title: string (translated title if was empty)
 * - title_ar: string (Arabic title)
 * - description: string (translated description if was empty)
 * - description_ar: string (Arabic description)
 * - translated: boolean (whether any translation was performed)
 */
export async function POST(request) {
  try {
    maybeCleanup()
    
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`translate-content:${ip}`, 20, 60000)) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      title = '',
      title_ar = '',
      description = '',
      description_ar = '',
      sourceLang = 'en',
      targetLang = 'ar',
    } = body

    let translated = false
    let result = {
      title,
      title_ar,
      description,
      description_ar,
    }

    // Build translation tasks
    const tasks = []

    // Title translation: if Arabic is empty but English exists
    if (!title_ar && title) {
      tasks.push({
        type: 'title',
        text: title,
        sourceLang,
        targetLang,
      })
    }

    // Description translation: if Arabic is empty but English exists
    if (!description_ar && description) {
      tasks.push({
        type: 'description',
        text: description,
        sourceLang,
        targetLang,
      })
    }

    // Execute translations
    if (tasks.length > 0) {
      try {
        const textsToTranslate = tasks.map(t => ({ text: t.text, id: t.type }))
        const results = await translateBatch(textsToTranslate, targetLang, sourceLang)

        for (const taskResult of results) {
          if (taskResult.success && taskResult.id) {
            const task = tasks.find(t => t.type === taskResult.id)
            if (task) {
              if (task.type === 'title') {
                result.title_ar = taskResult.translated
              } else if (task.type === 'description') {
                result.description_ar = taskResult.translated
              }
              translated = true
            }
          }
        }
      } catch (err) {
        console.error('[Translate Content] Translation error:', err.message)
        // Graceful fallback: keep original values
      }
    }

    return NextResponse.json({
      ...result,
      translated,
    })

  } catch (err) {
    console.error('[Translate Content API] Error:', err)
    // Return original values on error (graceful fallback)
    const body = await request.json().catch(() => ({}))
    return NextResponse.json({
      title: body.title || '',
      title_ar: body.title_ar || '',
      description: body.description || '',
      description_ar: body.description_ar || '',
      translated: false,
    })
  }
}
