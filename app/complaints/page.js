'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Send, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export default function ComplaintsPage() {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !subject || !message) {
      toast({ title: 'يرجى ملء جميع الحقول', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('complaints').insert({ email, subject, message })
    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' })
    } else {
      setSent(true)
      toast({ title: 'تم إرسال شكواك بنجاح' })
    }
    setLoading(false)
  }

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

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-red-600">الشكاوى والتواصل</h1>

        {sent ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">تم إرسال شكواك بنجاح</h2>
              <p className="text-gray-400 mb-6">سنتواصل معك عبر البريد الإلكتروني في أقرب وقت ممكن.</p>
              <Button onClick={() => { setSent(false); setEmail(''); setSubject(''); setMessage('') }} variant="outline">
                إرسال شكوى جديدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>أرسل شكواك أو استفسارك</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>البريد الإلكتروني *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black border-gray-700"
                    placeholder="example@email.com"
                    required
                  />
                </div>
                <div>
                  <Label>موضوع الشكوى *</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="bg-black border-gray-700"
                    placeholder="مثال: طلب حذف محتوى، شكوى في محتوى، استفسار..."
                    required
                  />
                </div>
                <div>
                  <Label>تفاصيل الشكوى *</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-black border-gray-700 min-h-[150px]"
                    placeholder="اكتب تفاصيل شكواك هنا..."
                    required
                  />
                </div>
                <Button type="submit" className="bg-red-600 hover:bg-red-700 w-full" disabled={loading}>
                  <Send className="w-4 h-4 ml-2" />
                  {loading ? 'جاري الإرسال...' : 'إرسال الشكوى'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
