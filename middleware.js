import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()

  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()

  const url = req.nextUrl
  const isProtected = url.pathname.startsWith('/admin') || url.pathname.startsWith('/user')

  if (isProtected && !session) {
    const redirectUrl = url.clone()
    redirectUrl.pathname = '/auth'
    redirectUrl.search = `?redirect=${encodeURIComponent(url.pathname)}`
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*'],
}
