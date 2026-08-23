'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp, signInWithGoogle, ensureUserProfile, supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = (() => {
    const r = searchParams.get('redirect') || searchParams.get('next') || '/'
    if (!r.startsWith('/') || r.startsWith('//')) return '/'
    return r
  })()
  const { toast } = useToast()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
if (isLogin) {
          const { data, error } = await signIn(formData.email, formData.password)
          if (error) {
            if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
              throw new Error('يجب تأكيد البريد الإلكتروني أولاً. تحقق من صندوق الوارد.')
            }
            if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
              throw new Error('بريد إلكتروني أو كلمة مرور غير صحيحة')
            }
            throw error
          }

        if (data?.user) {
          await ensureUserProfile(data.user)

          const { data: profile } = await supabase
            .from('users')
            .select('is_active, is_banned')
            .eq('id', data.user.id)
            .maybeSingle()

          if (profile?.is_banned) {
            await supabase.auth.signOut()
            throw new Error('تم حظر هذا الحساب')
          }

          if (profile && profile.is_active === false) {
            await supabase.auth.signOut()
            throw new Error('الحساب غير نشط')
          }
        }

        toast({
          title: 'تم تسجيل الدخول بنجاح',
          description: 'مرحباً بك مرة أخرى!'
        })
        router.push(redirectTo)
      } else {
        const { data, error } = await signUp(formData.email, formData.password, formData.displayName)
        if (error) {
          if (error.message.includes('rate limit') || error.message.includes('too many')) {
            throw new Error('تم تجاوز حد المحاولات. انتظر قليلاً ثم حاول مرة أخرى.')
          }
          throw error
        }

        toast({
          title: 'تم إنشاء الحساب بنجاح',
          description: 'تم إرسال رابط تأكيد إلى بريدك الإلكتروني. يرجى تفعيل الحساب قبل تسجيل الدخول.'
        })

        // If email confirmation is disabled, proceed to login
        if (data?.user) {
          await ensureUserProfile(data.user)
        }

        setTimeout(() => setIsLogin(true), 3000)
      }
    } catch (error) {
      toast({
        title: 'حدث خطأ',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        if (error.message.includes('provider') || error.message.includes('Google') || error.message.includes('oauth')) {
          throw new Error('تسجيل الدخول بـ Google غير مُفعّل حالياً. يرجى استخدام البريد الإلكتروني.')
        }
        throw error
      }
    } catch (error) {
      toast({
        title: 'حدث خطأ',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-5xl font-bold text-red-600 mb-2">NOO TV</h1>
          </Link>
          <p className="text-gray-400">منصة البث العربية</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isLogin ? 'ادخل بياناتك للدخول' : 'املأ البيانات لإنشاء حساب'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="displayName" className="text-white">الاسم</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="ادخل اسمك"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="bg-black border-gray-700 text-white"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-white">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-black border-gray-700 text-white"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-white">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-black border-gray-700 text-white"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'جاري التحميل...' : (isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب')}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-900 px-2 text-gray-400">أو</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-gray-700 text-white hover:bg-gray-800"
              onClick={handleGoogleSignIn}
            >
              <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              المتابعة باستخدام Google
            </Button>

            <div className="mt-6 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-red-500 hover:text-red-400 transition"
              >
                {isLogin ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل الدخول'}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Link href="/" className="text-gray-400 hover:text-white transition">
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-white text-2xl">جاري التحميل...</div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
