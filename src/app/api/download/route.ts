import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  return NextResponse.redirect(new URL('/api/download/tripmate-latest.apk', url.origin), {
    status: 307,
  })
}

export async function HEAD(req: Request) {
  const url = new URL(req.url)
  return NextResponse.redirect(new URL('/api/download/tripmate-latest.apk', url.origin), {
    status: 307,
  })
}
