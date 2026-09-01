import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/', '/auth', '/api/auth-direct', '/api/intro', '/api/complaints', '/robots.txt', '/security.txt', '/manifest.json', '/favicon.ico']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function verifyAdminAuth(request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
  if (!tokenMatch) return false

  try {
    const token = decodeURIComponent(tokenMatch[1])
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    if (!payload.exp || payload.exp * 1000 < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!verifyAdminAuth(request)) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/admin',
  ],
}
