import { NextResponse, type NextRequest } from 'next/server'
import { cookieNames, sessionKey, verifyAccessToken } from '@/lib/auth/tokens'

// Server-side gate for every trip page. A page is served only when the
// httpOnly access cookie is valid and belongs to a member of that trip.
// An expired access token is renewed via /api/auth/refresh (which can read
// the refresh cookie); anything else goes to the login page.

const TRIP_ROUTE = /^\/(dashboard|expenses|members|payments|settlements|report)\/([0-9a-f-]{36})(?:\/|$)/i

export async function middleware(req: NextRequest) {
  const key = sessionKey()
  if (!key) return NextResponse.next() // auth not configured (local dev without secrets)

  const match = req.nextUrl.pathname.match(TRIP_ROUTE)
  if (!match) return NextResponse.next()
  const tripId = match[2].toLowerCase()
  const next = req.nextUrl.pathname + req.nextUrl.search

  const names = cookieNames(req.nextUrl.protocol === 'https:')
  const claims = await verifyAccessToken(req.cookies.get(names.access)?.value, key)

  if (claims?.ms.some(m => m.tripId.toLowerCase() === tripId)) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  // Background prefetches (Next.js router) must not start refreshes: several
  // fire at once and would race the page's own refresh. Just decline them.
  if (req.headers.get('next-router-prefetch') || req.headers.get('purpose') === 'prefetch') {
    return new NextResponse(null, { status: 204 })
  }

  // Valid session but not for this trip → log in to this trip. No or expired
  // access token → try a silent refresh first.
  const target = claims
    ? new URL('/login', req.url)
    : new URL('/api/auth/refresh', req.url)
  target.searchParams.set('next', next)
  return NextResponse.redirect(target)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/expenses/:path*',
    '/members/:path*',
    '/payments/:path*',
    '/settlements/:path*',
    '/report/:path*',
  ],
}
