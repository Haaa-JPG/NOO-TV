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
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Make sure a public.users profile exists (covers Google OAuth).
        await ensureUserProfile(session.user)
      }

      const redirect = searchParams.get('redirect') || searchParams.get('next') || '/'
      router.replace(redirect)
    }

    handleSession()
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