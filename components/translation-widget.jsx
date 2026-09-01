'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import useTranslator from '@/hooks/use-translator'

const LANGUAGES = [
  { code: 'en', name: 'English', nameAr: 'الإنجليزية' },
  { code: 'ar', name: 'Arabic', nameAr: 'العربية' },
  { code: 'fr', name: 'French', nameAr: 'الفرنسية' },
  { code: 'es', name: 'Spanish', nameAr: 'الإسبانية' },
  { code: 'de', name: 'German', nameAr: 'الألمانية' },
  { code: 'it', name: 'Italian', nameAr: 'الإيطالية' },
  { code: 'pt', name: 'Portuguese', nameAr: 'البرتغالية' },
  { code: 'ru', name: 'Russian', nameAr: 'الروسية' },
  { code: 'ja', name: 'Japanese', nameAr: 'اليابانية' },
  { code: 'ko', name: 'Korean', nameAr: 'الكورية' },
  { code: 'zh', name: 'Chinese', nameAr: 'الصينية' },
]

/**
 * Translation Component
 * 
 * Interactive translation widget for admin panel
 * 
 * Usage:
 * <TranslationWidget onTranslate={(translated) => setFormData({...formData, description: translated})} />
 */
export function TranslationWidget({ initialText = '', onTranslate = null, targetField = null }) {
  const [sourceText, setSourceText] = useState(initialText)
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('ar')
  const { translate, loading, error } = useTranslator()
  const { toast } = useToast()

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast({
        title: 'خطأ',
        description: 'الرجاء إدخال نص للترجمة',
        variant: 'destructive',
      })
      return
    }

    const result = await translate(sourceText, targetLang, sourceLang)
    setTranslatedText(result)

    if (onTranslate) {
      onTranslate(result)
    }

    toast({
      title: 'تمت الترجمة',
      description: 'تم ترجمة النص بنجاح',
    })
  }

  const handleSwapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText)
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ النص المترجم',
    })
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          الترجمة
        </CardTitle>
        <CardDescription className="text-gray-400">
          ترجمة النص بين اللغات المختلفة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="flex items-center gap-2">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-[150px] bg-black border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code} className="text-white">
                  {lang.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwapLanguages}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </Button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-[150px] bg-black border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code} className="text-white">
                  {lang.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source Text */}
        <div>
          <Label className="text-white">النص الأصلي</Label>
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="أدخل النص للترجمة..."
            className="bg-black border-gray-700 text-white min-h-[100px] mt-2"
          />
        </div>

        {/* Translate Button */}
        <Button
          onClick={handleTranslate}
          disabled={loading || !sourceText.trim()}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              جاري الترجمة...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              ترجمة
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Translated Text */}
        {translatedText && (
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-white">الترجمة</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                نسخ
              </Button>
            </div>
            <Textarea
              value={translatedText}
              readOnly
              className="bg-black border-gray-700 text-white min-h-[100px] mt-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TranslationWidget
