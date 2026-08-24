import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    const hasAuth = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
    if (!hasAuth) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
