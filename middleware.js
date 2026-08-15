import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin') || pathname.startsWith('/user')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.next()
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const supabase = createClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
          return match ? match[1] : undefined
        },
      },
    })

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      if (pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/auth?redirect=/admin', request.url))
      }
      return NextResponse.redirect(new URL('/auth?redirect=' + encodeURIComponent(pathname), request.url))
    }

    if (pathname.startsWith('/admin')) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile || profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/user/:path*'],
}
