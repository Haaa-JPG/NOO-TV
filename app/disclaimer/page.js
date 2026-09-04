'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'

const DEFAULT_DISCLAIMER = `<section>
<h2>1. محتوى الموقع</h2>
<p>
يوفر موقع NOO TV روابط بث مباشر لمحتوى من مصادر مختلفة على الإنترنت. نحن لا نستضيف أي محتوى على خوادمنا، وإنما نوفر روابط للبث من مواقع أخرى مثل YouTube وDailymotion ومصادر أخرى.
</p>
</section>

<section>
<h2>2. حقوق النشر</h2>
<p>
جميع الحقوق محفوظة لأصحابها الأصليين. إذا كنت تعتقد أن أي محتوى ينتهك حقوق النشر الخاصة بك، يُرجى التواصل معنا فوراً وسنقوم بإزالة الروابط المخالفة في أقرب وقت ممكن.
</p>
</section>

<section>
<h2>3. إزالة المحتوى</h2>
<p>
إذا كنت صاحب حقنشر وترى أن محتوى ما ينتهك حقوقك، يمكنك إرسال شكوى من خلال صفحة الشكاوى وسنقوم بالتعامل معها في أسرع وقت.
</p>
</section>

<section>
<h2>4. مسؤولية المستخدم</h2>
<p>
استخدامك للموقع يشكل موافقتك على هذه الشروط. أنت مسؤول عن استخدامك للمحتوى المتاح على الموقع.
</p>
</section>

<section>
<h2>5. تغييرات على إخلاء المسؤولية</h2>
<p>
نحتفظ بالحق في تعديل إخلاء المسؤولية في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة.
</p>
</section>`

function renderSections(html) {
  if (!html) return null
  const sections = html.split(/<\/section>/i).filter(Boolean)
  return sections.map((section, i) => {
    const match = section.match(/<h2[^>]*>(.*?)<\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
    if (!match) {
      const h2Match = section.match(/<h2[^>]*>(.*?)<\/h2>/i)
      const pMatch = section.match(/<p[^>]*>([\s\S]*)/i)
      if (h2Match && pMatch) {
        return (
          <section key={i}>
            <h2 className="text-xl font-bold text-white mb-3">{h2Match[1]}</h2>
            <p dangerouslySetInnerHTML={{ __html: pMatch[1] }} />
          </section>
        )
      }
      return null
    }
    return (
      <section key={i}>
        <h2 className="text-xl font-bold text-white mb-3">{match[1]}</h2>
        <p dangerouslySetInnerHTML={{ __html: match[2] }} />
      </section>
    )
  })
}

export default function DisclaimerPage() {
  const [content, setContent] = useState('')

  useEffect(() => {
    fetch('/api/legal')
      .then(r => r.json())
      .then(data => {
        if (data.disclaimer) setContent(data.disclaimer)
        else setContent(DEFAULT_DISCLAIMER)
      })
      .catch(() => setContent(DEFAULT_DISCLAIMER))
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-red-600">NOO TV</Link>
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowRight className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8 text-red-600">إخلاء المسؤولية</h1>
        <div className="space-y-6 text-gray-300 leading-relaxed">
          {renderSections(content)}
        </div>
      </div>
    </div>
  )
}
