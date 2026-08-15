'use client'
export const dynamic = 'force-dynamic'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, ensureUserProfile } from '@/lib/supabase'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          router.replace('/auth')
          return
        }

        if (session?.user) {
          await ensureUserProfile(session.user)
        }

        const rawRedirect = searchParams.get('redirect') || searchParams.get('next') || '/'
        const redirect = (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) ? '/' : rawRedirect
        router.replace(redirect)
      } catch (err) {
        console.error('Callback error:', err)
        router.replace('/auth')
      }
    }

    const timeout = setTimeout(() => {
      router.replace('/auth')
    }, 15000)

    handleSession().finally(() => clearTimeout(timeout))

    return () => clearTimeout(timeout)
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">جاري تسجيل الدخول...</h2>
        <p className="text-gray-400">يرجى الانتظار</p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">جاري تسجيل الدخول...</h2>
            <p className="text-gray-400">يرجى الانتظار</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
