import { NextResponse } from 'next/server'

// Auth protection is handled client-side in each protected page
// (the app stores the Supabase session in localStorage, not cookies,
// so server-side middleware cannot reliably detect it).
// This middleware only passes requests through.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*'],
}