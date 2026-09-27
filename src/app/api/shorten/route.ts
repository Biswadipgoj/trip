import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tripCode = String(body.tripCode || '').trim().toUpperCase()

    if (!tripCode) {
      return NextResponse.json({ error: 'Missing tripCode' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const origin = `${protocol}://${host}`

    const shortUrl = `${origin}/s/${tripCode}`

    return NextResponse.json({
      success: true,
      code: tripCode,
      shortUrl,
      targetUrl: `${origin}/join-trip?code=${tripCode}`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid request' }, { status: 500 })
  }
}
