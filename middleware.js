import { NextResponse } from 'next/server'

export function middleware(req) {
  const url = req.nextUrl

  // Only protect these routes
  const isProtected =
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/user')

  if (!isProtected) return NextResponse.next()

  // Check for any Supabase auth cookie (sb-<project-ref>-auth-token)
  const hasCookie = req.cookies.getAll().some(
    (c) => c.name.includes('-auth-token') || c.name.startsWith('sb-')
  )

  if (!hasCookie) {
    const redirect = url.clone()
    redirect.pathname = '/auth'
    redirect.searchParams.set('redirect', url.pathname)
    return NextResponse.redirect(redirect)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*'],
}
