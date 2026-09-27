import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawCode = String(body.tripCode || '').trim().toUpperCase()
    if (!rawCode || !/^[A-Z0-9_-]{3,20}$/.test(rawCode)) {
      return NextResponse.json({ error: 'Invalid or missing tripCode' }, { status: 400 })
    }
    const tripCode = rawCode

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const origin = `${protocol}://${host}`

    const shortUrl = `${origin}/s/${encodeURIComponent(tripCode)}`

    return NextResponse.json({
      success: true,
      code: tripCode,
      shortUrl,
      targetUrl: `${origin}/join-trip?code=${encodeURIComponent(tripCode)}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid request' }, { status: 500 })
  }
}
