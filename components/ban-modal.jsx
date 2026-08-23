'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getCurrentUser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Ban, LogOut, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function BanModal() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkBan()
  }, [])

  const checkBan = async () => {
    const { user } = await getCurrentUser()
    if (!user) { setChecking(false); return }

    const { data } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (data && data.is_active === false) {
      setShow(true)
    }
    setChecking(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (checking || !show) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">تم حظر حسابك</h2>
        <div className="flex items-center justify-center gap-2 text-yellow-500 mb-4">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm">حسابك تم حظره من قبل الإدارة</p>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          إذا كنت تعتقد أن هذا خطأ، يمكنك تقديم شكوى للإدارة.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/complaints" onClick={() => setShow(false)}>
            <Button className="w-full bg-red-600 hover:bg-red-700">
              تقديم شكوى
            </Button>
          </Link>
          <Button variant="outline" className="w-full border-gray-600" onClick={handleLogout}>
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </div>
    </div>
  )
}
