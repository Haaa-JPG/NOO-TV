'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-8 text-red-600">سياسة الخصوصية</h1>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. المعلومات التي نجمعها</h2>
            <p>
              نجمع المعلومات التالية عند التسجيل في الموقع:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>البريد الإلكتروني</li>
              <li>اسم المستخدم</li>
              <li>تفضيلات المشاهدة وسجل المشاهدة</li>
              <li>المحتوى المفضل (قائمة الم watches)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. كيفية استخدام المعلومات</h2>
            <p>
              نستخدم المعلومات المجمعة للأغراض التالية:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>تخصيص تجربة المشاهدة</li>
              <li>تحسين محتوى الموقع</li>
              <li>إرسال إشعارات حول المحتوى الجديد</li>
              <li>الحفاظ على أمان حسابك</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. حماية البيانات</h2>
            <p>
              نتخذ إجراءات أمنية مناسبة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو الاستخدام أو التغيير أو الإفصاح.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. مشاركة البيانات</h2>
            <p>
              لا نبيع أو نتاجر ببياناتك الشخصية مع أطراف ثالثة. قد نشارك معلوماتك فقط في الحالات التالية:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>الامتثال للقانون أو الطلبات القانونية</li>
              <li>حماية حقوقنا أو سلامة مستخدمينا</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. ملفات تعريف الارتباط</h2>
            <p>
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك على الموقع وتسجيل دخولك تلقائياً.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. حقوقك</h2>
            <p>
              لديك الحق في:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>الوصول إلى بياناتك الشخصية</li>
              <li>تعديل أو حذف بياناتك</li>
              <li>إلغاء حسابك في أي وقت</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. التواصل معنا</h2>
            <p>
              لأي استفسارات حول سياسة الخصوصية، يمكنك التواصل من خلال صفحة <Link href="/complaints" className="text-red-500 hover:text-red-400 underline">الشكاوى</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
